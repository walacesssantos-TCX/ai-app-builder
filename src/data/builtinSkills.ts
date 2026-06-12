export interface SkillDef {
  name: string
  description: string
  category: string
  priority: number
  tags: string[]
}

const CAT = {
  MARKETING: 'Marketing',
  SOCIAL: 'Redes Sociais',
  DESIGN: 'Design',
  FIGMA: 'Figma',
  DEV: 'Desenvolvimento',
  CLAUDE: 'Claude AI',
  WRITING: 'Escrita',
  DOCS: 'Documentos',
  AUDIO: 'Áudio',
  REVIEW: 'Code Review',
  WORKFLOW: 'Workflow',
  AGENTS: 'Agentes',
}

export const BUILTIN_SKILLS: SkillDef[] = [
  // === Marketing ===
  { name: 'marketing-strategist', category: CAT.MARKETING, priority: 5,
    description: 'Transforma informações desordenadas em planejamento de marketing digital coeso, incluindo Linha Editorial Avançada e plano de posicionamento para Instagram, YouTube e Website.', tags: ['estratégia', 'marketing digital', 'conteúdo'] },
  { name: 'intake-strategist', category: CAT.MARKETING, priority: 5,
    description: 'Faz perguntas estratégicas para extrair essência do negócio, público-alvo e objetivos com base na metodologia Luan Bonadie.', tags: ['briefing', 'estratégia', 'diagnóstico'] },
  { name: 'orchestrator-strategy', category: CAT.MARKETING, priority: 5,
    description: 'Orquestra todo o fluxo de marketing digital: Intake + Estratégia + Copywriting + Frontend Design em um pacote único.', tags: ['automação', 'fluxo completo', 'delivery'] },
  { name: 'copywriting', category: CAT.MARKETING, priority: 5,
    description: 'Especialista em copywriting para conversão. Cria textos prontos para Instagram, Website e YouTube com clareza, persuasão e ação.', tags: ['copy', 'conversão', 'persuasão'] },
  { name: 'post-layout-generator', category: CAT.MARKETING, priority: 5,
    description: 'Gera novos layouts de posts sociais a partir de imagem de referência ou prompt textual, mantendo uniformidade com o design system do cliente.', tags: ['layout', 'posts', 'design system'] },
  { name: 'prompt-engineer', category: CAT.MARKETING, priority: 5,
    description: 'Guia especialista para criar, refinar e validar prompts de alta qualidade para LLMs com estrutura obrigatória de 6 partes e técnicas como RAG e Chain-of-Thought.', tags: ['prompt', 'LLM', 'engenharia'] },
  { name: 'proposal-generator', category: CAT.MARKETING, priority: 5,
    description: 'Gera propostas comerciais completas com preços e prazos para projetos de tecnologia. Cria sites HTML elegantes seguindo o Design System do Grupo Ide Apps.', tags: ['proposta', 'comercial', 'orçamento'] },

  // === Redes Sociais ===
  { name: 'opensquad-copywriting', category: CAT.SOCIAL, priority: 5,
    description: 'Wrapper local das regras de copywriting do OpenSquad. Use quando a tarefa envolver hook, headline, CTA ou copy de post/carrossel.', tags: ['copy', 'instagram', 'opensquad'] },
  { name: 'opensquad-image-design', category: CAT.SOCIAL, priority: 5,
    description: 'Wrapper local das regras visuais de image design do OpenSquad. Use para composição visual, tipografia, hierarquia e consistência de slides.', tags: ['design visual', 'posts', 'opensquad'] },
  { name: 'opensquad-instagram-feed', category: CAT.SOCIAL, priority: 5,
    description: 'Regras de Instagram Feed e carrossel: estrutura de slides, hook, CTA e densidade editorial para posts estáticos e carrosséis.', tags: ['instagram', 'feed', 'carrossel'] },
  { name: 'opensquad-sherlock-instagram', category: CAT.SOCIAL, priority: 5,
    description: 'Fluxo Sherlock para leitura de referências do Instagram: extrai padrões editoriais e visuais de posts, reels ou perfis.', tags: ['análise', 'referências', 'instagram'] },
  { name: 'opensquad-social-networks-publishing', category: CAT.SOCIAL, priority: 5,
    description: 'Regras de publicação social: preview de plataforma, adequação de CTA para distribuição e requisitos operacionais de redes sociais.', tags: ['publicação', 'redes sociais', 'distribuição'] },
  { name: 'social-posts-framework', category: CAT.SOCIAL, priority: 5,
    description: 'Framework para construir templates de posts Instagram com uniformidade estrita, design system do cliente e contratos locais.', tags: ['templates', 'posts', 'instagram'] },
  { name: 'slack-gif-creator', category: CAT.SOCIAL, priority: 5,
    description: 'Criação de GIFs animados otimizados para Slack com constraints, validação e conceitos de animação.', tags: ['gif', 'slack', 'animação'] },

  // === Design ===
  { name: 'frontend-design', category: CAT.DESIGN, priority: 5,
    description: 'Cria interfaces frontend distintivas com alta qualidade de design. Gera código criativo e polido que evita estética AI genérica.', tags: ['ui', 'frontend', 'design system'] },
  { name: 'impeccable', category: CAT.DESIGN, priority: 5,
    description: 'Design, redesign, critique, polimento e otimização de interfaces. Cobre UX, hierarquia visual, acessibilidade, tipografia, motion e micro-interações.', tags: ['ux', 'refinamento', 'auditoria'] },
  { name: 'brand-guidelines', category: CAT.DESIGN, priority: 5,
    description: 'Aplica diretrizes oficiais de marca (cores, tipografia) a artefatos que precisam do visual da marca.', tags: ['marca', 'cores', 'tipografia'] },
  { name: 'canvas-design', category: CAT.DESIGN, priority: 5,
    description: 'Cria arte visual em .png e .pdf com filosofia de design. Para posters, artwork e peças estáticas.', tags: ['arte', 'visual', 'poster'] },
  { name: 'theme-factory', category: CAT.DESIGN, priority: 5,
    description: 'Toolkit para estilizar artefatos com temas. 10 temas pré-definidos com cores/fontes para slides, docs, landing pages e mais.', tags: ['tema', 'estilo', 'personalização'] },
  { name: 'algorithmic-art', category: CAT.DESIGN, priority: 5,
    description: 'Cria arte generativa com p5.js usando randomness seeded e exploração interativa de parâmetros. Para flow fields, particle systems e arte algorítmica.', tags: ['generativo', 'p5.js', 'visual'] },

  // === Figma ===
  { name: 'figma-use', category: CAT.FIGMA, priority: 5,
    description: 'Pré-requisito obrigatório antes de toda chamada use_figma. Cobre create/edit/delete nós, variáveis, tokens, componentes e auto-layout.', tags: ['figma', 'api', 'plugin'] },
  { name: 'figma-use-figjam', category: CAT.FIGMA, priority: 5,
    description: 'Ajuda agents a usar o MCP tool use_figma no contexto FigJam. Usado junto com figma-use.', tags: ['figjam', 'whiteboard', 'figma'] },
  { name: 'figma-implement-design', category: CAT.FIGMA, priority: 5,
    description: 'Traduz designs do Figma em código de aplicação com fidelidade visual 1:1.', tags: ['figma-to-code', 'implementação', 'ui'] },
  { name: 'figma-generate-design', category: CAT.FIGMA, priority: 5,
    description: 'Traduz páginas/views de aplicação para Figma. Descoberta de componentes, variáveis e montagem incremental seção por seção.', tags: ['code-to-figma', 'design', 'screens'] },
  { name: 'figma-generate-diagram', category: CAT.FIGMA, priority: 5,
    description: 'Gera diagramas no Figma: fluxogramas genéricos, diagramas de arquitetura e mais.', tags: ['diagrama', 'fluxograma', 'arquitetura'] },
  { name: 'figma-generate-library', category: CAT.FIGMA, priority: 5,
    description: 'Constrói design system profissional no Figma a partir do código: variáveis, tokens, biblioteca de componentes e theming.', tags: ['design system', 'library', 'tokens'] },
  { name: 'figma-create-new-file', category: CAT.FIGMA, priority: 5,
    description: 'Cria novo arquivo Figma ou FigJam em branco para começar um design.', tags: ['novo arquivo', 'figma', 'criação'] },
  { name: 'figma-create-design-system-rules', category: CAT.FIGMA, priority: 5,
    description: 'Gera regras personalizadas de design system para o codebase do usuário.', tags: ['regras', 'design system', 'config'] },
  { name: 'figma-code-connect', category: CAT.FIGMA, priority: 5,
    description: 'Cria e mantém arquivos Figma Code Connect mapeando componentes Figma para snippets de código.', tags: ['code connect', 'componentes', 'mapeamento'] },
  { name: 'generate-project-plan', category: CAT.FIGMA, priority: 5,
    description: 'Gera um quadro de plano de projeto no FigJam a partir de um PRD + contexto do codebase.', tags: ['planejamento', 'figjam', 'prd'] },

  // === Desenvolvimento ===
  { name: 'brainstorming', category: CAT.DEV, priority: 5,
    description: 'Obrigatório antes de qualquer trabalho criativo. Explora intenção do usuário, requisitos e design antes da implementação.', tags: ['ideação', 'design', 'planejamento'] },
  { name: 'systematic-debugging', category: CAT.DEV, priority: 5,
    description: 'Use ao encontrar qualquer bug, falha em teste ou comportamento inesperado, antes de propor correções.', tags: ['debug', 'bug', 'solução'] },
  { name: 'test-driven-development', category: CAT.DEV, priority: 5,
    description: 'Implementação orientada a testes: escreva o teste antes do código de implementação.', tags: ['tdd', 'testes', 'qualidade'] },
  { name: 'webapp-testing', category: CAT.DEV, priority: 5,
    description: 'Toolkit para interagir e testar aplicações web locais com Playwright: verificação de frontend, screenshots e logs.', tags: ['testes', 'playwright', 'e2e'] },
  { name: 'web-artifacts-builder', category: CAT.DEV, priority: 5,
    description: 'Suite para criar artefatos HTML complexos com React, Tailwind CSS e shadcn/ui. Para artefatos com estado e roteamento.', tags: ['artefatos', 'react', 'frontend'] },
  { name: 'agent-creator', category: CAT.DEV, priority: 5,
    description: 'Cria e registra agentes e skills no Supabase: system_prompt, body_md, body_code (TypeScript Deno) e migration SQL.', tags: ['agentes', 'supabase', 'deno'] },
  { name: 'mcp-builder', category: CAT.DEV, priority: 5,
    description: 'Guia para criar servidores MCP de alta qualidade em Python (FastMCP) ou Node/TypeScript (MCP SDK).', tags: ['mcp', 'api', 'integração'] },
  { name: 'skill-creator', category: CAT.DEV, priority: 5,
    description: 'Cria, modifica e otimiza skills. Mede performance e executa evals para testar skills.', tags: ['skills', 'criação', 'avaliação'] },
  { name: 'writing-skills', category: CAT.DEV, priority: 5,
    description: 'Use ao criar novas skills, editar skills existentes ou verificar skills antes do deploy.', tags: ['skills', 'escrita', 'validação'] },

  // === Claude AI ===
  { name: 'claude-api', category: CAT.CLAUDE, priority: 5,
    description: 'Constrói, debuga e otimiza apps Claude API / Anthropic SDK com prompt caching, ferramentas e modelos.', tags: ['claude', 'api', 'anthropic'] },
  { name: 'claude-automation-recommender', category: CAT.CLAUDE, priority: 5,
    description: 'Analisa codebase e recomenda automações Claude Code: hooks, subagents, skills, plugins e MCP servers.', tags: ['automação', 'claude', 'recomendação'] },
  { name: 'claude-md-improver', category: CAT.CLAUDE, priority: 5,
    description: 'Audita e melhora arquivos CLAUDE.md em repositórios. Escaneia, avalia qualidade e faz atualizações.', tags: ['claude.md', 'auditoria', 'memória'] },
  { name: 'using-superpowers', category: CAT.CLAUDE, priority: 5,
    description: 'Use ao iniciar qualquer conversa. Estabelece como encontrar e usar skills, exigindo invocação da Skill tool antes de qualquer resposta.', tags: ['superpowers', 'setup', 'skills'] },

  // === Escrita ===
  { name: 'writing-plans', category: CAT.WRITING, priority: 5,
    description: 'Use quando tiver um spec ou requisitos para tarefa multi-step, antes de tocar no código.', tags: ['plano', 'especificação', 'planejamento'] },
  { name: 'executing-plans', category: CAT.WRITING, priority: 5,
    description: 'Use quando tiver um plano de implementação escrito para executar em sessão separada com checkpoints de revisão.', tags: ['execução', 'plano', 'checkpoint'] },
  { name: 'doc-coauthoring', category: CAT.WRITING, priority: 5,
    description: 'Guia usuários em workflow estruturado de coautoria de documentação: propostas, specs técnicas e docs de decisão.', tags: ['documentação', 'coautoria', 'especificação'] },
  { name: 'dispatching-parallel-agents', category: CAT.WRITING, priority: 5,
    description: 'Use quando tiver 2+ tarefas independentes sem estado compartilhado ou dependências sequenciais.', tags: ['paralelo', 'agentes', 'multitarefa'] },
  { name: 'finishing-a-development-branch', category: CAT.WRITING, priority: 5,
    description: 'Guia a conclusão de trabalho de desenvolvimento apresentando opções estruturadas para merge, PR ou cleanup.', tags: ['finalização', 'branch', 'merge'] },
  { name: 'verification-before-completion', category: CAT.WRITING, priority: 5,
    description: 'Use antes de afirmar que o trabalho está completo. Requer execução de comandos de verificação antes de qualquer afirmação de sucesso.', tags: ['verificação', 'qualidade', 'validação'] },
  { name: 'using-git-worktrees', category: CAT.WRITING, priority: 5,
    description: 'Cria worktrees git isoladas para features com seleção inteligente de diretório e verificação de segurança.', tags: ['git', 'worktree', 'isolamento'] },

  // === Documentos ===
  { name: 'docx', category: CAT.DOCS, priority: 5,
    description: 'Cria, lê, edita e manipula documentos Word (.docx) com formatação profissional: sumário, headings, numeração de páginas e letterhead.', tags: ['word', 'docx', 'documento'] },
  { name: 'pdf', category: CAT.DOCS, priority: 5,
    description: 'Tudo sobre PDFs: ler, extrair texto/tabelas, combinar, dividir, rotacionar, OCR, formulários e criptografia.', tags: ['pdf', 'documento', 'extração'] },
  { name: 'pptx', category: CAT.DOCS, priority: 5,
    description: 'Cria e edita apresentações PowerPoint (.pptx): slides, decks, layouts, templates, speaker notes e comentários.', tags: ['powerpoint', 'pptx', 'apresentação'] },
  { name: 'xlsx', category: CAT.DOCS, priority: 5,
    description: 'Manipula planilhas (.xlsx, .csv): criar, editar, fórmulas, formatação, gráficos e limpeza de dados.', tags: ['excel', 'planilha', 'dados'] },
  { name: 'doc-to-pdf', category: CAT.DOCS, priority: 5,
    description: 'Converte documentos para PDF com formatação preservada.', tags: ['conversão', 'pdf', 'documento'] },

  // === Áudio ===
  { name: 'audio-transcriber', category: CAT.AUDIO, priority: 5,
    description: 'Transcreve áudio para texto com suporte a múltiplos formatos.', tags: ['transcrição', 'áudio', 'texto'] },
  { name: 'audio-instrument-remover', category: CAT.AUDIO, priority: 5,
    description: 'Remove instrumentos de arquivos de áudio, isolando vocais ou outros elementos.', tags: ['áudio', 'instrumento', 'isolamento'] },
  { name: 'music-extractor', category: CAT.AUDIO, priority: 5,
    description: 'Extrai e processa elementos musicais de arquivos de áudio.', tags: ['música', 'extração', 'áudio'] },

  // === Code Review ===
  { name: 'requesting-code-review', category: CAT.REVIEW, priority: 5,
    description: 'Use ao completar tarefas ou antes de merge para verificar se o trabalho atende aos requisitos.', tags: ['review', 'merge', 'qualidade'] },
  { name: 'receiving-code-review', category: CAT.REVIEW, priority: 5,
    description: 'Use ao receber feedback de code review, antes de implementar sugestões. Exige rigor técnico e verificação.', tags: ['feedback', 'review', 'revisão'] },

  // === Agentes ===
  { name: 'subagent-driven-development', category: CAT.AGENTS, priority: 5,
    description: 'Use ao executar planos de implementação com tarefas independentes em subagentes na sessão atual.', tags: ['subagentes', 'paralelo', 'implementação'] },

  // === Workflow ===
  { name: 'internal-comms', category: CAT.WORKFLOW, priority: 5,
    description: 'Recursos para escrever comunicações internas: status reports, newsletters, FAQs, incident reports e project updates.', tags: ['comunicação', 'report', 'interno'] },
]

export const SKILL_CATEGORIES = Array.from(new Set(BUILTIN_SKILLS.map(s => s.category)))

export function getSkillsByCategory(category?: string): SkillDef[] {
  if (!category || category === 'Todas') return BUILTIN_SKILLS
  return BUILTIN_SKILLS.filter(s => s.category === category)
}

export function searchSkills(query: string): SkillDef[] {
  const q = query.toLowerCase()
  return BUILTIN_SKILLS.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q) ||
    s.tags.some(t => t.toLowerCase().includes(q))
  )
}
