import type { FastifyInstance } from 'fastify'
import initSqlJs from 'sql.js'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

interface TableInfo {
  name: string
  columns: { name: string; type: string; notNull: boolean; pk: boolean }[]
  rowCount: number
}

interface QueryResult {
  columns: string[]
  rows: unknown[][]
  rowCount: number
  executionTime: number
}

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null

async function getSql() {
  if (!SQL) SQL = await initSqlJs()
  return SQL
}

async function openDb(dbPath: string) {
  const SQL = await getSql()
  const buffer = await readFile(dbPath)
  return new SQL.Database(buffer)
}

export function registerDatabaseRoutes(fastify: FastifyInstance): void {
  fastify.post<{ Body: { projectPath: string } }>('/database/list-dbs', async (req, reply) => {
    const { projectPath } = req.body
    if (!projectPath) return reply.status(400).send({ error: 'projectPath is required' })

    try {
      const files = await readdir(projectPath)
      const dbs = files.filter(f => f.endsWith('.db') || f.endsWith('.sqlite') || f.endsWith('.sqlite3'))
      reply.send({ databases: dbs })
    } catch {
      reply.status(500).send({ error: 'Failed to list databases' })
    }
  })

  fastify.post<{ Body: { dbPath: string } }>('/database/tables', async (req, reply) => {
    const { dbPath } = req.body
    if (!dbPath || !existsSync(dbPath)) return reply.status(400).send({ error: 'Database file not found' })

    try {
      const db = await openDb(dbPath)

      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      const tableNames = tables[0]?.values.map(v => v[0] as string) || []

      const result: TableInfo[] = []
      for (const name of tableNames) {
        const colResult = db.exec(`PRAGMA table_info("${name}")`)
        const columns = colResult[0]?.values.map(v => ({
          name: v[1] as string,
          type: v[2] as string,
          notNull: (v[3] as number) === 1,
          pk: (v[5] as number) === 1,
        })) || []

        const countResult = db.exec(`SELECT COUNT(*) as cnt FROM "${name}"`)
        const rowCount = countResult[0]?.values[0][0] as number || 0

        result.push({ name, columns, rowCount })
      }

      db.close()
      reply.send({ tables: result })
    } catch (err) {
      reply.status(500).send({ error: `Failed to read database: ${err}` })
    }
  })

  fastify.post<{ Body: { dbPath: string; table: string; limit?: number; offset?: number } }>('/database/query', async (req, reply) => {
    const { dbPath, table, limit = 50, offset = 0 } = req.body
    if (!dbPath || !existsSync(dbPath)) return reply.status(400).send({ error: 'Database file not found' })

    try {
      const db = await openDb(dbPath)
      const start = performance.now()

      const queryResult = db.exec(`SELECT * FROM "${table}" LIMIT ${limit} OFFSET ${offset}`)
      const columns = queryResult[0]?.columns || []
      const rows = queryResult[0]?.values || []

      const executionTime = performance.now() - start
      db.close()

      reply.send({ columns, rows, rowCount: rows.length, executionTime: Math.round(executionTime * 100) / 100 } satisfies QueryResult)
    } catch (err) {
      reply.status(500).send({ error: `Failed to query database: ${err}` })
    }
  })

  fastify.post<{ Body: { dbPath: string; sql: string } }>('/database/execute', async (req, reply) => {
    const { dbPath, sql } = req.body
    if (!dbPath || !existsSync(dbPath)) return reply.status(400).send({ error: 'Database file not found' })

    try {
      const db = await openDb(dbPath)
      const start = performance.now()

      const isSelect = sql.trim().toUpperCase().startsWith('SELECT')
      let result: QueryResult

      if (isSelect) {
        const queryResult = db.exec(sql)
        result = {
          columns: queryResult[0]?.columns || [],
          rows: queryResult[0]?.values || [],
          rowCount: queryResult[0]?.values.length || 0,
          executionTime: Math.round((performance.now() - start) * 100) / 100,
        }
      } else {
        db.run(sql)
        const affected = db.getRowsModified()
        result = {
          columns: ['changes'],
          rows: [[affected]],
          rowCount: 1,
          executionTime: Math.round((performance.now() - start) * 100) / 100,
        }
      }

      db.close()
      reply.send(result)
    } catch (err) {
      reply.status(500).send({ error: `Failed to execute SQL: ${err}` })
    }
  })
}
