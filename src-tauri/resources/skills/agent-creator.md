# Agent + Skill Creator

Orquestra a criação completa de agentes e skills executáveis no Supabase, seguindo a arquitetura de Agent Runtime do Omentor.Studio.

## Objetivo

Gerar, validar e registrar:
1. **Agente** — `system_prompt` otimizado com XML-structured tool guidance
2. **Skill** — `body_md` (instruções para LLM) + `body_code` (código Deno executável)
3. **SQL INSERT** — migration para `agents`, `skills` e `agent_skills`
4. **Sub-Edge Function** — arquivo `skill-<slug>/index.ts` para deploy
5. **Teste cURL** — comando pronto para validar via `agent-run`

## Pré-requisitos

Antes de gerar qualquer código, ler:
- `supabase/functions/agents-chat/index.ts` — runtime atual de referência
- `supabase/functions/agent-run/index.ts` — endpoint de consumo
- `supabase/functions/_shared/skill-runner.ts` — template de sub-Edge Function
- `supabase/migrations/019_skills_body_code.sql` — schema atual de skills

## Fluxo de Execução

### 1. Coleta de Informações

Perguntar ao usuário sobre o agente e cada skill, uma por vez:

**Sobre o agente:**
- Slug do agente (ex: `template_designer`, `research`)
- Nome descritivo
- Descrição (1-2 frases explicando o que o agente faz)
- Modelo LLM (ex: `openai/gpt-4o-mini`, `anthropic/claude-3.5-sonnet`)
- Formato de resposta (`text` ou `json`)
- Precisa de contexto do projeto? (`needs_project_context`)

**Para cada skill (mínimo 1):**
- Slug (ex: `fetch-instagram-posts`, `generate-html`)
- Nome descritivo
- Descrição (o que a skill faz, quando o LLM deve chamá-la)
- A skill é comportamental (só `body_md`) ou executável (`body_code`)?
- Se executável: quais dados de entrada? Quais retorna? Precisa de API keys?

### 2. Geração do system_prompt

Usar o template `templates/system-prompt.md`. Estrutura XML obrigatória:
```xml
<role>...</role>
<task>...</task>
<tools>...</tools>
<rules>...</rules>
```

Incluir guia de quando usar cada skill. Se o agente tem skills executáveis, instruir o LLM a extrair os parâmetros corretos e interpretar o JSON de retorno.

### 3. Geração do body_md

Usar o template `templates/body-md.md`. Conteúdo:
- Propósito da skill
- Quando o LLM deve chamar esta skill (condições)
- Parâmetros disponíveis e formato esperado
- Formato do retorno e como interpretá-lo
- Exemplos de uso

### 4. Geração do body_code

Usar o template `templates/body-code.ts`. O código deve exportar:
```typescript
export async function run(
  params: Record<string, unknown>,
  env: Record<string, string>
): Promise<unknown>
```

Regras:
- `params` — dados extraídos pelo LLM do tool call
- `env` — variáveis de ambiente passadas explicitamente (nunca acessar `Deno.env` diretamente)
- Todo fetch externo deve ter tratamento de erro e timeout
- Retorno deve ser um objeto serializável (string, number, object, array)
- Nunca retornar dados sensíveis (tokens, senhas)

### 5. SQL de Inserção

Gerar migration com:
1. `INSERT INTO agents (...)` — se o agente for novo
2. `INSERT INTO skills (slug, name, description, body_md, body_code, code_timeout_ms)` — uma por skill
3. `INSERT INTO agent_skills (agent_id, skill_id)` — linkagem

Usar `ON CONFLICT (slug) DO UPDATE` para idempotência.

### 6. Sub-Edge Function

Para cada skill com `body_code`, criar arquivo:
```
supabase/functions/skill-<slug>/index.ts
```

Usar o template `_shared/skill-runner.ts` como base:
```typescript
import { serveSkill } from '../_shared/skill-runner.ts';

export async function run(params: Record<string, unknown>, env: Record<string, string>) {
  // body_code da skill aqui
}

Deno.serve(serveSkill(run));
```

### 7. Teste cURL

Gerar comando cURL para testar o agente via `agent-run`:
```bash
curl -X POST https://<project>.functions.supabase.co/agent-run \
  -H "Authorization: Bearer sk-om-v1-..." \
  -H "Content-Type: application/json" \
  -d '{"agent": "<slug>", "prompt": "<test prompt>"}'
```

## Fontes de Referência Obrigatórias

- `docs/ARQUITETURA-AGENTES-RUNTIME.md` — visão arquitetural completa
- `supabase/migrations/009_multi_agent_schema.sql` — schema agents/skills/agent_skills
- `supabase/migrations/010_seed_platform_agents.sql` — exemplos de system_prompt de agentes existentes
- `supabase/migrations/018_seed_onboarding_skills.sql` — exemplos de body_md de skills existentes
- `supabase/functions/_shared/skill-runner.ts` — contrato da sub-Edge Function

## Regras de Qualidade

- Todo `body_code` deve exportar `run(params, env)` — assinatura canônica
- `body_md` deve conter: propósito, condições de uso, parâmetros, formato de retorno, exemplos
- `system_prompt` deve usar XML estruturado (`<role>`, `<task>`, `<tools>`, `<rules>`)
- Nunca hardcode tokens ou senhas em `body_code` — usar `env` passado explicitamente
- Toda skill nova ganha `code_timeout_ms = 5000` por padrão (sobrescrever se necessário)
- SQL gerado deve ser idempotente (`ON CONFLICT DO UPDATE`)
- Sub-Edge Function deve importar `serveSkill` de `_shared/skill-runner.ts`

## Saída Esperada

1. **Resumo** — tabela com agente + skills criados
2. **Arquivos gerados** — lista de paths
3. **Migration SQL** — pronto para aplicar (ou aplicado via MCP)
4. **Sub-Edge Function** — pronta para deploy
5. **cURL de teste** — comando pronto para validar