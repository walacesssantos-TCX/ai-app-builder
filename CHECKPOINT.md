# AI App Builder Studio — CHECKPOINT

## Versão atual
**v0.1.12** — última atualização: `2026-06-12T00:00:00Z`

## Setup
- Tauri v2 + React 18 + TypeScript + Vite + Tailwind + Zustand (persist)
- Sidecar Node.js (Fastify) em `sidecar/`, roda em `http://localhost:3001`
- Vite dev server em `http://localhost:1420`
- RTK (Rust Token Killer) global em `C:\Users\walace\.local\bin\rtk.exe`
- Instalador NSIS em `src-tauri/target/release/bundle/nsis/`
- Chave de assinatura em `~\.tauri\ai-updater.key`
- Prisma + SQLite (`aibuilder.db`) no sidecar

## O que foi implementado até v0.1.12

### Sistema de Skills (Rust + Frontend)
- `skills.rs`: parsing de SKILL.md com frontmatter YAML (`serde_yaml`)
- `skills_data.rs`: 58 built-in skills compiladas no binário via `include_str!()`
- Descoberta em 3 níveis: projeto → global (`~/.aibuilder/skills`) → built-in
- Frontend: `SkillsList`, `SkillCard`, `skills.store` com seed + pin/activate

### Modelo Nativo GGUF (Native Model)
- `find_native_blob()`: busca automática por arquivos GGUF >10MB em `Documents/blobs/`
- `ensure_native_model()`: cria modelo Ollama a partir de GGUF local com Modelfile
- Suporte a `qwen3.5:4b` e alias `fluxcodex-qwen35-native`
- CPU-only (`OLLAMA_DISABLE_GPU=1`) para evitar Vulkan OOM

### Sidecar Node.js Expandido
- 8 rotas REST: `chat`, `api-keys`, `projects`, `conversations`, `mcp-servers`, `skills`, `memory`, `database`
- LLM Gateway multi-provedor (Anthropic, OpenAI, Gemini, DeepSeek, Mistral, Groq)
- Carregamento de API keys do SQLite com decriptação (`crypto.ts`)
- Agent Engine, MCP Client, Context Builder, RTK integration
- Migrations automáticas via Prisma db push no startup

### Frontend Completo
- **Chat**: `ChatPanel`, `MessageList`, `MessageBubble`, `ChatInput`, `ModeSelector`, `PlusMenu`
- **Settings**: API Keys, Models, MCP Servers, Auto-Update
- **Editor**: CodeEditor (Monaco), FileExplorer, DatabaseExplorer, Previewer, LogsViewer
- **MCP/Extensions/Deploys**: `McpExplorer`, `ExtensionsExplorer`, `DeployView`
- **Layout**: Sidebar collapsável, RightPanel, NetworkIndicator, TerminalPanel
- **Stores**: chat (streaming, agent events, tokens), project (CRUD), settings (persist), skills

### Auto-Update (v0.1.5+)
- `updater.rs`: `check_local_update` (lê `updater.json` local) + `install_update` (spawn installer `/S /RUN` + exit(0))
- `get_app_version` command
- Frontend: `UpdateSection.tsx` com Verificar + Baixar & Instalar
- `tauri.conf.json`: `updater.active = false`, plugin registrado no Rust

### Infra & Dependências
- `tauri-plugin-updater`, `tauri-plugin-process`, `tauri-plugin-shell`
- `serde_yaml`, `reqwest` (com stream feature)
- Prisma + SQLite + Zod no sidecar
- Zustand com middleware persist para settings

## Próximos passos sugeridos
1. Unificar API keys — integrar chaves do SQLite no gateway Rust (eliminar dependência do sidecar para cloud)
2. Finalizar roteamento híbrido (local Tauri / cloud sidecar) com fallback automático
3. Testar build completo + instalador NSIS
4. Adicionar git init + versionamento do repositório
5. Implementar sistema de plugins/agentes com execução no sandbox

## Comandos úteis
```powershell
# Dev
cd D:\Projeto Fluxcodex\ai-app-builder
npm run dev          # Frontend Vite
cd sidecar && npm run dev  # Sidecar

# Build
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\ai-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npx tauri build
```
