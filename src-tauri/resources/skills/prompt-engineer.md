# Skill de Engenharia de Prompt (Versão 2.0)

Esta skill fornece um framework **obrigatório e robusto** para a engenharia de prompts, garantindo que você crie prompts de nível profissional que geram resultados precisos, consistentes e de alta qualidade de qualquer LLM. O uso desta estrutura não é opcional; é a base para a criação de todos os prompts.

## A Estrutura Obrigatória de 6 Partes

Todo prompt DEVE ser construído seguindo esta estrutura de 6 componentes. Cada parte tem uma função crítica.

1.  **ROLE**: A persona que o LLM deve assumir.
2.  **TASK**: A entrega final e o critério de sucesso.
3.  **INPUTS / DADOS**: Os fatos e dados brutos fornecidos.
4.  **CONTEXT**: O cenário, público e objetivo prático.
5.  **SPECIFICS**: O processo de execução e o formato da saída.
6.  **NOTES**: Restrições, limites e protocolos de incerteza.

Para uma explicação detalhada, exemplos e a lógica por trás de cada componente, **leia o guia de referência obrigatório antes de continuar**: `/home/ubuntu/skills/prompt-engineer/references/prompt_structure.md`.

## Fluxo de Trabalho Principal para Criação de Prompts

Siga estes passos sequenciais para construir um prompt robusto do zero.

1.  **Defina o Objetivo Final**: Comece com o fim em mente. Qual é o resultado perfeito? Use isso para definir a seção **TASK**.

2.  **Preencha a Estrutura de 6 Partes**: Trabalhe sistematicamente através de cada uma das 6 seções (ROLE, TASK, INPUTS, CONTEXT, SPECIFICS, NOTES), preenchendo cada uma com o máximo de detalhes possível. Consulte `prompt_structure.md` para orientação.

3.  **Incorpore Técnicas Avançadas como Implementações da Estrutura**: As técnicas avançadas não são truques isolados; são implementações formais de partes da nossa estrutura.
    -   Precisa de um raciocínio passo a passo? Use **Chain-of-Thought** para detalhar o `SPECIFICS -> Processo de execução`.
    -   O formato de saída é complexo? Use **Few-Shot Prompting** para exemplificar o `SPECIFICS -> Formato de saída`.
    -   A tarefa requer conhecimento externo? Use **Retrieval-Augmented Generation (RAG)** para popular a seção `INPUTS / DADOS`.
    -   A precisão é crítica? Use **Self-Correction** para implementar a `NOTES -> Validação final`.
    -   Para um guia detalhado sobre estas e outras técnicas, **leia `/home/ubuntu/skills/prompt-engineer/references/advanced_techniques.md`**.

4.  **Execute e Refine**: Teste o prompt e use o fluxo de trabalho de refinamento abaixo para diagnosticar e corrigir quaisquer problemas.

## Fluxo de Trabalho de Refinamento de Prompt

Use a estrutura de 6 partes como uma ferramenta de diagnóstico para prompts existentes.

1.  **Analise a Saída do LLM**: Identifique a falha.
2.  **Mapeie a Falha para a Estrutura**: Encontre a seção correspondente da estrutura que, se melhorada, corrigiria o problema.

| Se o Problema é... | ... a Causa Provável é uma Fraqueza na Seção... |
| :--- | :--- |
| A resposta é factualmente incorreta ou "alucinada". | **INPUTS / DADOS** (faltam dados) ou **NOTES** (falta protocolo de incerteza). |
| O formato da saída está errado ou inconsistente. | **SPECIFICS -> Formato de saída** (não está claro ou prescritivo o suficiente). |
| O tom ou estilo está inadequado para o público. | **ROLE** ou **CONTEXT** (persona ou público-alvo mal definidos). |
| A resposta é superficial ou não resolve o problema. | **TASK** (critério de sucesso mal definido) ou **SPECIFICS -> Qualidade** (faltam itens obrigatórios). |
| O raciocínio do modelo é falho ou ilógico. | **SPECIFICS -> Processo de execução** (faltam etapas claras ou checagens). |

3.  **Reforce a Seção Relevante**: Melhore a seção identificada com mais detalhes, exemplos ou técnicas avançadas.
4.  **Re-teste o Prompt Refinado**: Execute o prompt modificado e avalie se o problema foi resolvido. Repita o ciclo se necessário.