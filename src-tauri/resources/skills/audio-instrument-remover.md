# Audio Instrument Remover

Remove instrumentos específicos de arquivos de áudio usando separação de fontes com Demucs (htdemucs_6s).

## Fluxo obrigatório

Siga SEMPRE estas etapas na ordem:

1. **Localizar o arquivo** → verificar uploads do usuário
2. **Instalar dependências** → demucs + ffmpeg + librosa
3. **Rodar separação** → gerar os 6 stems
4. **Analisar stems** → detectar instrumentos presentes com RMS
5. **Perguntar ao usuário** → qual instrumento remover + formato de saída
6. **Mixar stems restantes** → sem o instrumento escolhido
7. **Entregar arquivo** → com `present_files`

---

## Passo 1 — Localizar o arquivo

```python
import os
uploads = os.listdir('/mnt/user-data/uploads/')
# Procurar por arquivos de áudio: .mp3 .wav .flac .ogg .m4a .aac
```

Se não encontrar arquivo de áudio, perguntar ao usuário para enviar o arquivo.

---

## Passo 2 — Instalar dependências

```bash
pip install demucs --break-system-packages -q
pip install librosa soundfile --break-system-packages -q
apt-get install -y ffmpeg -qq
```

> Demucs é pesado (~500MB). Informar ao usuário que a instalação pode levar alguns minutos na primeira vez.

---

## Passo 3 — Separar o áudio com Demucs

```bash
python -m demucs \
  --model htdemucs_6s \
  --out /home/claude/stems \
  --mp3 \
  "<caminho_do_audio>"
```

O modelo `htdemucs_6s` gera 6 stems:
- `drums` — bateria e percussão
- `bass` — baixo
- `vocals` — voz principal e backing vocals
- `guitar` — guitarra e violão
- `piano` — piano e teclados
- `other` — demais instrumentos (cordas, sopros, sintetizadores, etc.)

Os stems ficam em: `/home/claude/stems/htdemucs_6s/<nome_do_arquivo>/`

---

## Passo 4 — Detectar instrumentos presentes

Use o script `scripts/analyze_stems.py` para analisar quais stems têm conteúdo significativo:

```bash
python /home/claude/audio-instrument-remover/scripts/analyze_stems.py \
  "/home/claude/stems/htdemucs_6s/<nome_sem_extensao>"
```

O script retorna um JSON com os stems detectados e seus níveis de energia em dB.

**Limiar de detecção**: stems com energia RMS acima de -40 dB são considerados presentes.

---

## Passo 5 — Interagir com o usuário

Apresentar a lista de instrumentos detectados e perguntar:

```
🎵 Analisei o áudio e identifiquei os seguintes instrumentos:

✅ Bateria (drums)
✅ Baixo (bass)  
✅ Voz (vocals)
✅ Guitarra (guitar)
❌ Piano — não detectado
✅ Outros instrumentos (other)

Qual instrumento você quer remover?
(Você pode escolher mais de um)

E qual formato de saída prefere?
• MP3 (menor tamanho)
• WAV (sem compressão)
• FLAC (compressão sem perda)
```

---

## Passo 6 — Mixar stems restantes

Use o script `scripts/mix_stems.py` para mixar todos os stems EXCETO o selecionado:

```bash
python /home/claude/audio-instrument-remover/scripts/mix_stems.py \
  --stems-dir "/home/claude/stems/htdemucs_6s/<nome>" \
  --remove "vocals,drums" \
  --output "/mnt/user-data/outputs/<nome>_sem_vocals.mp3" \
  --format mp3
```

---

## Passo 7 — Entregar o arquivo

Use `present_files` para entregar o resultado ao usuário. Informar:
- Quais instrumentos foram removidos
- Formato e qualidade do arquivo
- Tamanho aproximado

---

## Comportamentos esperados

### Múltiplos instrumentos
O usuário pode pedir para remover mais de um instrumento. Aceitar listas como "voz e bateria" ou "vocals e drums".

### Stem "other"
O stem `other` captura instrumentos que não se encaixam nas 5 categorias principais. Explicar ao usuário que inclui cordas, sopros, sintetizadores, etc.

### Arquivo muito grande (>10 min)
Avisar que o processamento pode levar mais tempo. Usar `--segment 10` no demucs para processar em segmentos se necessário.

### Formatos de saída
- `mp3`: bitrate 320kbps com `-b:a 320k`
- `wav`: PCM 16-bit ou 24-bit
- `flac`: compressão nível 8

### Qualidade do resultado
A qualidade da separação depende do áudio original. Músicas com instrumentos muito sobrepostos podem ter artefatos. Avisar o usuário se a separação parecer de baixa qualidade.

---

## Mensagens ao usuário

- Durante instalação: `"⏳ Instalando ferramentas de separação de áudio... pode levar 1-2 minutos."`
- Durante separação: `"🔄 Separando as faixas de áudio com IA... isso pode levar alguns minutos dependendo da duração."`
- Ao finalizar: `"✅ Pronto! O áudio sem [instrumento] está disponível para download."`