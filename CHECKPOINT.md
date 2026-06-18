# AI App Builder Studio — CHECKPOINT

## Versão atual
**v0.1.58** — última atualização: `2026-06-18T17:00:00Z`

## Setup
- Tauri v2 + React 18 + TypeScript + Vite + Tailwind + Zustand (persist)
- Sidecar Node.js (Fastify) em `sidecar/`, roda em `http://localhost:3001`
- Vite dev server em `http://localhost:1420`
- RTK (Rust Token Killer) ativo via hook global
- Instaladores: `.deb` (Linux) + NSIS (Windows) em `src-tauri/target/release/bundle/`
- Chave de assinatura em `~/.tauri/ai-updater.key` (Linux) ou `~\.tauri\ai-updater.key` (Windows)
- Prisma + SQLite (`aibuilder.db`) no sidecar
- App 100% API-based (Groq, Anthropic, OpenAI, Gemini, DeepSeek, Mistral, Cohere, OpenRouter)
- Sidecar com log para `$TMPDIR/aibuilder-sidecar.log` (Linux) ou `%TEMP%\aibuilder-sidecar.log` (Windows)
- Updater com log para `$TMPDIR/aibuilder-updater.log` (Linux) ou `%TEMP%\aibuilder-updater.log` (Windows)
- **Cross-platform**: shell/bash no Linux, cmd.exe no Windows

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

### Gateway Cloud Nativo (Rust) — removido em v0.1.19
- `llm_gateway.rs` + `ai.rs` removidos, todo chat agora via sidecar Node.js

### Auto-Update (v0.1.5+ → v0.1.19)
- `updater.rs`: `check_local_update` + `check_github_release` + `install_update`
- `get_app_version` command
- Frontend: `UpdateSection.tsx` com Verificar + Baixar & Instalar

## Histórico de versões e correções

### v0.1.21 → v0.1.25 — Correções de timeout, HWID, update e chat resiliente

**Causa raiz do "Failed to fetch":**
- `buildContext()` chamava `execFileAsync('rtk', ['--version'])` sem timeout — se `rtk` trava, handler congela sem resposta, browser fecha conexão → "Failed to fetch"
- Mesmo paradigma: `compressText()` sem timeout no `rtk read`

**Causa raiz da chave API não persistir:**
- Chaves eram criptografadas com HWID do Rust (`COMPUTERNAME|windows|x86_64|USERNAME` → SHA-256)
- `generateHwid()` no Node.js usava `os.platform()` = `"win32"` (Rust: `"windows"`), `process.arch` = `"x64"` (Rust: `"x86_64"`), fallback `'unknown'` (Rust: `''`)
- Hashes diferentes → `deriveKey()` produzia chave AES diferente → `decryptKey()` falhava → gateway sem provider → modelos vazios + chat quebrado
- HWID era setado APÓS `loadKeysFromDb()` (via frontend POST `/hwid`) — startup descriptografava com fallback fixo

**Correções implementadas (v0.1.22 → v0.1.25):**

| O quê | Arquivo | Fix |
|-------|---------|-----|
| Provider LLM timeout | `llm-gateway.ts` | 120s → 30s em todos os 4 providers |
| Frontend timeout | `useStream.ts` | 60s com `setTimeout` + `abortController.abort()`, distingue cancel (silencioso) de timeout (mensagem clara) |
| `isRtkAvailable` timeout | `rtk.ts` | `execFileAsync` com timeout 3s (antes: infinito) |
| `compressText` timeout | `rtk.ts` | `execFileAsync` com timeout 10s |
| `buildContext` timeout | `chat.ts` | `Promise.race` com 15s — se passar, vira erro SSE |
| `generateHwid` mapeamento | `crypto.ts` | win32→windows, x64→x86_64, fallback `''` |
| HWID setado no startup | `index.ts` | `setHwid(generateHwid())` ANTES de `loadKeysFromDb()` |
| `/hwid` recarrega gateway | `index.ts` | Safety net: re-lê chaves com HWID correto e recria gateway |
| Download checa HTTP status | `updater.rs` | `response.ok` antes de salvar (não salva 404 HTML como .exe) |
| Path dev só em debug | `updater.rs` | `cfg!(debug_assertions)` no path hardcoded |
| Timeout update check | `updater.rs` | `.timeout(20s)` adicionado ao reqwest client (antes: só connect_timeout 5s) |
| Log diagnóstico update | `updater.rs` | `aibuilder-updater.log` em `%TEMP%` |

