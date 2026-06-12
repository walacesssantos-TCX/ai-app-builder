# Skill de Geração de Layouts de Post

Use esta skill quando o usuário pedir um novo template de post (Instagram ou peça social equivalente) com base em:
- imagem de referência anexada, ou
- descrição textual/prompt.

Esta skill e a orquestradora principal para criacao de:
- `post-estatico`
- `carrossel`
- `capa`
- `slide`

## Objetivo

Gerar layouts novos com consistência visual real:
1. Design system do cliente primeiro
2. Componentização depois
3. Peça final por último
4. Auxiliares OpenSquad internalizados como apoio obrigatório do pipeline

## Entradas esperadas

- Cliente alvo (ex: `luanlucasbonadie`)
- Referência visual (imagem/URL/descrição) ou prompt textual
- Tipo de peça (`post-estatico`, `carrossel`, `slide`, `capa`, `cta`)
- Quantidade de variações (opcional)

## Fontes obrigatórias antes de criar layout

1. `clients/<client>/design-system/DESIGN.md`
2. `clients/<client>/design-system/tokens/core.css`
3. `clients/<client>/apps/posts-instagram/framework/component-library.md`
4. `clients/<client>/apps/posts-instagram/framework/template-catalog.md`
5. `clients/<client>/apps/posts-instagram/framework/template-contract.md`
6. `clients/<client>/apps/posts-instagram/framework/carousel-sequence-guide.md`
7. `onboarding/design-social-media-dossier/analise.md`
8. `onboarding/auxiliary-skills/opensquad-image-design/SKILL.md`
9. `onboarding/auxiliary-skills/opensquad-instagram-feed/SKILL.md`
10. `onboarding/auxiliary-skills/opensquad-copywriting/SKILL.md`
11. `onboarding/auxiliary-skills/opensquad-social-networks-publishing/SKILL.md`
12. `onboarding/auxiliary-skills/social-posts-framework/SKILL.md`

Se algum item estiver ausente, declarar explicitamente a limitação antes de criar.

## Auxiliares mandatórios

Esta skill nao depende mais de `opensquad-master`.
As regras herdadas do OpenSquad foram internalizadas em skills auxiliares locais:

- `onboarding/auxiliary-skills/opensquad-image-design`
- `onboarding/auxiliary-skills/opensquad-instagram-feed`
- `onboarding/auxiliary-skills/opensquad-copywriting`
- `onboarding/auxiliary-skills/opensquad-social-networks-publishing`
- `onboarding/auxiliary-skills/opensquad-sherlock-instagram`
- `onboarding/auxiliary-skills/social-posts-framework`

Use esses auxiliares como apoio obrigatorio:
- Sempre: `opensquad-image-design`
- Sempre: `opensquad-instagram-feed`
- Sempre que houver headline, subhead, CTA ou copy por slide: `opensquad-copywriting`
- Sempre que a logica da peca depender de publicacao, save/share ou adequacao de CTA para rede social: `opensquad-social-networks-publishing`
- Sempre que a tarefa envolver criacao, refactor ou normalizacao estrutural de `post-*.html`: `social-posts-framework`
- Quando a referencia vier do Instagram: `opensquad-sherlock-instagram`

## Fluxo de execução

1. Ler o design system do cliente.
2. Ler tokens, component library, template catalog e dossie.
3. Ler `template-contract.md` e `carousel-sequence-guide.md` quando houver carrossel ou sequencia de slides.
4. Ler `opensquad-image-design`.
5. Ler `opensquad-instagram-feed`.
6. Ler `opensquad-copywriting` quando houver texto estrutural.
7. Ler `opensquad-social-networks-publishing` quando a decisao da peca depender de distribuicao ou CTA de publicacao.
8. Ler `social-posts-framework` sempre que houver implementacao ou refactor de template.
9. Quando a referencia vier do Instagram, ler `opensquad-sherlock-instagram` e extrair os padroes antes do brief.
10. Interpretar a intenção visual e editorial da referência/prompt (hierarquia, contraste, ritmo, densidade, clima, hook, CTA, progressao entre slides).
11. Mapear essa intenção para tokens e componentes existentes do cliente.
12. Escolher o padrão mais próximo no `template-catalog.md`.
13. Preencher o brief em `references/layout-brief-template.md`.
14. Gerar o template HTML (ex: `post-N.html` ou sequencia de slides) usando:
   - um único bloco de H1 editável (nunca H1 quebrado em múltiplos inputs)
   - zero hardcode de cor/fonte fora de tokens
   - classes de componentes reutilizáveis
   - composição que respeite a altura útil do canvas final (`1080x1350` no post 4:5), sem deixar CTA, badge ou bloco final cortados
   - em layouts com `data-repeat-list`, validar o pior caso padrão da peça antes de concluir (contagem default precisa caber sem overflow)
15. Validar checklist de uniformidade antes de concluir.

## Modo carrossel

Quando o tipo de peca for `carrossel`, esta skill deve tratar a sequencia de slides como objeto de primeira classe.

Antes de gerar qualquer HTML, defina:
- funcao de cada slide
- arco narrativo do carrossel
- slide 1 como hook/capa
- ultimo slide como CTA
- consistencia visual e textual entre slides
- densidade de conteudo por slide dentro do canvas do projeto

Se a referencia vier de um carrossel do Instagram, use `opensquad-sherlock-instagram` antes do brief para extrair padroes de progressao, ritmo e estrutura.

## Regras de qualidade

- Priorizar consistência sobre novidade.
- Não usar fonte de brand/logo em H1 se o design system definir isso como exceção.
- Não criar componentes visuais fora da biblioteca sem registrar no framework.
- Sempre documentar qual padrão do dossiê foi aplicado no topo do `post-N.html`.
- Tratar espaço vertical como restrição de produto, não como ajuste cosmético: a peça precisa respirar e continuar íntegra no quadro 3:4/4:5 do editor.
- Se a peça depender de remoção manual de itens para caber, o layout ainda não está pronto.
- Para `carrossel`, nao gerar slide isolado sem arco de sequencia definido.
- Para referencia Instagram, nao pular a leitura de `opensquad-sherlock-instagram`.

## Saída esperada

- Arquivo(s) `post-N.html` ou sequencia de slides gerado(s)
- Resumo curto com:
  - padrão aplicado,
  - componentes usados,
  - tokens críticos utilizados,
  - auxiliares OpenSquad usados,
  - eventuais gaps de design system/component library.

## Template de prompt interno

Use `templates/prompt-layout-generation.md` para estruturar prompts de criação/refino quando necessário.