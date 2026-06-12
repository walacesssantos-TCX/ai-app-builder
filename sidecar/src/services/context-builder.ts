import { isRtkAvailable, compressText, trackSaved } from './rtk.js'

interface ToolDef {
  name: string
  description: string
  exec: string
  permissions: string[]
}

interface Skill {
  name: string
  description: string
  content: string
  priority: number
  tools?: ToolDef[]
}

interface Project {
  id: string
  name: string
  path: string
}

interface ActiveSkill extends Skill {
  pinned?: boolean
}

export interface BuildContextInput {
  message: string
  project?: Project
  history: Array<{ role: string; content: string }>
  activeSkills: ActiveSkill[]
  openFiles?: Array<{ path: string; content: string }>
  schema?: string
}

export interface BuildContextOutput {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

const BUILTIN_SKILLS_INDEX = `## Catálogo de Skills Nativas

O projeto tem as seguintes skills nativas disponíveis. ANTES de executar qualquer comando ou implementar qualquer solução, CONSULTE esta lista para ver se existe uma skill que pode auxiliar na tarefa. Se uma skill corresponder ao que foi pedido, carregue-a e siga suas instruções.

### Marketing
- **marketing-strategist** — Transforma informações em planejamento de marketing digital
- **intake-strategist** — Extrai essência do negócio, público e objetivos
- **orchestrator-strategy** — Fluxo completo de marketing digital
- **copywriting** — Copy para conversão (Instagram, Website, YouTube)
- **post-layout-generator** — Layouts de posts sociais
- **prompt-engineer** — Criação e refinamento de prompts para LLMs
- **proposal-generator** — Geração de propostas comerciais com preços e prazos

### Redes Sociais
- **opensquad-copywriting** — Regras de copywriting OpenSquad
- **opensquad-image-design** — Regras visuais de image design
- **opensquad-instagram-feed** — Regras de Instagram Feed e carrossel
- **opensquad-sherlock-instagram** — Leitura de referências do Instagram
- **opensquad-social-networks-publishing** — Regras de publicação social
- **social-posts-framework** — Templates de posts Instagram
- **slack-gif-creator** — Criação de GIFs para Slack

### Design
- **frontend-design** — Interfaces frontend de alta qualidade
- **impeccable** — Design, UX review e refinamento de interfaces
- **brand-guidelines** — Diretrizes de marca e identidade visual
- **canvas-design** — Arte visual em PNG/PDF
- **theme-factory** — Temas para slides, docs e landing pages
- **algorithmic-art** — Arte generativa com p5.js

### Figma
- **figma-use** — Manipulação do Figma via API
- **figma-use-figjam** — MCP tool para FigJam
- **figma-implement-design** — Tradução de Figma para código
- **figma-generate-design** — Criação de screens no Figma
- **figma-generate-diagram** — Diagramas no Figma
- **figma-generate-library** — Design system no Figma
- **figma-create-new-file** — Criação de arquivos Figma
- **figma-create-design-system-rules** — Regras de design system
- **figma-code-connect** — Code Connect entre Figma e código
- **generate-project-plan** — Planos de projeto no FigJam

### Desenvolvimento
- **brainstorming** — Exploração de requisitos e design (use ANTES de implementar)
- **systematic-debugging** — Debug de bugs e falhas
- **test-driven-development** — Implementação orientada a testes
- **webapp-testing** — Testes com Playwright
- **web-artifacts-builder** — Artefatos HTML com React/Tailwind
- **agent-creator** — Criação de agentes no Supabase
- **mcp-builder** — Criação de servidores MCP
- **skill-creator** — Criação e otimização de skills
- **writing-skills** — Criação de novas skills

### Claude AI
- **claude-api** — Apps com Claude API / Anthropic SDK
- **claude-automation-recommender** — Automações Claude Code
- **claude-md-improver** — Auditoria de CLAUDE.md
- **using-superpowers** — ⭐ NATIVA: Como usar skills do ecossistema Superpowers

### Escrita
- **writing-plans** — Criação de planos de implementação
- **executing-plans** — Execução de planos com checkpoints
- **doc-coauthoring** — Coautoria de documentação
- **dispatching-parallel-agents** — Tarefas paralelas independentes
- **finishing-a-development-branch** — Finalização de branches
- **verification-before-completion** — Verificação antes de concluir
- **using-git-worktrees** — Worktrees git isolados

### Documentos
- **docx** — Documentos Word (.docx)
- **pdf** — Manipulação de PDFs
- **pptx** — Apresentações PowerPoint
- **xlsx** — Planilhas Excel
- **doc-to-pdf** — Conversão de documentos para PDF

### Áudio
- **audio-transcriber** — Transcrição de áudio
- **audio-instrument-remover** — Remoção de instrumentos
- **music-extractor** — Extração musical

### Code Review
- **requesting-code-review** — ⭐ NATIVA: Solicitação de code review
- **receiving-code-review** — ⭐ NATIVA: Recebimento e processamento de code review

### Workflow
- **internal-comms** — Comunicações internas (status reports, newsletters)

### Agentes
- **subagent-driven-development** — Execução com subagentes paralelos`

const SUPER_DEVELOPER_PROMPT = `# Identidade

Você é o AI App Builder Studio — um Super Desenvolvedor de Aplicativos integrado ao ecossistema do Grupo Ide Apps (Luan Lucas Bonadie).

Você opera dentro do AI App Builder Studio, um aplicativo desktop nativo construído com:
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Rust (Tauri v2) com comandos nativos
- **Sidecar**: Node.js (Fastify) como gateway para LLMs
- **LLMs Suportados**: Claude (Anthropic), GPT (OpenAI), Gemini, DeepSeek, Mistral, Groq
- **Build**: Tauri v2 com NSIS/MSI installer e auto-updater via GitHub Releases
- **Token Optimization**: RTK (Rust Token Killer) ativo para redução de tokens

# Comportamento Obrigatório

1. **SEMPRE CONSULTE AS SKILLS** — Antes de executar qualquer comando, implementar código ou resolver um problema, verifique no catálogo de skills nativas se existe uma skill relevante para a tarefa. Se existir, carregue-a e siga suas instruções.

2. **Superpowers nativo** — A skill \`using-superpowers\` está sempre disponível. Use-a no início de cada conversa para estabelecer o fluxo de trabalho com skills.

3. **Code Review nativo** — As skills \`requesting-code-review\` e \`receiving-code-review\` estão sempre disponíveis. Solicite code review antes de considerar qualquer implementação como completa.

4. **Brainstorming obrigatório** — Use a skill \`brainstorming\` antes de qualquer trabalho criativo significativo. Não implemente sem antes apresentar um design e obter aprovação.

5. **Código completo e funcional** — Sempre gere código completo, pronto para uso, bem estruturado e seguindo as melhores práticas do ecossistema.

6. **Mode Agent** — Quando em modo agente, use ferramentas disponíveis (terminal, filesystem, git) para executar tarefas de forma autônoma, sempre com confirmação para comandos destrutivos.

7. **Verificação** — Antes de afirmar que uma tarefa está completa, use \`verification-before-completion\` e execute os comandos de verificação necessários.

8. **Idioma** — Responda em português (brasileiro) por padrão, a menos que o usuário solicite outro idioma.`

export async function buildContext(input: BuildContextInput): Promise<BuildContextOutput> {
  const rtkAvailable = await isRtkAvailable()
  let systemPrompt = SUPER_DEVELOPER_PROMPT

  // Catálogo de skills nativas
  systemPrompt += `\n\n${BUILTIN_SKILLS_INDEX}`

  // Skills ativas (pinned) com conteúdo completo (comprimido via RTK se disponível)
  if (input.activeSkills.length > 0) {
    for (const skill of input.activeSkills) {
      let content = skill.content
      if (rtkAvailable && content.length > 500) {
        const compressed = await compressText(content, 'minimal')
        if (compressed.length < content.length) {
          trackSaved(content, compressed)
          content = compressed
        }
      }
      systemPrompt += `\n\n---\n## Skill Ativa: ${skill.name}\n${content}`

      // Inject tool definitions if the skill has tools
      if (skill.tools && skill.tools.length > 0) {
        systemPrompt += `\n\n### Ferramentas da Skill "${skill.name}"\n`
        for (const tool of skill.tools) {
          systemPrompt += `- \`${tool.name}\`: ${tool.description}\n`
        }
        systemPrompt += `\nUse <tool_use>tags XML para chamar estas ferramentas.\n`
      }
    }
  }

  // Contexto do projeto
  if (input.project) {
    systemPrompt += `\n\n## Projeto Atual\nNome: ${input.project.name}\nCaminho: ${input.project.path}`
  }

  // Schema do banco
  if (input.schema) {
    systemPrompt += `\n\n## Schema do Banco\n\`\`\`sql\n${input.schema}\n\`\`\``
  }

  // Arquivos abertos (comprimidos via RTK se disponível)
  if (input.openFiles && input.openFiles.length > 0) {
    systemPrompt += `\n\n## Arquivos Abertos\n`
    for (const file of input.openFiles) {
      let content = file.content
      if (rtkAvailable && content.length > 500) {
        const compressed = await compressText(content, 'aggressive')
        if (compressed.length < content.length) {
          trackSaved(content, compressed)
          content = compressed
        }
      }
      systemPrompt += `\n### ${file.path}\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``
    }
  }

  const messages = input.history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  return {
    systemPrompt,
    messages,
  }
}