### v0.1.26 → v0.1.27 — Correções de infraestrutura

| O quê | Detalhes |
|-------|----------|
| Permissões SQLite | AppData permissions corrigidas para gravação do banco |
| CORS sidecar | Correção de CORS entre Vite (1420) e sidecar (3001) |
| Prisma DB URL | Ajuste de caminho absoluto no Windows |
| isStreaming travado | Lock de estado para evitar loop infinito |
| Fallback UUID | Geração de ID mesmo quando o sidecar não responde |
| Loop SSE [DONE] | Prevenção de loop infinito no stream |

### v0.1.28 → v0.1.29 — Modelos e resiliência

| O quê | Detalhes |
|-------|----------|
| Groq model update | `llama3-70b-8192` descontinuado → `llama-3.3-70b-versatile` |
| Retry 429 automático | Retry com backoff para rate limit, mensagem amigável de cota |

### v0.1.30 → v0.1.35 — Upload de arquivos e mídia

| O quê | Detalhes |
|-------|----------|
| Upload de arquivos | WAV, MP3, PDF, DOCX, imagens e textos com leitura base64 + envio ao LLM |
| Audio player | Player embutido para áudios enviados |
| Auto-send | Arquivo é enviado automaticamente ao selecionar |
| bodyLimit 100MB | Fastify configurado para 100 MB |
| Arquivos na conversa | Exibição de arquivos inline no histórico do chat |

### v0.1.36 → v0.1.37 — Startup e UX

| O quê | Detalhes |
|-------|----------|
| Sidecar kill stale | Mata `node.exe` preso na porta 3001 antes de iniciar |
| Skills popup scroll | Popup de skills com scroll interno |

### v0.1.38 → v0.1.39 — Histórico persistente

| O quê | Detalhes |
|-------|----------|
| Histórico persistente | Conversas salvas no SQLite via Prisma |
| Exclusão de conversas | Remoção individual de conversas |
| Exportar transcrição | Salva transcrição em `Music/Fluxcodex/` |
| Schema chat fix | Aceita mensagem vazia quando há arquivos |

### v0.1.40 — RTK e Configurações

| O quê | Detalhes |
|-------|----------|
| RTK comprime histórico | Compressão automática do histórico via RTK |
| Badge sempre visível | Indicador de tokens economizados no cabeçalho |
| Aba de configurações | Nova aba de configurações no painel lateral |

### v0.1.41 — Terminal, Modelos e MCP Skills

| O quê | Detalhes |
|-------|----------|
| Terminal skills-aware | Terminal integrado com contexto das skills ativas |
| 30 modelos IA | Expansão para 8 providers com ~30 modelos |
| MCP skills server | Servidor MCP para execução de skills como ferramentas |

### v0.1.42 — OpenRouter e envio de arquivos

| O quê | Detalhes |
|-------|----------|
| OpenRouter free | Rota `openrouter/free` para modelos gratuitos |
| Arquivos + texto | Arquivos agora são enviados junto com o texto no mesmo request |

### v0.1.43 — Histórico real e comando /compact

| O quê | Detalhes |
|-------|----------|
| Histórico real no chat | Toda a conversa carregada do banco SQLite |
| Comando /compact | Comando no chat para compactar mensagens manualmente via RTK |
| RTK compression aprimorada | Compressão otimizada com fallback |

## Rotas do Sidecar (19)
```
api-keys | chat | conversations | convert | database | deploy
github | kanban | mcp-servers | mcp-skills | memory
preview | projects | skills | subagents | supabase | templates
transcribe-page | whisper
```

## Serviços do Sidecar (16)
```
agent-engine | context-builder | deploy | dev-server-manager
docx | ffmpeg | github | llm-gateway | mcp-client
mcp-manager | rtk | skill-scorer | subagent-manager
supabase-manager | templates | whisper
```

## Providers de IA (8)
Anthropic (Claude) | OpenAI (GPT) | Groq (Llama) | Gemini (Google)
DeepSeek | Mistral | Cohere | OpenRouter

## Comandos Rust (8 módulos — inalterado)
```
filesystem | terminal | skills | git | sidecar | updater | runner | skills_data
```

