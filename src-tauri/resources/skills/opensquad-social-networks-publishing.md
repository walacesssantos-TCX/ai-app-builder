# OpenSquad Social Networks Publishing

Esta skill encapsula localmente o artefato de publicacao social do OpenSquad.

## Fonte canonica interna

Carregue `references/original.md` quando for necessario avaliar:
- adequacao de CTA ao contexto de publicacao
- requisitos operacionais da plataforma
- consistencia entre criacao e distribuicao
- necessidade de preview, confirmacao ou adaptacao por rede

## Papel no pipeline

Use esta skill quando a geracao da peca depender de:
- logica de publicacao
- coerencia de CTA com distribuicao
- adaptacao para rede social especifica
- criterio de save/share/comment

## Ordem de uso

1. Ler o tipo de peca e objetivo
2. Ler `references/original.md`
3. Aplicar os criterios de publicacao apenas na camada de orientacao da peca

## Restricao

Nao consulte `opensquad-master` nem caminhos externos. A referencia local em `references/original.md` e a unica fonte desta skill.