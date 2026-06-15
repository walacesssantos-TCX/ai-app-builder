# AI App Builder Studio — CHECKPOINT

## Versão atual
**v0.1.25** — última atualização: `2026-06-15T20:00:00Z`

## Setup
- Tauri v2 + React 18 + TypeScript + Vite + Tailwind + Zustand (persist)
- Sidecar Node.js (Fastify) em `sidecar/`, roda em `http://localhost:3001`
- Vite dev server em `http://localhost:1420`
- RTK (Rust Token Killer) ativo via hook global
- Instaladores: MSI + NSIS em `src-tauri/target/release/bundle/`
- Chave de assinatura em `~\.tauri\ai-updater.key`
- Prisma + SQLite (`aibuilder.db`) no sidecar
- Ollama removido (v0.1.19) — app 100% API-based (Groq, Anthropic, OpenAI, Gemini)
- Sidecar com log para `%TEMP%\aibuilder-sidecar.log`

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
| v0.1.24 | — | Publicado GitHub (bump para testar update from v0.1.23) |
| v0.1.25 | NSIS | **Atual** (timeout reqwest 20s + log diagnóstico updater) |

## Estratégia de Update
- **Resource bundled**: `updater.json` aponta para PRÓXIMA versão
- **Dev path**: `D:\Projeto Fluxcodex\ai-app-builder\updater.json` aponta para versão corrente
- **GitHub Releases**: updater também consulta `github.com/walacesssantos-TCX/ai-app-builder/releases`

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
