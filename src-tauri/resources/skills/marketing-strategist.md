# Skill: Estrategista de Marketing Digital

Esta skill fornece um fluxo de trabalho estruturado para converter informações brutas e desordenadas de um cliente em um plano de marketing digital integrado, acionável e focado em conversão através de uma Linha Editorial Avançada.

O processo é dividido em 5 fases sequenciais. Siga cada fase na ordem correta para garantir um resultado robusto e estratégico.

## Fase 1: Coleta de Informação e Reunião Estratégica

**Objetivo:** Extrair os insights fundamentais de todas as fontes de dados brutos fornecidas pelo usuário ou conduzir a extração de dados com o cliente.

1.  **Reúna os Dados:** Certifique-se de que todos os materiais brutos estão disponíveis no ambiente.
2.  **Conduza a Reunião (Se necessário):** Caso os dados não estejam completos, utilize o `references/01a_reuniao_estrategica_template.md` para guiar o cliente através de perguntas sobre História, Posicionamento, Público, Especialidades e Bio.
3.  **Analise e Extraia:** Leia o guia em `references/01_information_gathering.md` para processar os dados extraindo Objetivos, Público-Alvo, Proposta Única de Valor (PUV), Produtos/Serviços, História Pessoal e Identidade de Marca.
4.  **Sintetize:** Crie um documento de análise preliminar consolidando os pontos extraídos.

## Fase 2: Construção do Perfil Estratégico

**Objetivo:** Criar um documento fundamental que servirá como a única fonte da verdade para a identidade, posicionamento e funil de consciência do cliente.

1.  **Use o Template:** Abra o template `references/02_strategic_profile_template.md`.
2.  **Preencha o Perfil:** Preencha cada seção do template com as informações sintetizadas na Fase 1. Preste atenção especial aos marcos de Storytelling, características de Personalidade e ao mapeamento de Dores (Topo), Desejos (Meio) e Objeções (Fundo). Este documento, `perfil_estrategico.md`, será a base para todas as fases seguintes.

## Fase 3: Desenvolvimento das Estratégias de Plataforma (Linha Editorial)

**Objetivo:** Detalhar o plano de ação e a Linha Editorial Avançada para cada ponto de contato digital escolhido pelo cliente.

1.  **Selecione as Plataformas:** Com base nos objetivos do cliente, identifique quais plataformas serão trabalhadas (ex: Instagram, YouTube, Website).
2.  **Use os Templates de Plataforma:** Para cada plataforma selecionada, use o template correspondente do diretório `references/03_platform_strategy_templates/` para criar um documento de estratégia específico (ex: `estrategia_instagram.md`).
    *   `instagram.md`: Para estratégia de Instagram (Inclui planejamento tático de posts baseado no funil de consciência).
    *   `youtube.md`: Para estratégia de YouTube.
    *   `website.md`: Para estratégia de Website.

## Fase 4: Criação do Plano Integrado

**Objetivo:** Unir todas as peças em um único plano mestre que mostra como as plataformas trabalharão em sinergia.

1.  **Use o Template Integrado:** Abra o template `references/04_integrated_plan_template.md`.
2.  **Compile o Plano:** Incorpore o conteúdo do `perfil_estrategico.md` e dos documentos de estratégia de cada plataforma nos locais indicados. O resultado será o documento `plano_de_marketing_integrado.md`.

## Fase 5 (Opcional): Criação de Apresentação para o Cliente

**Objetivo:** Transformar o plano estratégico em uma apresentação visual e profissional para o cliente.

1.  **Estruture os Slides:** Use o `plano_de_marketing_integrado.md` como roteiro para criar uma apresentação de slides. As seções do plano podem ser convertidas em seções da apresentação.
2.  **Use Ferramentas de Slide:** Utilize a ferramenta `slide_initialize` para criar a estrutura da apresentação e `slide_edit` para preencher cada slide, aplicando a identidade visual definida no Perfil Estratégico.

## Ferramentas de Automação

- **`scripts/setup_project.py`**: Antes de iniciar a Fase 1, você pode usar este script para criar uma estrutura de diretórios organizada para o projeto do cliente. Uso:
  ```bash
  python /home/ubuntu/skills/marketing-strategist/scripts/setup_project.py "[Nome do Cliente]"
  ```