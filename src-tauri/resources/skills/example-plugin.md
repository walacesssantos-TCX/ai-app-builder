---
name: example-plugin
description: Skill de exemplo demonstrando o sistema de plugins com ferramentas customizadas
tools:
  - name: greet
    description: Saúda um usuário com uma mensagem personalizada
    exec: echo "Olá, $TOOL_USERNAME!"
    permissions: []
  - name: check_disk
    description: Verifica o espaço em disco disponível
    exec: wmic logicaldisk get size,freespace,caption
    permissions: []
priority: 1
---

# Example Plugin

Esta skill demonstra o sistema de plugins do AI App Builder Studio.

## Como usar

1. Ative esta skill no painel de skills
2. Mude para o modo **Agent**
3. O agente terá acesso às ferramentas `greet` e `check_disk`

## Ferramentas Disponíveis

As ferramentas são declaradas no frontmatter YAML e ficam automaticamente disponíveis
para o loop do agente quando a skill está ativa.

## Permissões

O campo `permissions` controla o que a ferramenta pode acessar:
- `read` — leitura de arquivos
- `write` — escrita de arquivos
- `network` — acesso à rede
- vazio — sem restrições especiais
