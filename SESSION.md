# SESSION — 15/06/2026

## O que foi implementado

### 1. Análise e Correção do Sidecar Offline (v0.1.20)
Diagnóstico completo do problema "sidecar nunca conecta" — 6 causas raiz identificadas e corrigidas:

**Causas encontradas:**
1. `Stdio::null()` em stdout/stderr — sidecar era uma caixa-preta, erros de startup invisíveis
2. Processo morto ficava preso no `Mutex<Option<Child>>` — impedia restart
3. Health check de apenas 4s — insuficiente para Prisma migration (pode levar 10-15s)
4. Race condition: `lib.rs` spawn auto + frontend chamava `start_sidecar` concorrentemente
5. `retry()` no frontend chamava `start_sidecar` sem matar o processo morto primeiro
6. Sem diagnóstico pós-facto — nenhum log disponível para debug

**Correções no Rust (`sidecar.rs`):**
- Redirect stdout/stderr do sidecar para `%TEMP%\aibuilder-sidecar.log` (em vez de `Stdio::null()`)
- `try_wait()` no início de `start_sidecar` — se child morreu, limpa o mutex e recria
- Health check aumentado de 4s (20×200ms) para 15s (50×300ms)
- `is_sidecar_running()` agora verifica child process + TCP, não só TCP
- Função `log_to_file()` com timestamp para registrar cada passo do startup

**Correções no Frontend (`useSidecarStatus.ts`):**
- Delay de 2s antes da primeira checagem — dá tempo do auto-start do `lib.rs`
- `retry()` agora chama `stop_sidecar()` antes de `start_sidecar()` — elimina processo zumbi
- Timeout de conexão aumentado de 30s para 45s

**Correções no Sidecar (`sidecar/src/index.ts`):**
- Logs detalhados de migration: caminhos, tamanho do DB, output do Prisma
- Mensagem `EADDRINUSE` específica com instrução se porta 3001 ocupada
- Handlers globais `uncaughtException` + `unhandledRejection`

**Correção de bug preexistente (`capabilities/default.json`):**
- `process:allow-relaunch` não existe na API do Tauri — substituído por `process:allow-restart`

### 2. CHECKPOINT.md e SESSION.md atualizados
- Versão bump para v0.1.20
- Seções v0.1.19 e v0.1.20 adicionadas ao histórico
- Informações desatualizadas (Ollama, qwen3.5) removidas
- Documentação do novo log sidecar em `%TEMP%`

## Pendências / Próximos passos sugeridos
1. Testar o app em dev: `npm run dev` + sidecar `npm run dev` — verificar `%TEMP%\aibuilder-sidecar.log`
2. Se ainda houver falha, o log mostrará exatamente onde (migration, módulo faltando, porta ocupada)
3. Buildar versão de produção: `npx tauri build` com `TAURI_SIGNING_PRIVATE_KEY_PATH`
4. Publicar release v0.1.20 no GitHub com instalador assinado
