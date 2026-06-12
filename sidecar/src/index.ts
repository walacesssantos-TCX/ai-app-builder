import Fastify from 'fastify'
import cors from '@fastify/cors'
import { execSync } from 'child_process'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import { createGateway } from './services/llm-gateway.js'
import { registerChatRoutes } from './routes/chat.js'
import { registerApiKeyRoutes } from './routes/api-keys.js'
import { registerProjectRoutes } from './routes/projects.js'
import { registerConversationRoutes } from './routes/conversations.js'
import { registerMcpRoutes } from './routes/mcp-servers.js'
import { registerSkillRoutes } from './routes/skills.js'
import { registerMemoryRoutes } from './routes/memory.js'
import { registerDatabaseRoutes } from './routes/database.js'
import { isRtkAvailable, getSavedTokens } from './services/rtk.js'
import { prisma } from './lib/prisma.js'
import { decryptKey } from './lib/crypto.js'
import { getNetworkStatus } from './lib/network.js'

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOST = process.env.HOST || '127.0.0.1'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runMigrations() {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma')
  const require = createRequire(import.meta.url)
  const prismaCli = path.resolve(__dirname, '../node_modules/prisma/build/index.js')
  console.log('[sidecar] Running prisma db push...')
  console.log(`[sidecar] Schema: ${schemaPath}`)
  try {
    execSync(`node "${prismaCli}" db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: undefined },
    })
    console.log('[sidecar] Database migrated successfully')
  } catch (e) {
    console.error('[sidecar] Migration failed:', e)
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
  runMigrations()
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  })

  await fastify.register(cors, {
    origin: true,
  })

  const dbKeys = await loadKeysFromDb()

  const gateway = createGateway({
    anthropic: process.env.ANTHROPIC_API_KEY || dbKeys.anthropic || '',
    openai: process.env.OPENAI_API_KEY || dbKeys.openai || '',
    openrouter: process.env.OPENROUTER_API_KEY || dbKeys.openrouter || '',
    groq: process.env.GROQ_API_KEY || process.env.TOKEN_GROQ || dbKeys.groq || '',
    gemini: process.env.GEMINI_API_KEY || dbKeys.gemini || '',
    deepseek: process.env.DEEPSEEK_API_KEY || dbKeys.deepseek || '',
    mistral: process.env.MISTRAL_API_KEY || dbKeys.mistral || '',
  })

  registerChatRoutes(fastify, gateway)
  registerApiKeyRoutes(fastify)
  registerProjectRoutes(fastify)
  registerConversationRoutes(fastify)
  registerMcpRoutes(fastify)
  registerSkillRoutes(fastify)
  registerMemoryRoutes(fastify)
  registerDatabaseRoutes(fastify)

  fastify.get('/rtk-status', async () => ({
    available: await isRtkAvailable(),
    savedTokens: getSavedTokens(),
  }))

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  fastify.get('/network-status', async () => {
    const ns = await getNetworkStatus()
    return ns
  })

  fastify.get('/models', async () => ({
    models: gateway.getModels(),
  }))

  try {
    await fastify.listen({ port: PORT, host: HOST })
    fastify.log.info(`Sidecar running at http://${HOST}:${PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

main()
