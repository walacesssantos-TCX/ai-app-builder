# SESSION — 16/06/2026

## O que foi implementado

### v0.1.45 — Whisper local integrado + transcrição automática de áudio

**Motivação:** Permitir que a skill `audio-transcriber` e o chat transcrevam áudio localmente via Whisper (Python) sem depender de APIs externas.

### 1. Serviço Whisper (`sidecar/src/services/whisper.ts`)
- Função `transcribeBuffer(audioBuffer, fileName, options?)` — salva áudio em temp, executa `python -m whisper`, lê o `.txt` de saída, limpa temp
- Função `transcribeBase64(base64, fileName, options?)` — wrapper para base64
- Função `isWhisperAvailable()` — verifica se o Python + whisper estão instalados
- Suporte a modelos: tiny, base, small, medium, turbo, large
- Timeout de 10min para transcrições longas
- Limpeza automática de arquivos temporários

### 2. Rota Whisper (`sidecar/src/routes/whisper.ts`)
- `POST /whisper/transcribe` — aceita `{ file: base64, fileName, model?, language? }`, retorna `{ success, text, segments, duration, model, language }`
- `GET /whisper/status` — retorna `{ available, python }`

### 3. Registro no Sidecar (`sidecar/src/index.ts`)
- `registerWhisperRoutes(fastify)` registrado ao final da inicialização

### 4. Transcrição automática no context-builder (`context-builder.ts`)
- Detecta arquivos de áudio por extensão (`.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a`, `.aac`, `.opus`, `.webm`) e MIME type `audio/*`
- Se Whisper disponível: transcreve automaticamente com modelo `tiny` (rápido) e inclui transcrição no prompt do LLM
- Se Whisper indisponível: exibe mensagem sugerindo ativar a skill audio-transcriber
- Se falhar: exibe erro sem quebrar o fluxo

### 5. Skill audio-transcriber atualizada (`src-tauri/resources/skills/audio-transcriber.md`)
- Frontmatter YAML com `tools`: `transcribe_audio` e `whisper_status`
- Documentação dos 3 métodos de uso: upload no chat, API direta, CLI
- Tabela de modelos Whisper e variáveis de ambiente

### 6. Bump v0.1.44 → v0.1.45
- Cargo.toml, tauri.conf.json, updater.json, package.json, CHECKPOINT.md

### 7. Build e Release
- `cargo check` + `tsc --noEmit` sem erros
- NSIS + MSI gerados com assinatura
- Release publicado: https://github.com/walacesssantos-TCX/ai-app-builder/releases/tag/v0.1.45

## CHECKPOINT.md e SESSION.md
- CHECKPOINT.md atualizado com seção v0.1.45
- SESSION.md atualizada (esta sessão)

## Pendências / Próximos passos sugeridos
1. Testar transcrição: enviar um `.wav` ou `.mp3` no chat e verificar se a transcrição aparece no contexto
2. Ajustar modelo padrão de `medium` para `tiny` no context-builder se necessário (já configurado como tiny no preview automático)
3. Instalar modelo na primeira execução (whisper baixa automático para `~/.cache/whisper/`)
4. Considerar suporte a GPU se CUDA estiver disponível no futuro
