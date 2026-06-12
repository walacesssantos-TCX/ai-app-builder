# Atualização: Sistema de Auto-Update (Updater)

## Data
09/06/2026

## O que foi implementado

### 1. Plugin Tauri Updater (Rust)
- `src-tauri/Cargo.toml`: Adicionado `tauri-plugin-updater = "2"` e `tauri-plugin-process = "2"`
- `src-tauri/src/lib.rs`: Registrados plugins `.plugin(tauri_plugin_updater::Builder::new().build())` e `.plugin(tauri_plugin_process::init())`

### 2. Configuração do Updater
- `src-tauri/tauri.conf.json`: Adicionado `plugins.updater` com:
  - `active: true` — updater ativo
  - `dialog: true` — exibe diálogo nativo se houver erro
  - `pubkey` — chave pública gerada para assinar updates
  - `endpoints` — URL do manifest JSON (GitHub Releases)

### 3. Permissões
- `src-tauri/capabilities/default.json`: Adicionadas permissões `updater:default`, `updater:allow-check`, `updater:allow-download-and-install`

### 4. Componente UpdateSection (Frontend)
- `src/components/settings/UpdateSection.tsx`: Novo componente com 6 estados:
  - `idle` — estado inicial
  - `checking` — spinner enquanto verifica
  - `available` — exibe versão, notas, botão de download
  - `downloading` — barra de progresso
  - `uptodate` — confirmação verde
  - `error` — mensagem de erro em vermelho

### 5. Aba "Atualizar" no SettingsPanel
- `src/components/settings/SettingsPanel.tsx`: Adicionada tab `update` com ícone `RefreshCw` e label "Atualizar"

### 6. Dependências npm
- `@tauri-apps/plugin-updater` — API `check()`
- `@tauri-apps/plugin-process` — API `relaunch()` pós-instalação

### 7. Chave de Assinatura
- Gerada em `~/.tauri/ai-updater.key` (privada) e `.key.pub` (pública)
- Sem senha (gerada com `--ci`)
- A chave pública está configurada em `tauri.conf.json`

## Como usar

### Para desenvolver/testar localmente:
1. Faça as alterações no código
2. Rode `npx tauri build` para gerar o `.exe` + instalador
3. O build gera também os bundles assinados (`.msi`, `.exe`)
4. Faça upload dos arquivos e do `updater.json` para o GitHub Releases

### Estrutura do manifest `updater.json`:
```json
{
  "version": "0.1.1",
  "notes": "Novas funcionalidades",
  "pub_date": "2026-06-09T20:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/fluxcodex/ai-app-builder/releases/download/v0.1.1/AI.App.Builder.Studio_0.1.1_x64-setup.exe"
    }
  }
}
```

### Variáveis de ambiente para build assinado:
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$env:USERPROFILE\.tauri\ai-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npx tauri build
```

## Arquivos modificados
- `src-tauri/Cargo.toml` — +2 dependências
- `src-tauri/src/lib.rs` — +2 plugins registrados
- `src-tauri/tauri.conf.json` — +seção `plugins.updater`
- `src-tauri/capabilities/default.json` — +3 permissões
- `src/components/settings/UpdateSection.tsx` — **novo**
- `src/components/settings/SettingsPanel.tsx` — +tab "Atualizar"

## Arquivo de chave
- `~/.tauri/ai-updater.key` — **NÃO COMMITAR** (privada)
- `~/.tauri/ai-updater.key.pub` — já inline em `tauri.conf.json`

## Próximos passos
1. Publicar primeira release no GitHub com o instalador e `updater.json`
2. Testar fluxo completo: build → upload → check → download → install → relaunch
3. Considerar usar GitHub Actions para automatizar builds e publicação de updates
4. Adicionar verificação periódica automática (ex: ao iniciar o app ou a cada X horas)
5. Melhorar o cálculo de progresso do download (o campo `downloadedBytes` não é exposto publicamente na API)
