import { EventEmitter } from 'node:events'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { prisma } from '../lib/prisma.js'

export interface SupabaseConnectionConfig {
  id: string
  name: string
  url: string
  anonKey: string
  serviceKey?: string
  enabled: boolean
}

export interface SupabaseConnectionStatus {
  id: string
  name: string
  connected: boolean
  error?: string
  project?: string
}

interface ConnectionEntry {
  config: SupabaseConnectionConfig
  anonClient: SupabaseClient | null
  serviceClient: SupabaseClient | null
  connected: boolean
  error?: string
}

class SupabaseManager extends EventEmitter {
  private connections = new Map<string, ConnectionEntry>()
  private initialized = false

  async start(): Promise<void> {
    const rows = await prisma.supabaseConnection.findMany({ where: { enabled: true } })
    for (const row of rows) {
      await this.connect({
        id: row.id,
        name: row.name,
        url: row.url,
        anonKey: row.anonKey,
        serviceKey: row.serviceKey ?? undefined,
        enabled: row.enabled,
      })
    }
    this.initialized = true
    this.emit('ready')
  }

  async stop(): Promise<void> {
    for (const [id] of this.connections) {
      this.disconnect(id)
    }
    this.initialized = false
  }

  onShutdown(): void {
    this.stop()
  }

  async connect(config: SupabaseConnectionConfig): Promise<void> {
    this.disconnect(config.id)
    try {
      const anonClient = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
      })

      const { error } = await anonClient.auth.getSession()
      if (error) {
        this.connections.set(config.id, {
          config,
          anonClient: null,
          serviceClient: null,
          connected: false,
          error: error.message,
        })
        this.emit('error', { id: config.id, name: config.name, error: error.message })
        return
      }

      let serviceClient: SupabaseClient | null = null
      if (config.serviceKey) {
        serviceClient = createClient(config.url, config.serviceKey, {
          auth: { persistSession: false },
        })
      }

      this.connections.set(config.id, {
        config,
        anonClient,
        serviceClient,
        connected: true,
      })

