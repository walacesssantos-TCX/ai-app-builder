---
name: audio-transcriber
description: Transcrição local de áudio usando Whisper (Python) — integrado ao sidecar do AI App Builder Studio. Aceita upload de arquivos WAV, MP3, FLAC, OGG, M4A, AAC e retorna transcrição com timestamps.
tools:
  - name: transcribe_audio
    description: Transcreve um arquivo de áudio usando Whisper local. Envia o arquivo via POST /whisper/transcribe e retorna o texto completo.
    exec: echo "Use o endpoint interno do sidecar: POST http://127.0.0.1:3001/whisper/transcribe com { file: <base64>, fileName: <nome>, model: <modelo> }"
    permissions: []
  - name: whisper_status
    description: Verifica se o Whisper está disponível e qual versão do Python está configurada
    exec: echo "Use GET http://127.0.0.1:3001/whisper/status"
    permissions: []
---
# Skill: Audio Transcriber

Transcrição local de áudio usando **Whisper (openai-whisper)** instalado localmente.
Integrada diretamente ao sidecar do AI App Builder Studio — sem dependência de APIs externas.

## Como usar

### Método 1 — Upload direto no chat (recomendado)

1. Anexe o arquivo de áudio no chat (WAV, MP3, FLAC, OGG, M4A, AAC)
2. O **context-builder** detecta automaticamente o arquivo de áudio e chama o Whisper
3. A transcrição aparece no contexto do LLM como texto — a IA responde com base no conteúdo

### Método 2 — Chamada direta à API

Se precisar transcrever programaticamente:

```bash
# Verificar status do Whisper
curl http://127.0.0.1:3001/whisper/status

# Transcrever (file = base64 do áudio)
curl -X POST http://127.0.0.1:3001/whisper/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "file": "<base64>",
    "fileName": "audio.wav",
    "model": "medium"
  }'
```

### Método 3 — Linha de comando direta

```powershell
python -m whisper "C:\caminho\audio.mp3" --model medium --output_format txt
```

## Modelos Whisper disponíveis

| Modelo   | Tamanho | Precisão | Velocidade | Quando usar |
|----------|---------|----------|------------|-------------|
| `tiny`   | 75 MB   | Básica   | Muito rápido | Testes, preview automático |
| `base`   | 145 MB  | Boa      | Rápido     | Áudios curtos e limpos |
| `small`  | 460 MB  | Boa      | Moderado   | Uso geral |
| `medium` | 1.5 GB  | **Alta** | Moderado   | **Padrão recomendado** |
| `turbo`  | 1.5 GB  | **Alta** | Rápido     | Alternativa rápida ao medium |
| `large`  | 3 GB    | Máxima   | Lento      | Sotaques fortes, áudio ruidoso |

> **Nota:** O modelo é baixado automaticamente na primeira execução para `~/.cache/whisper/`.
> O Whisper roda em CPU (sem GPU) — modelos maiores levam mais tempo.

## Configuração

O sidecar usa estas variáveis de ambiente (opcionais):

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `WHISPER_PYTHON` | `C:\Users\walace\AppData\Local\Python\pythoncore-3.14-64\python.exe` | Caminho do Python com Whisper instalado |
| `WHISPER_MODEL` | `medium` | Modelo padrão para transcrições |

## Integração automática

Quando você envia um arquivo de áudio no chat:

1. **context-builder.ts** detecta a extensão (`.wav`, `.mp3`, etc.) ou MIME type `audio/*`
2. Se Whisper estiver disponível, chama `transcribeBuffer()` — que salva em temp, executa Whisper, lê o `.txt` de saída
3. A transcrição é incluída no prompt do LLM como texto formatado com metadados
4. O LLM vê o conteúdo completo do áudio e pode responder com base nele

## Formato de saída no contexto

```
### 🎤 audio.mp3 (transcrito via Whisper)
- Modelo: tiny
- Idioma: auto
- Duração da transcrição: 12s
- Segmentos: 8

**Transcrição:**
...
```
