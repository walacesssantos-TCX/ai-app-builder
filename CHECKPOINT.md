# AI App Builder Studio — CHECKPOINT

## Versão atual
**v0.1.15** — última atualização: `2026-06-12T15:00:00Z`

## Setup
- Tauri v2 + React 18 + TypeScript + Vite + Tailwind + Zustand (persist)
- Sidecar Node.js (Fastify) em `sidecar/`, roda em `http://localhost:3001`
- Vite dev server em `http://localhost:1420`
- RTK (Rust Token Killer) global em `C:\Users\walace\.local\bin\rtk.exe`
- Instaladores: MSI + NSIS em `src-tauri/target/release/bundle/`
- Chave de assinatura em `~\.tauri\ai-updater.key`
- Prisma + SQLite (`aibuilder.db`) no sidecar
- Modelo local: `qwen3.5:4b` (3.38GB GGUF) com `OLLAMA_DISABLE_GPU=1`
- Ollama global em `C:\Users\walace\AppData\Local\Programs\Ollama\`

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
- `llm_gateway.rs`: suporte nativo a Anthropic (SSE), OpenAI-compatível (DeepSeek, Mistral, Groq, OpenRouter), Gemini (streamGenerateContent)
- `cloud_chat_completion` + `cloud_models` Tauri commands
- Leitura de API keys do SQLite com decriptação AES-256-GCM (shared key com `sidecar/src/lib/crypto.ts`)
- Sidecar auto-start via `setup()` em thread separada

### Modelo Nativo GGUF (Native Model)
- `find_native_blob()`: busca automática por arquivos GGUF >10MB em `Documents/blobs/`
- `ensure_native_model()`: cria modelo Ollama a partir de GGUF local com Modelfile
- Suporte a `qwen3.5:4b` e alias `fluxcodex-qwen35-native`
- CPU-only (`OLLAMA_DISABLE_GPU=1`) para evitar Vulkan OOM

### Auto-Update (v0.1.5+)
- `updater.rs`: `check_local_update` (lê `updater.json` local) + `install_update` (spawn installer `/S /RUN` + exit(0))
- `get_app_version` command
- Frontend: `UpdateSection.tsx` com Verificar + Baixar & Instalar
- `tauri.conf.json`: plugin registrado no Rust

## Histórico de versões e correções

### v0.1.13 — Pipeline de Update + Ollama 500
- **Code Review** no pipeline de update, 3 bugs corrigidos:
  - `generate-updater.ps1`: installer path hardcoded como `0.1.0`
  - `serve-update-local.ps1`: mesmo bug
  - `updater.rs`: `resolve_installer_path()` com url-decode, `file:///` prefix, converte `/`→`\`
- **BOM fix**: `generate-updater.ps1` trocado de `Out-File -Encoding UTF8` (com BOM) para `[System.IO.File]::WriteAllText` (UTF-8 sem BOM) — BOM quebrava `serde_json::from_str()`
- **Ollama 500 fix** (`llama-server.exe` faltando):
  - Bundled `lib/ollama/` com `llama-server.exe` + DLLs CPU (37MB)
  - GPU backends removidos do bundle (`cuda_v12`, `cuda_v13`, `rocm_v7_1`, `vulkan`) — 3GB→37MB (NSIS <2GB)
  - `find_ollama_executable()` prioriza global install sobre bundle
  - Error handler inclui `response.text().await` no log
- **Code review + correções** em `runner.rs` (timeout REAL com polling `try_wait()` + `kill()`), `example-plugin.md` (`TOOL_USERNAME`), `agent-engine.ts` (env vars `TOOL_X` em vez de args concatenados)

### v0.1.14 — Stop Button + Modelos Cloud + Update Detectável
- **Stop real do chat**: `cancel_chat` Tauri command com `AtomicBool` global `CHAT_CANCELLED`, verificado nos 4 streaming loops (Ollama, Anthropic, OpenAI, Gemini)
- **Cloud model fix**: `settings.store.ts` — `partialize` removia forcava fallback para modelo local se cloud
- **Update detectável**: resource bundled com v0.1.15, dev path com v0.1.14 para trigger do update

### v0.1.15 — Cancel durante setup + Timeout (correção de bugs do v0.1.14)
- **`reset_cancel()` no início**: antes estava DEPOIS do setup (linha 338) — se usuário clicasse Stop durante `ensure_native_model` (>30s), a flag era limpa pelo `reset_cancel()` posterior, perdendo o stop
- **`is_cancelled()` check no setup**: adicionado check depois de `ensure_native_model` e antes da API call, tanto em `chat_completion` quanto `cloud_chat_completion`
- **Timeout reqwest**: todos os clients `reqwest::Client::new()` (sem timeout) substituídos por `.builder().timeout(60s)` no local, `120s` nos cloud — antes qualquer hang de rede travava o `invoke` para sempre, deixando "Aguardando resposta..." indefinidamente
- `cloud_chat_completion` agora chama `reset_cancel()` no início também

## Builds gerados
| Versão | Instaladores | Status |
|--------|-------------|--------|
| v0.1.12 | — | Anterior |
| v0.1.13 | NSIS + MSI assinados | Buildado |
| v0.1.14 | NSIS + MSI | Buildado (bugs: stop e timeout) |
| v0.1.15 | NSIS + MSI | **Atual** |

## Estratégia de Update
- **Resource bundled**: `updater.json` aponta para PRÓXIMA versão (ex: v0.1.15 resource tem v0.1.16)
- **Dev path**: `D:\Projeto Fluxcodex\ai-app-builder\updater.json` aponta para versão corrente (v0.1.15)
- App instalado (ex: v0.1.14) detecta v0.1.15 via dev path → trigger de update

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

# Compile check only
cargo check --manifest-path src-tauri/Cargo.toml
tsc --noEmit
```
