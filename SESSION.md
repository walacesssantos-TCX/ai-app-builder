# SESSION — 18/06/2026

## O que foi implementado

### 1. Updater 404 fix + Linux-only

**Causa raiz do 404:**
- `check_github_release` não validava se o asset existia para a plataforma atual
- No Windows: release v0.1.59 só tinha `.deb` → código construía URL `.exe` falsa → 404 no download
- Fix: quando nenhum asset `.deb`/`.exe` encontrado para a plataforma, retorna `None` em vez de URL inventada

**Linux-only (decisão de projeto):**
- `updater.rs` reescrito sem `#[cfg(windows)]` — só Linux (`curl` + `pkexec dpkg/apt`)
- `tauri.conf.json`: `targets: ["deb"]` (antes `"all"`)
- `updater.json`: removido `windows-x86_64`
- Nova chave de assinatura gerada (`~/.tauri/ai-updater.key`) e secret configurado no GitHub

**Bump v0.1.60 → v0.1.61:**
- `package.json`, `Cargo.toml`, `tauri.conf.json`
- CI/CD publicou `AI.App.Builder.Studio_0.1.61_amd64.deb` (103MB) no GitHub

### 2. Whisper — fixes e otimização para música

**Bug crítico: `batch_size` inválido**
- `model.transcribe()` do faster-whisper não aceita `batch_size`
- Causava `TypeError` silencioso → exit 1 sem mensagem útil
- Fix: removido do script Python e dos args TypeScript

**Instalação do faster-whisper:**
```bash
pip3 install faster-whisper --break-system-packages
# faster-whisper-1.2.1 instalado com sucesso
```

**Pré-processamento de áudio para música:**
- ffmpeg converte para mono 16kHz + highpass=80Hz + lowpass=8kHz + dynaudnorm
- Isola frequências vocais antes de passar ao Whisper
- `preprocessAudioForTranscription()` com fallback para original se ffmpeg falhar

**Parâmetros otimizados para música:**
| Parâmetro | Antes | Depois | Motivo |
|-----------|-------|--------|--------|
| `language` | auto-detect | `'pt'` padrão | Evita alucinações em inglês |
| `condition_on_previous_text` | `True` | `False` | Evita loops de alucinação |
| `vad_filter` | — | `False` | Não corta partes da letra |
| `batch_size` | passado (inválido) | removido | Não existe nesse método |

**Seleção de modelo por duração (corrigida):**
| Duração | Modelo | Qualidade |
|---------|--------|-----------|
| ≤ 3 min | `medium` | Alta |
| 3–10 min | `base` | Média |
| > 10 min | `tiny` | Rápida |

**Erro mais detalhado:**
- Antes: "Whisper falhou... Log: (vazio)"
- Depois: mostra erro JSON do stdout Python + stderr completo

### 3. Arquivos modificados

```
src-tauri/src/commands/updater.rs    ← reescrito Linux-only
src-tauri/tauri.conf.json            ← targets deb, pubkey nova, bump
src-tauri/Cargo.toml                 ← bump 0.1.61
package.json                         ← bump 0.1.61
updater.json                         ← remove windows, aponta v0.1.62
sidecar/src/services/whisper.ts      ← batch_size fix, preprocess, music params
CHECKPOINT.md                        ← atualizado
SESSION.md                           ← este arquivo
```

**Patch instalado em produção:**
```
/tmp/whisper_patched.js →
sudo cp /tmp/whisper_patched.js "/usr/lib/AI App Builder Studio/_up_/sidecar/dist/services/whisper.js"
```

## Pendências / Próximos passos
1. Testar transcrição de música com o patch aplicado
2. Bump para v0.1.62 + publicar release com whisper.ts corrigido bundlado
3. Implementar fallback de provider (Groq 429 → Gemini)
4. Preservar conteúdo de arquivos anexados no histórico
5. Corrigir assinatura do updater (signature vazia no updater.json)
