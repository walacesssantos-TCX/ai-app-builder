import Fastify from 'fastify'
import cors from '@fastify/cors'
import { execSync } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import { createGateway, setCurrentGateway } from './services/llm-gateway.js'
import { registerChatRoutes } from './routes/chat.js'
import { registerApiKeyRoutes } from './routes/api-keys.js'
import { registerProjectRoutes } from './routes/projects.js'
import { registerConversationRoutes } from './routes/conversations.js'
import { registerMcpRoutes } from './routes/mcp-servers.js'
import { registerSubagentRoutes } from './routes/subagents.js'
import { registerSkillRoutes } from './routes/skills.js'
import { registerMcpSkillsRoutes } from './routes/mcp-skills.js'
import { registerMemoryRoutes } from './routes/memory.js'
import { registerDatabaseRoutes } from './routes/database.js'
import { registerPreviewRoutes } from './routes/preview.js'
import { registerSupabaseRoutes } from './routes/supabase.js'
import { registerKanbanRoutes } from './routes/kanban.js'
import { registerGitHubRoutes } from './routes/github.js'
import { registerTemplateRoutes } from './routes/templates.js'
import { registerDeployRoutes } from './routes/deploy.js'
import { registerWhisperRoutes } from './routes/whisper.js'
import { registerTranscribePageRoutes } from './routes/transcribe-page.js'
import { registerConvertRoutes } from './routes/convert.js'
import { isRtkAvailable, getSavedTokens } from './services/rtk.js'
import { mcpManager } from './services/mcp-manager.js'
import { subagentManager } from './services/subagent-manager.js'
import { devServerManager } from './services/dev-server-manager.js'
import { supabaseManager } from './services/supabase-manager.js'
import { prisma } from './lib/prisma.js'
import { decryptKey, setHwid, generateHwid } from './lib/crypto.js'
import { getNetworkStatus } from './lib/network.js'