## Frontend (9 seções)
```
chat/    → ChatPanel, ChatInput, HistoryPanel, useStream, DocumentDownload
editor/  → McpExplorer, DeployView, TemplatesPanel, ComparePanel, MarketplacePanel
kanban/  → KanbanBoard
layout/  → Sidebar, RightPanel, NetworkIndicator
settings/→ SettingsPanel (ApiKeys, Models, UpdateSection, ThemeSection)
skills/  → SkillsList, SkillCard
terminal/→ TerminalPanel (skills-aware)
theme/   → useTheme
```

## Builds gerados
| Versão | Instaladores | Status |
|--------|-------------|--------|
| v0.1.12 | — | Anterior |
| v0.1.13 | NSIS + MSI assinados | Buildado |
| v0.1.14 | NSIS + MSI | Buildado (bugs: stop e timeout) |
| v0.1.15 | NSIS + MSI | Buildado |
| v0.1.19 | NSIS + MSI | Buildado (Ollama removido, GitHub updater) |
| v0.1.20 | — | Buildado (sidecar logging + robustez) |
| v0.1.21 | — | Buildado (gateway reference fix) |
| v0.1.22 | — | Buildado (HWID mismatch + timeouts rtk/buildContext) |
| v0.1.23 | — | Buildado (timeout providers + safety net /hwid) |
| v0.1.24 | — | Publicado GitHub (bump para testar update) |
| v0.1.25 | NSIS | Buildado (timeout reqwest 20s + log diagnóstico updater) |
| v0.1.27 | — | Buildado (isStreaming fix, CORS, Prisma path) |
| v0.1.29 | — | Buildado (Groq model update, retry 429) |
| v0.1.35 | — | Buildado (upload arquivos, audio, auto-send) |
| v0.1.38 | — | Buildado (histórico persistente, exclusão, exportar) |
| v0.1.39 | — | Buildado (RTK compression, badge, config) |
| v0.1.41 | — | Buildado (terminal skills-aware, MCP skills, 30 modelos) |
| v0.1.43 | NSIS | Buildado (histórico real, /compact, arquivos+texto, OpenRouter free)
| v0.1.44 | NSIS + MSI | Buildado (CHECKPOINT sincronizado, version sync)
| v0.1.45 | NSIS + MSI | Buildado (Whisper integrado, transcrição automática de áudio)
| v0.1.46 | NSIS + MSI | Buildado (arquivos persistem no histórico, IA vê arquivos anteriores) |
| v0.1.47 | NSIS + MSI | Buildado (página de transcrição, assinatura digital do updater) |
| v0.1.48 | NSIS + MSI | Buildado (bump + release com tema, documentos, whisper fix) |
| v0.1.49 | NSIS + MSI | Buildado (sistema de temas completo: Escuro, Claro, Cinza) |
| v0.1.50 | NSIS + MSI | Buildado (ffmpeg bundlado, transcrição sem instalação manual) |
| v0.1.51 | NSIS + MSI | Buildado (whisper: default tiny + auto-seleção + error diagnostics) |
| v0.1.56 | .deb + NSIS | Buildado (Linux compatibility — sidecar, ffmpeg, Whisper CPU, updater) |
| v0.1.57 | .deb + NSIS | Buildado (Linux CI/CD release, permissions fix, updater Linux) |
| v0.1.58 | .deb + NSIS | **Atual** (Linux full adaptation, transcription 500 fix, updater URL fix) |

### v0.1.45 — Whisper integrado + transcrição automática de áudio

| O quê | Detalhes |
|-------|----------|
| Serviço Whisper | `whisper.ts` — chama o Whisper Python local via subprocesso, salva áudio em temp, executa transcrição, retorna texto |
| Rota `/whisper/transcribe` | Endpoint POST que aceita base64 + fileName, devolve transcrição com metadados |
| Rota `/whisper/status` | Endpoint GET que verifica disponibilidade do Whisper |
| Transcrição automática | `context-builder.ts` detecta arquivos de áudio (WAV, MP3, FLAC, OGG, M4A, AAC) e transcreve via Whisper antes de enviar ao LLM |
| Skill audio-transcriber | Reescreita com frontmatter YAML + tools `transcribe_audio` e `whisper_status`, documentação da API interna |
| Whisper local | `C:\Users\walace\AppData\Local\Python\pythoncore-3.14-64\Scripts\whisper.exe` — CPU only, modelo auto-download |
| Variáveis de ambiente | `WHISPER_PYTHON` (caminho do Python), `WHISPER_MODEL` (padrão: `medium`) |

### v0.1.46 — Arquivos persistem no histórico da conversa

