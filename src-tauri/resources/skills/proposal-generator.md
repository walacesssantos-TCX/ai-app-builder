# Gerador de Propostas Comerciais — Grupo Ide Apps

Esta skill gera propostas comerciais no padrão do Luan Lucas Bonadie (Grupo Ide Apps), com base em um texto de entrada que descreve o projeto. O output padrão é um **arquivo HTML** com design profissional seguindo o Design System oficial — não um documento de texto simples.

## Identidade do Prestador

Sempre assinar as propostas com:
- **Empresa:** Grupo Ide Apps
- **Responsável:** Luan Lucas Bonadie — Diretor Executivo
- **Telefone:** +55 32 99131-3371
- **Email:** luan@grupoidecomunicacao.com

---

## Workflow Completo

### Passo 1 — Analisar o Input

Leia o texto fornecido e extraia:
- **Nome do projeto / cliente**
- **Tipo de projeto:** app móvel, SaaS, automação com IA, chatbot, sistema web, mentoria, etc.
- **Objetivo principal** (problema a resolver)
- **Funcionalidades e requisitos** mencionados
- **Prazos ou urgências** citados
- **Orçamento esperado** (se mencionado)

Se informações essenciais estiverem faltando, pergunte antes de gerar.

### Passo 2 — Perguntas Inteligentes para Definir Preço e Prazo

Faça estas perguntas (via `ask_user_input_v0` quando disponível):

1. **Complexidade Técnica:** Simples / Média / Alta
2. **Método de Desenvolvimento:** Vibe Code (mais rápido) ou No-Code (mais customizado)
3. **Urgência:** Baixa / Média / Alta
4. **Tipo de Cliente:** Startup/PME / Empresa consolidada / Agência/Revenda

Consulte `references/pricing-matrix.md` para calcular o valor com base nas respostas.

**Estrutura de preços:**
- **Pequenos (até R$ 15k):** Entrada 30–40% + parcelas por fase
- **Médios (R$ 15k–40k):** Entrada 20–25% + parcelas por fase
- **Grandes (acima de R$ 40k):** Entrada fixa R$ 8k–10k + parcelas por fase

**Desconto à vista:** sempre **15%** para pagamento no cartão de crédito. Mencionar que a taxa da operadora varia conforme o número de parcelas e é acrescida ao valor.

**NUNCA** mostrar o valor total em destaque nos cards de investimento — mostrar sempre entrada + parcelas individuais.

### Passo 3 — Selecionar o Modelo de Proposta

| Tipo de Projeto | Modelo |
|---|---|
| App móvel / SaaS / Plataforma web | Sprints (quinzenais) |
| Automação com IA / Chatbot / N8N | Fases |
| Mentoria / Consultoria | Simplificado |
| Chatbot simples / Automação pequena | Direto |

Consulte `references/modelos.md` para os detalhes de cada modelo.

### Passo 4 — Gerar o HTML da Proposta

**ANTES de escrever qualquer código, leia:**
→ `references/website-design.md` — Design System completo com paleta, tipografia, CSS, componentes e regras de output.

O output é sempre um arquivo `.html` único e autocontido com:

1. **Hero** (fundo escuro `#082744`) — tag pulsante, título em Fraunces, stats na base
2. **Seções de conteúdo** numeradas com eyebrow + h2 + lead:
   - Introdução / Visão Geral
   - Escopo / Entregáveis
   - Cronograma (sprints ou fases com coluna esquerda escura)
   - Investimento (grid 2 cards — parcelado escuro + à vista claro)
   - Condições Gerais
   - Próximos Passos
3. **Footer** (fundo escuro) — brand, contato, legal

**Paleta obrigatória:** `--ink:#082744`, `--accent:#29aab1`, `--mid:#0c3c68`, `--muted:#5b7389`
**Fontes obrigatórias:** Fraunces (display) + Instrument Sans (corpo) + Instrument Mono (mono)

#### SPA Unificada (múltiplas propostas)

Se o usuário quiser todas as propostas em um único arquivo com tabs:
- Nav sticky no topo com `.tab-btn` por proposta
- Hero com `.pcard` clicáveis (um por proposta) que ativam a tab
- Panels ocultos/visíveis via JavaScript vanilla
- Script no final do `<body>` usando `activate(tabId)` — nunca inline
- Verificar `</body></html>` no fim antes de entregar

### Passo 5 — Salvar e Entregar

1. Salvar em `/mnt/user-data/outputs/proposta_[cliente]_[tipo].html`
2. Usar `present_files` para entregar ao usuário
3. Se o usuário quiser no Notion, usar MCP do Notion para criar subpágina

---

## Referências

- **`references/pricing-matrix.md`** — Matriz de preços dinâmica por tipo e complexidade
- **`references/modelos.md`** — Estrutura detalhada por Sprints, Fases, Simplificado, Direto
- **`references/website-design.md`** — **Design System completo** (ler ANTES de gerar qualquer HTML)
- **`templates/proposal_template.md`** — Template base de conteúdo

---

## Checklist Antes de Entregar

- [ ] Leu `references/website-design.md` antes de escrever o HTML
- [ ] Paleta de cores correta (ink, accent, mid, muted)
- [ ] Fontes Fraunces + Instrument Sans + Instrument Mono
- [ ] Hero com fundo escuro e grain texture
- [ ] Cards de investimento: parcelado (escuro) + à vista (claro, 15% desconto no cartão)
- [ ] Email com `&#64;` no footer
- [ ] Arquivo termina com `</body></html>` (sem truncamento)
- [ ] `present_files` chamado para entregar o arquivo