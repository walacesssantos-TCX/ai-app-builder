# OpenSquad Sherlock Instagram

Esta skill encapsula localmente o fluxo Sherlock do OpenSquad para referencias de Instagram.

## Fontes canonicas internas

Carregue nesta ordem:
1. `references/sherlock-shared.md`
2. `references/original.md`

Use essas referencias antes de definir:
- modo de investigacao
- leitura de carousel/post/reel
- extracao de padroes de hook
- extracao de estrutura de slides
- leitura de caption e sinais editoriais

## Papel no pipeline

Use esta skill apenas quando a entrada vier de:
- URL de perfil Instagram
- URL de post Instagram
- URL de reel Instagram
- referencia explicitamente descrita como inspirada em post/carrossel do Instagram

## Ordem de uso

1. Ler `references/sherlock-shared.md`
2. Ler `references/original.md`
3. Extrair padroes da referencia
4. Encaminhar esses padroes para a skill orquestradora da peca

## Restricao

Nao consulte `opensquad-master` nem caminhos externos. Todas as referencias necessarias a esta skill estao dentro da propria pasta.