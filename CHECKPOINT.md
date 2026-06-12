# AI App Builder Studio — CHECKPOINT

## Versão atual
**v0.1.13** — última atualização: `2026-06-12T13:39:00Z`

## Setup
- Tauri v2 + React 18 + TypeScript + Vite + Tailwind + Zustand (persist)
- Sidecar Node.js (Fastify) em `sidecar/`, roda em `http://localhost:3001`
- Vite dev server em `http://localhost:1420`
- RTK (Rust Token Killer) global em `C:\Users\walace\.local\bin\rtk.exe`
- Instaladores: MSI + NSIS em `src-tauri/target/release/bundle/`
- Chave de assinatura em `~\.tauri\ai-updater.key`
- Prisma + SQLite (`aibuilder.db`) no sidecar

## O que foi implementado até v0.1.12

### Sistema de Plugins/Agentes (v0.1.12+)
- `runner.rs`: módulo nativo Rust para execução de ferramentas em subprocesso (timeout, cwd, env)
- `run_tool` Tauri command: executa scripts de plugins com sandbox básico
- Skills declarativas: frontmatter YAML com `tools` array de `{name, description, exec, permissions}`
- `ToolDef` struct (Rust + TypeScript) compartilhada entre `SkillMeta`, `ActiveSkill` e `Skill`
- Sidecar Agent Engine estendido: aceita `customTools: ToolDef[]`, cria `AgentTool` a partir delas
- Injeção automática de ferramentas de skills ativas no prompt de sistema do agente
- Context Builder estendido: tools declaradas são descritas como comandos `<tool_use>` XML
- Frontend: `PluginManager` component na aba "Plugins" das Configurações
- `example-plugin.md`: skill built-in de demonstração com 2 tools (`greet`, `check_disk`)
- Compilação: `cargo check` + `tsc --noEmit` sem erros

### Sistema de Skills (Rust + Frontend)
- `skills.rs`: parsing de SKILL.md com frontmatter YAML + `tools` opcionais
- `skills_data.rs`: 59 built-in skills compiladas no binário via `include_str!()`
- Descoberta em 3 níveis: projeto → global (`~/.aibuilder/skills`) → built-in
- Frontend: `SkillsList`, `SkillCard`, `skills.store` com seed + pin/activate

### Gateway Cloud Nativo (Rust)
- `llm_gateway.rs`: 511 linhas, suporte nativo a Anthropic (SSE), OpenAI-compatível (DeepSeek, Mistral, Groq, OpenRouter), Gemini (streamGenerateContent)
- `cloud_chat_completion` + `cloud_models` Tauri commands
- Leitura de API keys do SQLite com decriptação AES-256-GCM (shared key com `sidecar/src/lib/crypto.ts`)
- Sidecar auto-start via `setup()` em thread separada
- Frontend `useStream.ts` roteia TODOS os modelos via Tauri invoke (sem fetch direto ao sidecar)

### Modelo Nativo GGUF (Native Model)
- `find_native_blob()`: busca automática por arquivos GGUF >10MB em `Documents/blobs/`
- `ensure_native_model()`: cria modelo Ollama a partir de GGUF local com Modelfile
- Suporte a `qwen3.5:4b` e alias `fluxcodex-qwen35-native`
- CPU-only (`OLLAMA_DISABLE_GPU=1`) para evitar Vulkan OOM

### Sidecar Node.js Expandido
- 8 rotas REST: `chat`, `api-keys`, `projects`, `conversations`, `mcp-servers`, `skills`, `memory`, `database`
- LLM Gateway multi-provedor (Anthropic, OpenAI, Gemini, DeepSeek, Mistral, Groq)
- Agent Engine ReAct com ciclo `<tool_use>` + 5 tools built-in
- MCP Client (stdio/http/sse/ws), Context Builder, RTK integration
- Migrations automáticas via Prisma db push no startup

### Frontend Completo
- **Chat**: `ChatPanel`, `MessageList`, `MessageBubble`, `ChatInput`, `ModeSelector`, `PlusMenu`
- **Settings**: API Keys, Models, **Plugins**, MCP Servers, Auto-Update
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
- `serde_yaml`, `reqwest` (com stream feature), `rusqlite`, `aes-gcm`, `base64`, `hex`
- Prisma + SQLite + Zod no sidecar
- Zustand com middleware persist para settings

## Próximos passos sugeridos
1. Unificar API keys — integrar chaves do SQLite no gateway Rust (eliminar dependência do sidecar para cloud)
2. Finalizar roteamento híbrido (local Tauri / cloud sidecar) com fallback automático
3. Sandbox avançado: jail de filesystem por diretório temporário, bloqueio de rede por processo
4. Plugin marketplace: download e instalação de plugins remotos via GitHub
5. Editor visual de ferramentas para skills (criar/modificar `tools` no frontmatter sem editar YAML)

### Atualizações e Pipeline de Update (v0.1.13)
- **Code Review completo** no pipeline de update, 3 bugs corrigidos:
  - `generate-updater.ps1`: installer path hardcoded como `0.1.0` — nunca gerava updater.json correto
  - `serve-update-local.ps1`: mesmo bug do generate
  - `updater.rs`: `install_update` agora com `resolve_installer_path()` — trata URL encoding (`%20`), `file:///` prefix, e converte `/` para `\` no Windows. Verifica se o instalador existe antes de spawnar.
  - `updater.json` atualizado de v0.1.11 → v0.1.13
- **Bump versão**: `0.1.12` → `0.1.13`
- **Build assinado** gerado: `AI App Builder Studio_0.1.13_x64-setup.exe` (NSIS + MSI)
- **updater.json** gerado via script, aponta para installer 0.1.13 no dev path
- Versão resource no bundle = 0.1.13 (mesmo do app), para não ativar update falso após instalação

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
