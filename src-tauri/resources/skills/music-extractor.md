# Music Extractor

Separa automaticamente múltiplas músicas contidas em um único arquivo de vídeo ou áudio,
entregando cada faixa como MP3 individual na pasta **`master Extração`**.

---

## O que esta skill faz

1. **Aceita qualquer formato** — vídeo (MP4, MKV, AVI, MOV, WEBM, FLV…) ou áudio (MP3, WAV, FLAC, OGG, M4A, AAC…)
2. **Detecta fronteiras** entre músicas usando dois métodos combinados:
   - **Silêncio** — detecta pausas entre faixas (ideal para compilações com espaços)
   - **Espectral** — analisa mudanças de timbre/harmonia com `librosa` (ideal para faixas sem pausa)
3. **Exporta em MP3** — cada faixa vira um arquivo `<nome_base>_01.mp3`, `_02.mp3`, etc.
4. **Entrega na pasta** `master Extração` criada ao lado do arquivo original

---

## Dependências

Instaladas automaticamente se ausentes:

```
ffmpeg         (sistema — deve estar instalado: sudo apt install ffmpeg)
librosa        (pip install librosa --break-system-packages)
pydub          (pip install pydub --break-system-packages)
scipy          (pip install scipy --break-system-packages)
numpy          (pip install numpy --break-system-packages)
```

---

## Fluxo de trabalho (passo a passo)

### ETAPA 0 — Verificar dependências

```bash
which ffmpeg || echo "INSTALAR: sudo apt install ffmpeg"
python3 -c "import librosa, scipy" 2>/dev/null || \
  pip install librosa scipy pydub --break-system-packages -q
```

### ETAPA 1 — Identificar o arquivo do usuário

O usuário pode:
- Fazer upload direto → está em `/mnt/user-data/uploads/<nome>`
- Informar um caminho → usar o caminho fornecido

```bash
ls /mnt/user-data/uploads/   # listar uploads disponíveis
```

### ETAPA 2 — Executar o extrator

```bash
python3 /mnt/skills/user/music-extractor/scripts/extract_musics.py \
  "<CAMINHO_DO_ARQUIVO>" \
  [--method auto|silence|spectral] \
  [--silence-db -45] \
  [--silence-dur 1.5] \
  [--min-segment 30] \
  [--bitrate 320k] \
  [--output-dir "<PASTA_SAIDA>"] \
  [--name "<NOME_BASE>"]
```

**Parâmetros principais:**

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| `--method` | `auto` | `auto` tenta silêncio primeiro; se < 2 faixas, usa espectral |
| `--silence-db` | `-45` | Limiar em dB para considerar silêncio (mais negativo = mais sensível) |
| `--silence-dur` | `1.5` | Duração mínima do silêncio entre músicas (segundos) |
| `--min-segment` | `30` | Descarta segmentos menores que X segundos |
| `--bitrate` | `320k` | Qualidade do MP3: `128k`, `192k`, `256k`, `320k` |
| `--output-dir` | `./master Extração` | Pasta de destino (criada automaticamente) |
| `--name` | nome do arquivo | Prefixo das faixas exportadas |

### ETAPA 3 — Apresentar os resultados

Após a execução, apresentar os arquivos gerados:

```bash
ls -lh "<PASTA_SAIDA>"/*.mp3
```

Depois usar `present_files` para entregar os arquivos ao usuário,
**ou** informar o caminho da pasta `master Extração` para download.

---

## Cenários e ajustes

### Compilação / coletânea (músicas separadas por pausa)
```bash
# Silêncio curto de 0.5s é suficiente
python3 .../extract_musics.py "album.mp3" --method silence --silence-dur 0.5
```

### Live / gravação ao vivo (sem pausas entre músicas)
```bash
# Usar análise espectral + segmentos mais longos
python3 .../extract_musics.py "show_ao_vivo.mp4" --method spectral --min-segment 120
```

### Faixas muito silenciosas ou gravação de baixa qualidade
```bash
# Aumentar sensibilidade do silêncio
python3 .../extract_musics.py "gravacao.wav" --method silence --silence-db -35
```

### Forçar saída em pasta específica
```bash
python3 .../extract_musics.py "video.mp4" --output-dir "/home/usuario/Músicas"
```

---

## Estrutura de saída

```
master Extração/
├── nome_do_arquivo_01.mp3   ← Música 1
├── nome_do_arquivo_02.mp3   ← Música 2
├── nome_do_arquivo_03.mp3   ← Música 3
└── ...
```

---

## Tratamento de erros comuns

| Erro | Causa provável | Solução |
|------|---------------|---------|
| `ModuleNotFoundError: librosa` | Dependência não instalada | `pip install librosa scipy --break-system-packages` |
| Apenas 1 faixa extraída | Músicas sem pausa ou limiar errado | Use `--method spectral` ou ajuste `--silence-db` |
| Faixas muito curtas | `--min-segment` muito baixo | Aumente para `60` ou `120` |
| Arquivo de entrada não encontrado | Caminho errado | Verificar com `ls /mnt/user-data/uploads/` |
| `ffmpeg` não encontrado | ffmpeg não instalado | `sudo apt install ffmpeg` |

---

## Notas importantes para Claude

- **Sempre perguntar** se o usuário tem preferências de bitrate antes de executar (padrão 320k é recomendado)
- **Informar o progresso** — o script imprime cada etapa; repasse ao usuário
- **Se apenas 1 faixa for detectada**, perguntar ao usuário se quer tentar outro método ou ajustar parâmetros
- **Arquivos grandes** (>1GB de vídeo) podem demorar — informar ao usuário
- O script **cria a pasta `master Extração`** automaticamente; não é necessário criá-la antes
- Após a execução, **sempre usar `present_files`** para entregar os MP3s ao usuário