process.on('uncaughtException', (err) => {
  console.error('[sidecar] UNCAUGHT EXCEPTION:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[sidecar] UNHANDLED REJECTION:', reason)
})

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '127.0.0.1'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runMigrations() {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma')
  const require = createRequire(import.meta.url)
  const prismaCli = path.resolve(__dirname, '../node_modules/prisma/build/index.js')
  const dbPath = path.resolve(__dirname, '../prisma/aibuilder.db')

  console.log('[sidecar] Running prisma db push...')
  console.log(`[sidecar] Schema: ${schemaPath}`)
  console.log(`[sidecar] DB file: ${dbPath}`)

  const fs = require('fs') as typeof import('fs')
  if (fs.existsSync(dbPath)) {
    const size = fs.statSync(dbPath).size
    console.log(`[sidecar] DB size: ${(size / 1024).toFixed(1)} KB`)
  } else {
    console.log('[sidecar] DB file does not exist yet — will be created')
  }

  try {
    const result = execSync(`node "${prismaCli}" db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      timeout: 30_000,
    })
    console.log('[sidecar] Database migrated successfully')
    if (result.toString().trim()) {
      console.log(`[sidecar] Migration output: ${result.toString().trim().slice(0, 200)}`)
    }
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; stderr?: Buffer; message?: string; status?: number }
    console.error('[sidecar] Migration FAILED:')
    if (err.stdout?.toString().trim()) console.error('  stdout:', err.stdout.toString().trim().slice(0, 500))
    if (err.stderr?.toString().trim()) console.error('  stderr:', err.stderr.toString().trim().slice(0, 500))
    if (err.message) console.error('  message:', err.message)
  }
}

async function loadKeysFromDb(): Promise<Record<string, string>> {
  try {
    const rows = await prisma.apiKey.findMany()
    const keys: Record<string, string> = {}
    for (const row of rows) {
      try {
        keys[row.provider] = decryptKey(row.keyHash)
      } catch {
        // skip malformed keys
      }
    }
    return keys
  } catch {
    return {}
  }
}

async function main() {
  // Set HWID before loading keys so decryptKey works
  setHwid(generateHwid())
  console.log(`[sidecar] Starting v${process.env.npm_package_version || '?'} on ${HOST}:${PORT}`)
  console.log(`[sidecar] CWD: ${process.cwd()}`)
  console.log(`[sidecar] Node: ${process.version}`)
  console.log(`[sidecar] Platform: ${process.platform} ${process.arch}`)

  runMigrations()

  // Auto-create "Chat" project for global conversation storage
  try {
    const existing = await prisma.project.findFirst({ where: { id: 'chat-global' } })
    if (!existing) {
      await prisma.project.create({
        data: { id: 'chat-global', name: 'Chat', path: '' },
      })
      console.log('[sidecar] ✓ Created default Chat project')
    }
  } catch (e) {
    console.warn('[sidecar] Could not create Chat project:', (e as Error).message)
  }

  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
    bodyLimit: 100 * 1024 * 1024, // 100 MB — necessário para uploads de áudio/vídeo
  })

  await fastify.register(cors, {
    origin: true,
  })

  const dbKeys = await loadKeysFromDb()

  let gateway = createGateway({
    anthropic: process.env.ANTHROPIC_API_KEY || dbKeys.anthropic || '',
    openai: process.env.OPENAI_API_KEY || dbKeys.openai || '',
    openrouter: process.env.OPENROUTER_API_KEY || dbKeys.openrouter || '',
    groq: process.env.GROQ_API_KEY || process.env.TOKEN_GROQ || dbKeys.groq || '',
    gemini: process.env.GEMINI_API_KEY || dbKeys.gemini || '',
    deepseek: process.env.DEEPSEEK_API_KEY || dbKeys.deepseek || '',
    mistral: process.env.MISTRAL_API_KEY || dbKeys.mistral || '',
    cohere: process.env.COHERE_API_KEY || dbKeys.cohere || '',
  })
  setCurrentGateway(gateway)

  const reloadGateway = async () => {
    const fresh = await loadKeysFromDb()
    gateway = createGateway({
      anthropic: fresh.anthropic || '',
      openai: fresh.openai || '',
      openrouter: fresh.openrouter || '',
      groq: fresh.groq || '',
      gemini: fresh.gemini || '',
      deepseek: fresh.deepseek || '',
      mistral: fresh.mistral || '',
      cohere: fresh.cohere || '',
    })
    setCurrentGateway(gateway)
  }

  registerChatRoutes(fastify)
  registerApiKeyRoutes(fastify, gateway, reloadGateway)
  registerProjectRoutes(fastify)
  registerConversationRoutes(fastify)
  registerMcpRoutes(fastify)
  registerSubagentRoutes(fastify)
  registerPreviewRoutes(fastify)
  registerSupabaseRoutes(fastify)

  registerKanbanRoutes(fastify)
  registerGitHubRoutes(fastify)
  registerTemplateRoutes(fastify)
  registerDeployRoutes(fastify)
  registerSkillRoutes(fastify)
  registerMcpSkillsRoutes(fastify)
  registerMemoryRoutes(fastify)
  registerDatabaseRoutes(fastify)
  registerWhisperRoutes(fastify)
  registerTranscribePageRoutes(fastify)
  registerConvertRoutes(fastify)

  fastify.get('/rtk-status', async () => ({
    available: await isRtkAvailable(),
    savedTokens: getSavedTokens(),
  }))

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  fastify.post('/hwid', async (req) => {
    const { hwid } = req.body as { hwid: string }
    if (hwid) {
      setHwid(hwid)
      // Re-load keys with correct HWID (safety net for HWID mismatch)
      const fresh = await loadKeysFromDb()
      gateway = createGateway({
        anthropic: process.env.ANTHROPIC_API_KEY || fresh.anthropic || '',
        openai: process.env.OPENAI_API_KEY || fresh.openai || '',
        openrouter: process.env.OPENROUTER_API_KEY || fresh.openrouter || '',
        groq: process.env.GROQ_API_KEY || process.env.TOKEN_GROQ || fresh.groq || '',
        gemini: process.env.GEMINI_API_KEY || fresh.gemini || '',
        deepseek: process.env.DEEPSEEK_API_KEY || fresh.deepseek || '',
        mistral: process.env.MISTRAL_API_KEY || fresh.mistral || '',
        cohere: process.env.COHERE_API_KEY || fresh.cohere || '',
      })
      setCurrentGateway(gateway)
      return { success: true }
    }
    return { success: false, error: 'hwid required' }
  })

  fastify.get('/network-status', async () => {
    const ns = await getNetworkStatus()
    return ns
  })

  fastify.get('/models', async () => ({
    models: gateway.getModels(),
  }))

  mcpManager.start().catch(err => {
    fastify.log.warn(`[mcp-manager] Failed to start: ${err}`)
  })

  subagentManager.loadCustom().catch(err => {
    fastify.log.warn(`[subagent-manager] Failed to load custom subagents: ${err}`)
  })

  supabaseManager.start().catch(err => {
    fastify.log.warn(`[supabase-manager] Failed to start: ${err}`)
  })

  const cleanup = () => {
    devServerManager.onShutdown()
    supabaseManager.onShutdown()
    fastify.close()
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  try {
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`[sidecar] ✓ Ready at http://${HOST}:${PORT}`)
    fastify.log.info(`Sidecar running at http://${HOST}:${PORT}`)
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    console.error(`[sidecar] ✗ FAILED to listen on ${HOST}:${PORT}`)
    if (e.code === 'EADDRINUSE') {
      console.error(`[sidecar]   → Port ${PORT} is already in use by another process`)
      console.error(`[sidecar]   → Kill the other process or change PORT env var`)
    } else {
      console.error(`[sidecar]   → ${e.code || ''} ${e.message || err}`)
    }
    fastify.log.error(err)
    process.exit(1)
  }
}

main()