| O quê | Detalhes |
|-------|----------|
| Histórico com arquivos | `chat.ts` agora extrai `files` do `metadata` das mensagens anteriores e re-injeta no `buildContext` |
| Merge automático | Arquivos do histórico + arquivos atuais são mergeados (sem duplicar por nome) |
| Whisper re-executa | Se um áudio do histórico ainda não foi transcrito, será transcrito ao re-carregar |
| Sem migration | Usa o campo `metadata` já existente no Message (JSON com attachments) — zero mudanças no schema |

### v0.1.47 — Página de transcrição + assinatura digital do updater

| O quê | Detalhes |
|-------|----------|
| Página de transcrição | Nova rota `transcribe-page.ts` — interface dedicada para transcrição de áudio |
| Assinatura digital | Updater agora usa chave de assinatura Tauri para validação de updates |
| Bump versão | Cargo.toml, package.json, tauri.conf.json, updater.json → v0.1.47 |

### v0.1.47b — Download de documentos + sistema de temas

| O quê | Detalhes |
|-------|----------|
| DocumentDownload | `DocumentDownload.tsx` — componente para download inline de documentos no chat |
| MessageBubble refatorado | `MessageBubble.tsx` — suporte a download de documentos nas mensagens |
| Sistema de temas | `ThemeSection.tsx` + `useTheme.ts` + `settings.store.ts` — estrutura inicial de temas |
| Conversor de documentos | Rota `convert.ts` + serviço `docx.ts` — conversão de documentos no sidecar |

### v0.1.47c — Fix whisper crash (ffmpeg missing)

| O quê | Detalhes |
|-------|----------|
| FFmpeg error handling | `whisper.ts` — detecção de ffmpeg ausente antes de iniciar transcrição |
| Crash fix | Whisper não trava mais em ~32% quando ffmpeg não está instalado |

### v0.1.49 — Sistema de temas completo

| O quê | Detalhes |
|-------|----------|
| 3 temas completos | Escuro (padrão), Claro, Cinza — aplicados em TODAS as cores do app |
| settings.store refatorado | Gerenciamento de estado de temas com persistência |
| tailwind.config.js atualizado | Paletas de cores completas para cada tema |
| index.css | Variáveis CSS para cada modo com cobertura total de componentes |

### v0.1.50 — FFmpeg bundlado + transcrição sem instalação

| O quê | Detalhes |
|-------|----------|
| ffmpeg-static | FFmpeg bundlado como dependência npm — não requer instalação manual |
| Serviço ffmpeg.ts | `sidecar/src/services/ffmpeg.ts` — localiza e executa ffmpeg do node_modules |
| Detecção precoce | Whisper detecta ffmpeg disponível antes de iniciar, evita crash silencioso |
| Transcrição zero-config | Usuário não precisa instalar ffmpeg separadamente |

### v0.1.51 — Whisper: default tiny + auto-seleção + diagnóstico de erro

| O quê | Detalhes |
|-------|----------|
| Default `tiny` | `transcribe-page.ts` passava sem modelo → caía em `medium` (pesado demais para CPU). Agora usa `tiny` por padrão |
| Auto-seleção | `pickModel()` em `whisper.ts`: >50MB→tiny, >15MB→base, senão→small |
| Diagnóstico de erro | `whisper.ts` agora loga exit code, signal e killed — detecta timeout vs crash vs erro interno |
| Seletor de modelo (UI) | `TranscriptionPanel.tsx` — dropdown com Auto/tiny/base/small/medium |
| API layer | `api.ts` — `start()` aceita payload opcional com `model` |

### v0.1.56 — Linux compatibility: sidecar, ffmpeg, Whisper CPU, updater

| O quê | Detalhes |
|-------|----------|
| Sidecar Linux | Auto-start no app launch: `get_sidecar_dir`, `node` path, `pkill` antes de spawn, XDG paths |
| ffmpeg Linux | `ffmpeg.ts` — remove Windows-only `ffmpeg-static`/`ffprobe-static`, usa system `ffmpeg`/`ffprobe` |
| Whisper Linux | `whisper.ts` — usa venv Python (`/usr/bin/python3`), mensagem de erro `apt install`, default `cpu+int8` |
| Output path Linux | `useStream.ts` — transcrição salva em `/home/walace/Music/Fluxcodex` |
| Checkpoint | Cabeçalho atualizado para v0.1.56 |
| Skills data | `skills_data.rs` + vários `.md` — reescrita de skills built-in com frontmatter YAML |