      this.emit('connected', { id: config.id, name: config.name })
    } catch (err) {
      this.connections.set(config.id, {
        config,
        anonClient: null,
        serviceClient: null,
        connected: false,
        error: (err as Error).message,
      })
      this.emit('error', { id: config.id, name: config.name, error: (err as Error).message })
    }
  }

  disconnect(id: string): void {
    const entry = this.connections.get(id)
    if (entry) {
      this.connections.delete(id)
      this.emit('disconnected', { id, name: entry.config.name })
    }
  }

  async testConnection(config: Omit<SupabaseConnectionConfig, 'id' | 'name' | 'enabled'> & { name?: string }): Promise<{ success: boolean; error?: string; project?: string }> {
    try {
      const client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false },
      })
      const { error } = await client.auth.getSession()
      if (error) return { success: false, error: error.message }

      const projectName = config.url.replace(/^https?:\/\//, '').split('.')[0]
      return { success: true, project: projectName }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }

  getClient(id: string, useServiceRole = false): SupabaseClient | null {
    const entry = this.connections.get(id)
    if (!entry) return null
    return useServiceRole ? (entry.serviceClient ?? entry.anonClient) : entry.anonClient
  }

  async listTables(id: string): Promise<{ schema: string; name: string }[]> {
    const client = this.getClient(id, true)
    if (!client) throw new Error('Conexão Supabase não encontrada')

    const { data: tables, error } = await client
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .in('table_schema', ['public'])

    if (error) throw new Error(`Erro ao listar tabelas: ${error.message}`)
    if (!tables) return []
    return (tables as any[]).map(t => ({ schema: t.table_schema, name: t.table_name }))
  }

  async getTableInfo(id: string, table: string): Promise<{ columns: any[] }> {
    const client = this.getClient(id, true)
    if (!client) throw new Error('Conexão Supabase não encontrada')

    const { data, error } = await client
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', table)

    if (error) throw error
    return { columns: (data as any[]) || [] }
  }

  async query(id: string, table: string, options?: { select?: string; limit?: number; offset?: number; order?: string; ascending?: boolean }): Promise<{ data: any[]; count: number }> {
    const client = this.getClient(id)
    if (!client) throw new Error('Conexão Supabase não encontrada')

    let query = client.from(table).select(options?.select || '*', { count: 'exact' })
    if (options?.order) query = query.order(options.order, { ascending: options.ascending ?? true })
    if (options?.limit) query = query.limit(options.limit)
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 100) - 1)

    const { data, error, count } = await query
    if (error) throw error
    return { data: (data as any[]) || [], count: count ?? 0 }
  }

  async executeSql(id: string, query: string): Promise<any> {
    const entry = this.connections.get(id)
    if (!entry?.connected) throw new Error('Conexão Supabase não encontrada')

    const client = this.getClient(id, true)
    if (!client) throw new Error('Conexão Supabase não encontrada')

    const { data, error } = await client.rpc('exec_sql', { query_text: query })

    if (error?.message?.includes('function "exec_sql" does not exist')) {
      throw new Error(
        'SQL direto não suportado. Crie a função RPC exec_sql no seu projeto:\n\n' +
        'CREATE OR REPLACE FUNCTION exec_sql(query_text text)\n' +
        'RETURNS JSONB\n' +
        'LANGUAGE plpgsql\n' +
        'SECURITY DEFINER\n' +
        'AS $$\n' +
        'DECLARE\n' +
        '  result JSONB;\n' +
        'BEGIN\n' +
        '  EXECUTE query_text;\n' +
        '  result := jsonb_build_object(\'success\', true);\n' +
        '  RETURN result;\n' +
        'END;\n' +
        '$$;\n\n' +
        'Use o endpoint /query para consultas padrão.'
      )
    }
    if (error) throw error
    return data
  }

  async listBuckets(id: string): Promise<any[]> {
    const client = this.getClient(id, true)
    if (!client) throw new Error('Conexão Supabase não encontrada')

    const { data, error } = await client.storage.listBuckets()
    if (error) throw error
    return data || []
  }

  async listFiles(id: string, bucket: string, path = ''): Promise<any[]> {
    const client = this.getClient(id, true)
    if (!client) throw new Error('Conexão Supabase não encontrada')

    const { data, error } = await client.storage.from(bucket).list(path)
    if (error) throw error
    return data || []
  }

  async getAuthUsers(id: string): Promise<any[]> {
    const entry = this.connections.get(id)
    if (!entry?.connected || !entry.serviceClient) {
      throw new Error('Service Role Key necessária para listar usuários')
    }

    const { data, error } = await entry.serviceClient
      .from('auth.users')
      .select('id, email, created_at, last_sign_in_at, raw_user_meta_data')

    if (error?.message?.includes('relation "auth.users" does not exist')) {
      throw new Error(
        'Não foi possível acessar auth.users. Certifique-se de usar a Service Role Key ' +
        'e que o projeto Supabase tem a extensão auth habilitada.'
      )
    }
    if (error) throw new Error(`Erro ao listar usuários: ${error.message}`)
    return (data as any[]) || []
  }

  getStatus(): SupabaseConnectionStatus[] {
    const result: SupabaseConnectionStatus[] = []
    for (const [id, entry] of this.connections) {
      const project = entry.config.url.replace(/^https?:\/\//, '').split('.')[0]
      result.push({
        id,
        name: entry.config.name,
        connected: entry.connected,
        error: entry.error,
        project,
      })
    }
    return result
  }

  getConnectionStatus(id: string): SupabaseConnectionStatus | null {
    const entry = this.connections.get(id)
    if (!entry) return null
    const project = entry.config.url.replace(/^https?:\/\//, '').split('.')[0]
    return {
      id,
      name: entry.config.name,
      connected: entry.connected,
      error: entry.error,
      project,
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

export const supabaseManager = new SupabaseManager()
