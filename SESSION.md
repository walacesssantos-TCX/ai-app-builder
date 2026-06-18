# SESSION — 18/06/2026

## O que foi implementado

### Linux Full Adaptation + Transcription HTTP 500 Fix

**Motivação:** Tornar o projeto totalmente funcional em Linux (o terminal e sidecar tinham dezenas de hardcoded Windows paths/shells) e corrigir o erro HTTP 500 na página de transcrição causado por `require()` em módulo ESM.

---

## Linux Adaptation — 12 arquivos modificados

### 1. Terminal Tauri (`src-tauri/src/commands/terminal.rs`)
- **Linha 89:** `Command::new("cmd.exe")` → `cfg!(target_os)` condicional: `bash` no Linux, `cmd.exe` no Windows

### 2. Capabilities Tauri (`src-tauri/capabilities/default.json`)
- Adicionados `bash` e `sh` como shells permitidos no `shell:allow-execute`

### 3. Cargo config (`src-tauri/.cargo/config.toml`)
- Comentados os linkers Windows (`lld-link.exe`, `mingw32-gcc.exe`) — não bloqueiam build Linux

### 4. Updater dev path (`src-tauri/src/commands/updater.rs`)
- Linha 101: `"D:\\Projeto Fluxcodex\\..."` hardcoded → `cwd.join("updater.json")`

### 5. Terminal UI (`src/components/terminal/TerminalPanel.tsx`)
- **isWindows()**: função de detecção via `navigator.userAgent` + `process.platform`
- **getDefaultCwd()**: `'C:\\'` no Windows, `'/home/developer'` no Linux
- **getPathSep()**: `'\\'` no Windows, `'/'` no Linux
- **normalizeCwd()**: suporte a caminhos Unix (`/home/...`) + detecção de drive letter vs root
- **Banner**: não mostra mais "Microsoft Windows..." no Linux (mostra "Linux ... Terminal Fluxcodex")
- **Prompt**: `>` no Windows, `$` no Linux
- **Mock `ls/dir`**: formato Linux (`drwxr-xr-x`) quando isWindows() === false
- **Mock erro comando**: `'cmd' não é reconhecido` no Windows, `bash: cmd: command not found` no Linux
- **Título da sessão**: `cmd` no Windows, `bash` no Linux
- **Default CWD**: 4 ocorrências de `'C:\\'` → `getDefaultCwd()`

### 6. Dev Server Manager (`sidecar/src/services/dev-server-manager.ts`)
- Linha 65: `spawn('cmd.exe', ['/c', command])` → `isWin ? spawn('cmd.exe', ['/c', command]) : spawn('bash', ['-c', command])`

### 7. Agent Engine (`sidecar/src/services/agent-engine.ts`)
- **Linha 62:** `set "TOOL_${k}=${v}" &&` → Windows: `set ... &&`, Linux: `TOOL_${k}='${v}' `
- **Linha 70:** `shell: 'cmd.exe'` → `isWin ? 'cmd.exe' : true`

### 8. Subagent Manager (`sidecar/src/services/subagent-manager.ts`)
- **Linha 199:** mesmo fix do agent-engine para env vars
- **Linha 207:** `shell: 'cmd.exe'` → `isWin ? 'cmd.exe' : true`

### 9. Chat routes (`sidecar/src/routes/chat.ts`)
- **findstr → grep**: `search_files` usa `findstr /s /n /i` no Windows, `grep -r -n -i` no Linux
- **Descrição**: `"Execute a shell command (PowerShell on Windows)"` → `"Execute a shell command"`
- **run_command**: `execSync` sem `shell` → adicionado `shell: true` (pipes funcionam em ambos)

### 10. Skill audio-transcriber docs (`src-tauri/resources/skills/audio-transcriber.md`)
- Exemplo CLI: adicionado comando Linux (`python3 -m whisper`)
- `WHISPER_PYTHON` default: path Windows hardcoded → `python3` (Linux) / `python` (Windows)

---

## Transcription HTTP 500 Fix — 4 arquivos

### 1. `require()` em ESM (`sidecar/src/routes/transcribe-page.ts`)
- **Linha 192:** `const stream = require('fs').createReadStream(...)` → **CAUSA RAIZ DO HTTP 500**
- Sidecar usa `"type": "module"` — `require` não está disponível em módulos ESM
- Fix: `const { createReadStream } = await import('fs')`

### 2. Whisper service (`sidecar/src/services/whisper.ts`)
- **PYTHON fallback**: `'python3'` → `process.platform === 'win32' ? 'python' : 'python3'`
- **execSync shell**: adicionado `shell: true` na verificação `isWhisperAvailable()` (no Linux, sem shell, aspas são literais → ENOENT)
- **ffmpeg error msg**: `"sudo apt install ffmpeg"` → `"sudo apt install ffmpeg (Linux) ou winget install ffmpeg (Windows) ou brew install ffmpeg (macOS)"`

### 3. FFmpeg service (`sidecar/src/services/ffmpeg.ts`)
- **ensureFfmpegInPath()**: estava vazia (no-op) → agora loga hint cross-platform de instalação

### 4. Docs (`audio-transcriber.md`)
- Paths Windows removidos, exemplos cross-platform adicionados

---

## Arquivos modificados (total: 12)

```
src-tauri/src/commands/terminal.rs
src-tauri/src/commands/updater.rs
src-tauri/capabilities/default.json
src-tauri/.cargo/config.toml
src-tauri/resources/skills/audio-transcriber.md
src/components/terminal/TerminalPanel.tsx
sidecar/src/routes/transcribe-page.ts
sidecar/src/routes/chat.ts
sidecar/src/services/whisper.ts
sidecar/src/services/ffmpeg.ts
sidecar/src/services/agent-engine.ts
sidecar/src/services/subagent-manager.ts
sidecar/src/services/dev-server-manager.ts
```

## Pendências / Próximos passos sugeridos
1. Testar `npm run dev` + `npm run sidecar:dev` no Linux (verificar terminal, transcrição)
2. Corrigir assinatura do updater (signature vazia no `updater.json`)
3. Implementar fallback de provider (ex: Groq 429 → Gemini)
4. Preservar conteúdo de arquivos anexados no histórico
5. Carregar mensagens do backend ao trocar de conversa