### v0.1.57 — Linux CI/CD, release .deb, updater Linux

| O quê | Detalhes |
|-------|----------|
| CI/CD Linux | `.github/workflows/release.yml` — GitHub Action para buildar e publicar `.deb` no tag push |
| permissions fix | `contents:write` adicionado ao workflow de release |
| resources fix | `resources/node` glob removido do `tauri.conf.json` (não existe em CI) |
| Updater Linux | `updater.rs` — detecta `.deb` no Linux, usa `pkexec` para instalar, paths platform-aware |
| Transcribe tmp dir | `transcribe-page.ts` — usa `os.tmpdir()` em vez de `__dirname/../tmp` (writable em Linux) |
| updater.json | Adicionada entry `linux-x86_64` com URL .deb |
| .gitignore | Ignora `sidecar/whisper-env/` |
| Linux schema | `linux-schema.json` gerado para build Linux |
| Bump versão | All 4 files → v0.1.57 |

### v0.1.58 — Linux full adaptation + transcription HTTP 500 fix

| O quê | Detalhes |
|-------|----------|
| Shell cross-platform | `terminal.rs` — detecta `cfg!(target_os)` para usar `bash` no Linux, `cmd.exe` no Windows |
| Capabilities Tauri | `default.json` — adiciona `bash` e `sh` como shells permitidos |
| Cargo config | `.cargo/config.toml` — comentados linkers Windows (não bloqueiam build Linux) |
| Updater path dev | `updater.rs` — `D:\` hardcoded → `cwd.join("updater.json")` |
| Terminal UI cross-platform | `TerminalPanel.tsx` — nova `isWindows()`, `getDefaultCwd()`, `getPathSep()`; normalizeCwd com `/`; prompt `$`/`>`; banner sem Windows; mock ls estilo Linux; erros bash-style |
| Sidecar shell cross-platform | `dev-server-manager.ts`, `agent-engine.ts`, `subagent-manager.ts` — `shell: 'cmd.exe'` → `isWin ? 'cmd.exe' : true` |
| Env vars cross-platform | `agent-engine.ts`, `subagent-manager.ts` — `set "TOOL_X=y"` → `export TOOL_X=y` no Linux |
| findstr → grep | `chat.ts` — `search_files` usa `findstr` no Windows, `grep -r` no Linux; descrição sem "PowerShell" |
| run_command shell | `chat.ts` — `execSync` com `shell: true` (pipes/complexos funcionam em ambos OS) |
| Python fallback | `whisper.ts` — `python3` no Linux, `python` no Windows |
| isWhisperAvailable shell | `whisper.ts` — `execSync` sem `shell` → adicionado `shell: true` (quebraria no Linux) |
| ffmpeg error message | `whisper.ts` — `sudo apt install` → mensagem cross-platform (winget/brew/apt/dnf) |
| ensureFfmpegInPath | `ffmpeg.ts` — função vazia → implementada com hint cross-platform |
| require() em ESM | `transcribe-page.ts` — `require('fs')` → `await import('fs')` (**causa do HTTP 500**) |
| Docs cross-platform | `audio-transcriber.md` — exemplos Windows + Linux, WHISPER_PYTHON sem path hardcoded |
| Session/Checkpoint | CHECKPOINT.md + SESSION.md atualizados |

## Estratégia de Update
- **Resource bundled**: `updater.json` aponta para PRÓXIMA versão
- **Linux**: `.deb` instalado via `pkexec dpkg -i`, arquitetura `x86_64` detectada via `uname -m`
- **Dev path**: `cwd/updater.json` (cross-platform, detectado automaticamente)
- **GitHub Releases**: updater também consulta `github.com/walacesssantos-TCX/ai-app-builder/releases`

## Comandos úteis
```bash
# Dev (Linux)
export FLUXCODEX_ROOT="/media/walace/windows 10/Projeto Fluxcodex"
cd "$FLUXCODEX_ROOT/ai-app-builder"
npm run dev            # Frontend Vite (http://localhost:1420)
cd sidecar && npm run dev  # Sidecar (http://localhost:3001)

# Build Linux
export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/ai-updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx tauri build --bundles deb

# Build Windows (PowerShell)
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\ai-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npx tauri build

# Compile check only
cargo check --manifest-path src-tauri/Cargo.toml
tsc --noEmit
```
