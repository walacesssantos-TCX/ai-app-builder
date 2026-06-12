# Social Posts Framework

Use esta skill quando estiver criando ou refatorando `clients/luanlucasbonadie/apps/posts-instagram/post-*.html`.

## Objective

Garantir uniformidade de posts reforcando:
- um sistema visual compartilhado (`main.css` + tokens do cliente)
- um contrato local de templates (`framework/template-contract.md`)
- um contrato local de sequencia para carrosseis (`framework/carousel-sequence-guide.md`)
- headline editavel unica por slide
- blocos reutilizaveis em vez de layouts ad-hoc

## Official Order (Non-Negotiable)

Sempre operar nesta sequencia:

1. **Design System definition**
2. **Componentizacao**
3. **Auxiliares OpenSquad internalizados**
4. **Piece creation for the end user**

Se a etapa 4 exigir uma regra visual nova, volte e atualize 1, 2 ou 3 antes.

## Mandatory Inputs

Leia estas fontes antes de gerar ou editar templates:

1. `clients/luanlucasbonadie/design-system/DESIGN.md`
2. `clients/luanlucasbonadie/design-system/tokens/core.css`
3. `clients/luanlucasbonadie/apps/posts-instagram/main.css`
4. `clients/luanlucasbonadie/apps/posts-instagram/CLAUDE.md`
5. `onboarding/design-social-media-dossier/analise.md`
6. `clients/luanlucasbonadie/apps/posts-instagram/framework/template-contract.md`
7. `clients/luanlucasbonadie/apps/posts-instagram/framework/component-library.md`
8. `clients/luanlucasbonadie/apps/posts-instagram/framework/template-catalog.md`
9. `clients/luanlucasbonadie/apps/posts-instagram/framework/carousel-sequence-guide.md`
10. `onboarding/auxiliary-skills/opensquad-image-design/SKILL.md`
11. `onboarding/auxiliary-skills/opensquad-instagram-feed/SKILL.md`
12. `onboarding/auxiliary-skills/opensquad-copywriting/SKILL.md`
13. `references/design-post-checklist.md`

Quando a referencia vier do Instagram, leia tambem:
- `onboarding/auxiliary-skills/opensquad-sherlock-instagram/SKILL.md`

## Hard Rules

1. Canvas fixo em `1080x1350`.
2. Nenhuma cor de brand hardcoded no template. Use apenas `--c-*` ou `--ds-*` conforme o modulo.
3. Headline do template = um unico `h1[data-var="headline"]` por slide.
4. Nao dividir titulo em multiplos inputs editaveis.
5. Manter `author-badge` e seus atributos de tooling quando o padrao usar assinatura.
6. Qualquer destaque textual deve usar `<span>` para herdar o gradiente.
7. Componentizacao e a base do app: a estrutura principal deve vir de `component-library.md` e de classes compartilhadas em `main.css`.
8. Se um componente necessario ainda nao existir, registrar em `component-library.md` e implementar em `main.css` antes de usar no template.
9. Manter contraste alto, legibilidade mobile e integridade vertical.
10. Se houver `data-repeat-list`, validar o pior caso default antes de concluir.
11. Para carrossel, definir o arco da sequencia antes do HTML.

## Workflow

1. Validar stage 1 inputs (`DESIGN.md`, `core.css`).
2. Validar framework local (`template-contract.md`, `component-library.md`, `template-catalog.md`, `carousel-sequence-guide.md`).
3. Carregar auxiliares OpenSquad internalizados relevantes.
4. Se for carrossel:
   - definir hook/capa
   - definir funcao de cada slide intermediario
   - definir slide final de sintese ou CTA
5. Escolher archetype local apropriado.
6. Mapear o archetype para componentes existentes da biblioteca.
7. Compor layout apenas com blocos da biblioteca.
8. Definir vars editaveis com nomes minimos e claros.
9. Rodar cheque rapido de contrato:
   - exatamente um `data-var="headline"`
   - sem `#6366f1` / `#ec4899` hardcoded
   - sem overflow vertical
   - no maximo 10 campos editaveis, exceto variacoes de lista
10. Registrar o template em `editor.js` e `framework/template-catalog.md` quando aplicavel.
11. Ao revisar templates existentes, atualizar ou consultar `framework/componentization-audit-2026-05-02.md`.

## Deliverable Format

- `post-N.html` atualizado ou criado
- opcionalmente utilitarios compartilhados em `main.css`
- atualizacao em `framework/template-catalog.md`
- no caso de carrossel, mapeamento claro da funcao de cada slide