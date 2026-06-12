export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMRequest {
  messages: LLMMessage[]
  model: string
  maxTokens?: number
  stream: boolean
  systemPrompt?: string
  onTokenUsage?: (input: number, output: number, total: number) => void
}

interface LLMProvider {
  name: string
  streamChat(req: LLMRequest): AsyncGenerator<string>
  models(): string[]
}

const OLLAMA_MODEL_NAME = 'fluxcodex-qwen35-native'

class OllamaProvider implements LLMProvider {
  name = 'ollama'
  private baseUrl: string

  constructor(baseUrl = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl
  }

  private async ensureReady(): Promise<void> {
    const { ensureNativeOllamaModel } = await import('./ollama.js')
    await ensureNativeOllamaModel(this.baseUrl, OLLAMA_MODEL_NAME)
  }

  async *streamChat(req: LLMRequest): AsyncGenerator<string> {
    await this.ensureReady()

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: req.model,
        stream: true,
        messages: req.messages,
        system: req.systemPrompt,
        options: {
          num_predict: req.maxTokens ?? 4096,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${await response.text()}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const parsed = JSON.parse(trimmed)
          if (parsed.message?.content) {
            yield parsed.message.content
          }
          if (parsed.done) {
            inputTokens = parsed.prompt_eval_count || inputTokens
            outputTokens = parsed.eval_count || outputTokens
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    if (req.onTokenUsage && (inputTokens || outputTokens)) {
      req.onTokenUsage(inputTokens, outputTokens, inputTokens + outputTokens)
    }
  }

  models(): string[] {
    return [OLLAMA_MODEL_NAME]
  }
}

class AnthropicProvider implements LLMProvider {
  name = 'anthropic'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async *streamChat(req: LLMRequest): AsyncGenerator<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: req.model,
        max_tokens: req.maxTokens ?? 8192,
        system: req.systemPrompt,
        messages: req.messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'message_start' && parsed.message?.usage) {
            inputTokens = parsed.message.usage.input_tokens || 0
          }
          if (parsed.type === 'message_delta' && parsed.usage) {
            outputTokens = parsed.usage.output_tokens || 0
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text
          }
        } catch {
          // skip
        }
      }
    }

    if (req.onTokenUsage && (inputTokens || outputTokens)) {
      req.onTokenUsage(inputTokens, outputTokens, inputTokens + outputTokens)
    }
  }

  models(): string[] {
    return ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-opus-4-20250514']
  }
}

class OpenAIProvider implements LLMProvider {
  name = 'openai'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async *streamChat(req: LLMRequest): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: [
          ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
          ...req.messages,
        ],
        max_tokens: req.maxTokens ?? 8192,
        stream: true,
        stream_options: { include_usage: true },
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens || 0
            outputTokens = parsed.usage.completion_tokens || 0
          }
          const content = parsed.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // skip
        }
      }
    }

    if (req.onTokenUsage && (inputTokens || outputTokens)) {
      req.onTokenUsage(inputTokens, outputTokens, inputTokens + outputTokens)
    }
  }

  models(): string[] {
    if (this.baseUrl.includes('groq')) {
      return [
        'llama3-70b-8192',
        'llama3-8b-8192',
        'mixtral-8x7b-32768',
        'gemma2-9b-it',
        'gemma-7b-it',
      ]
    }
    return ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini']
  }
}

export class LLMGateway {
  private providers: Map<string, LLMProvider> = new Map()
  private fallbackOrder: string[] = []

  registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider)
  }

  setFallbackOrder(order: string[]): void {
    this.fallbackOrder = order
  }

  async *stream(req: LLMRequest): AsyncGenerator<string> {
    const provider = this.getProviderForModel(req.model)
    if (!provider) {
      throw new Error(`No provider found for model: ${req.model}`)
    }

    const isNativeOllamaModel = provider.name === 'ollama' || req.model === OLLAMA_MODEL_NAME
    if (isNativeOllamaModel) {
      yield* provider.streamChat(req)
      return
    }

    const errors: Error[] = []

    try {
      yield* provider.streamChat(req)
    } catch (err) {
      errors.push(err as Error)

      for (const fallbackName of this.fallbackOrder) {
        const fallback = this.providers.get(fallbackName)
        if (!fallback) continue

        try {
          yield* fallback.streamChat(req)
          return
        } catch (fallbackErr) {
          errors.push(fallbackErr as Error)
        }
      }

      throw new Error(`All providers failed: ${errors.map(e => e.message).join(', ')}`)
    }
  }

  private getProviderForModel(model: string): LLMProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.models().includes(model)) {
        return provider
      }
    }

    if (model.startsWith('claude-')) return this.providers.get('anthropic')
    if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
      return this.providers.get('openai')
    }
    if (model.startsWith('gemini-')) return this.providers.get('gemini')
    if (model.startsWith('deepseek-')) return this.providers.get('deepseek')
    if (model.includes('mistral') || model.includes('codestral')) return this.providers.get('mistral')
    if (model.includes('llama') || model.includes('mixtral') || model.includes('gemma')) {
      return this.providers.get('groq')
    }

    return this.providers.get('groq') || this.providers.get('openai')
  }

  getModels(): string[] {
    const models: string[] = []
    for (const provider of this.providers.values()) {
      models.push(...provider.models())
    }
    return [...new Set(models)]
  }
}

class GeminiProvider implements LLMProvider {
  name = 'gemini'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async *streamChat(req: LLMRequest): AsyncGenerator<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:streamGenerateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: req.messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          systemInstruction: req.systemPrompt ? {
            parts: [{ text: req.systemPrompt }],
          } : undefined,
          generationConfig: {
            maxOutputTokens: req.maxTokens ?? 8192,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${await response.text()}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let inputTokens = 0
    let outputTokens = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          if (parsed.usageMetadata) {
            inputTokens = parsed.usageMetadata.promptTokenCount || 0
            outputTokens = parsed.usageMetadata.candidatesTokenCount || 0
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) yield text
        } catch {
          // skip
        }
      }
    }

    if (req.onTokenUsage && (inputTokens || outputTokens)) {
      req.onTokenUsage(inputTokens, outputTokens, inputTokens + outputTokens)
    }
  }

  models(): string[] {
    return ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-pro-exp-03-25']
  }
}

class DeepSeekProvider extends OpenAIProvider {
  declare name: string

  constructor(apiKey: string) {
    super(apiKey, 'https://api.deepseek.com/v1')
    this.name = 'deepseek'
  }

  models(): string[] {
    return ['deepseek-chat', 'deepseek-reasoner']
  }
}

class MistralProvider extends OpenAIProvider {
  declare name: string

  constructor(apiKey: string) {
    super(apiKey, 'https://api.mistral.ai/v1')
    this.name = 'mistral'
  }

  models(): string[] {
    return ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest']
  }
}

export function createGateway(apiKeys: Record<string, string>): LLMGateway {
  const gateway = new LLMGateway()

  gateway.registerProvider(new OllamaProvider())

  if (apiKeys.anthropic) {
    gateway.registerProvider(new AnthropicProvider(apiKeys.anthropic))
  }
  if (apiKeys.openai) {
    gateway.registerProvider(new OpenAIProvider(apiKeys.openai))
  }
  if (apiKeys.openrouter) {
    gateway.registerProvider(new OpenAIProvider(apiKeys.openrouter, 'https://openrouter.ai/api/v1'))
  }
  if (apiKeys.groq) {
    gateway.registerProvider(new OpenAIProvider(apiKeys.groq, 'https://api.groq.com/openai/v1'))
  }
  if (apiKeys.gemini) {
    gateway.registerProvider(new GeminiProvider(apiKeys.gemini))
  }
  if (apiKeys.deepseek) {
    gateway.registerProvider(new DeepSeekProvider(apiKeys.deepseek))
  }
  if (apiKeys.mistral) {
    gateway.registerProvider(new MistralProvider(apiKeys.mistral))
  }

  gateway.setFallbackOrder(['anthropic', 'gemini', 'openai', 'deepseek', 'mistral', 'groq', 'ollama'])

  return gateway
}
