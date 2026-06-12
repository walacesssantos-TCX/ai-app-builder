# Skill: Audio Transcriber

Transcrição local de áudio/vídeo com geração automática de PDF formatado.

---

## Formatos suportados

| Tipo   | Extensões                        |
|--------|----------------------------------|
| Áudio  | `.mp3` `.wav` `.flac` `.ogg` `.m4a` |
| Vídeo  | `.mp4` `.mkv` `.mov` `.avi` `.webm` |

---

## Modelos Whisper disponíveis

| Modelo   | Tamanho | Precisão   | Velocidade     | Quando usar                          |
|----------|---------|------------|----------------|--------------------------------------|
| `tiny`   | 75 MB   | Básica     | Muito rápido   | Testes rápidos                       |
| `base`   | 145 MB  | Boa        | Rápido         | Áudios curtos e limpos               |
| `small`  | 460 MB  | Boa        | Moderado       | Uso geral, boa relação custo/benefício |
| `medium` | 1.5 GB  | **Alta**   | Moderado       | **Padrão recomendado**               |
| `turbo`  | 1.5 GB  | **Alta**   | Rápido         | Alternativa ao medium, mais veloz    |
| `large`  | 3 GB    | Máxima     | Lento          | Sotaques fortes, áudio ruidoso       |

> **Padrão:** `medium` — ótimo para a maioria dos casos.  
> Na **primeira execução**, o modelo é baixado automaticamente da internet.

---

## Workflow passo a passo

### Passo 1 — Instalar dependências

```bash
pip install openai-whisper reportlab --break-system-packages -q
# ffmpeg já está disponível no ambiente Claude
```

### Passo 2 — Localizar o arquivo enviado pelo usuário

```bash
ls /mnt/user-data/uploads/
```

### Passo 3 — Executar a transcrição

```bash
python /home/claude/skills/audio-transcriber/scripts/transcribe.py \
  "/mnt/user-data/uploads/NOME_DO_ARQUIVO" \
  --model medium \
  --output-dir /mnt/user-data/outputs
```

**Parâmetros opcionais:**
- `--model tiny|base|small|medium|turbo|large` — escolha o modelo (padrão: `medium`)
- `--lang pt` — força o idioma (ex: `pt`, `en`, `es`). Omitir = auto-detectado
- `--output-dir /caminho` — onde salvar o PDF (padrão: `/mnt/user-data/outputs`)

### Passo 4 — Apresentar o resultado

Após o script terminar:
1. Capture o caminho do PDF (linha `PDF_PATH=…` na saída)
2. Chame `present_files` com esse caminho
3. Exiba no chat as primeiras linhas da transcrição
4. Informe: nome do PDF, nº de palavras e nº de segmentos com timestamp

---

## O que o PDF gerado contém

- **Cabeçalho** — nome do arquivo, data/hora, modelo usado, total de palavras, duração
- **Transcrição completa** — texto corrido dividido em parágrafos legíveis
- **Segmentos com timestamp** — cada trecho com horário de início→fim (ex: `01:23 → 01:41`)
- **Rodapé** — nota de geração automática

---

## Seleção de modelo por situação

| Situação                                | Modelo sugerido |
|-----------------------------------------|-----------------|
| Teste rápido / protótipo                | `tiny` ou `base` |
| Reunião gravada, português claro        | `medium` ou `turbo` |
| Sotaque forte, muitos participantes     | `large`          |
| Áudio com ruído de fundo               | `large`          |
| Precisão máxima exigida                 | `large`          |

---

## Tratamento de erros comuns

**Arquivo não encontrado**
```
Erro: arquivo não encontrado → /mnt/user-data/uploads/audio.mp3
```
→ Verifique o nome exato com `ls /mnt/user-data/uploads/`

**ffmpeg não disponível**
```bash
apt-get install ffmpeg -y
```

**Sem memória RAM para `large`**
→ Use `medium` ou `turbo`.

**Idioma detectado errado**
→ Adicione `--lang pt` (ou o código correto do idioma).

---

## Localização do script

```
skills/audio-transcriber/
├── SKILL.md                    ← este arquivo
└── scripts/
    └── transcribe.py           ← script principal
```