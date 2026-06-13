import type { LLMGateway } from './llm-gateway.js'

interface SkillEntry {
  name: string
  description: string
  priority: number
}

interface ScoreResult {
  name: string
  score: number
}

export async function scoreSkills(
  message: string,
  available: SkillEntry[],
  pinned: string[],
  maxSkills: number = 3,
  gateway?: LLMGateway
): Promise<{ selected: string[]; scores: ScoreResult[] }> {
  if (available.length === 0) return { selected: [], scores: [] }

  const pinnedItems = available.filter(s => pinned.includes(s.name))
  const remaining = available.filter(s => !pinned.includes(s.name))
  if (remaining.length === 0) {
    return { selected: pinnedItems.map(s => s.name), scores: [] }
  }

  const scoringPrompt = `Classifique a relevância de cada skill para a mensagem do usuário.
Mensagem: "${message}"

Para cada skill, responda APENAS com um JSON array:
[{"name":"nome_da_skill","score":0-10}]

Skills:
${remaining.map(s => `- ${s.name}: ${s.description}`).join('\n')}`

  let scores: ScoreResult[] = []

  try {
    if (gateway) {
      const chunks: string[] = []
      for await (const chunk of gateway.stream({
        messages: [{ role: 'user', content: scoringPrompt }],
        model: 'llama3-70b-8192',
        stream: true,
        maxTokens: 1024,
      })) {
        chunks.push(chunk)
      }
      const content = chunks.join('')
      const jsonMatch = content.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        scores = JSON.parse(jsonMatch[0]) as ScoreResult[]
      }
    }
  } catch {
    // fallback: simple keyword matching
  }

  if (scores.length === 0) {
    const msgLower = message.toLowerCase()
    scores = remaining.map(s => {
      const words = s.description.toLowerCase().split(/\s+/)
      const matchCount = words.filter(w => msgLower.includes(w)).length
      return { name: s.name, score: Math.min(matchCount * 2, 10) }
    })
  }

  const ranked = scores
    .map(s => {
      const skill = remaining.find(r => r.name === s.name)
      return { ...s, priority: skill?.priority ?? 5 }
    })
    .sort((a, b) => (b.score * b.priority) - (a.score * a.priority))
    .slice(0, Math.max(0, maxSkills - pinnedItems.length))

  const selected = [
    ...pinnedItems.map(s => s.name),
    ...ranked.map(s => s.name),
  ]

  return { selected, scores }
}
