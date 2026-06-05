// ─── LLM Provider Abstraction ─────────────────────────────────────
// To switch to a real LLM, implement RealLLMProvider and set USE_REAL_LLM = true

const USE_REAL_LLM = false
const API_KEY = ''  // 填入你的 API key
const MODEL = 'claude-sonnet-4-20250514'  // 或 'gpt-4o' 等

// ─── Interface ────────────────────────────────────────────────────
export interface LLMProvider {
  generateText(prompt: string): Promise<string>
  generateStructured<T>(prompt: string, schema: string): Promise<T>
}

// ─── Mock Provider (no API key needed) ────────────────────────────
export class MockLLMProvider implements LLMProvider {
  async generateText(prompt: string): Promise<string> {
    // deterministic mock — just echoes intent
    if (prompt.toLowerCase().includes('classify')) return 'candidate'
    if (prompt.toLowerCase().includes('verify')) return 'conversation_verified'
    return 'mock response'
  }

  async generateStructured<T>(_prompt: string, _schema: string): Promise<T> {
    return {} as T
  }
}

// ─── Anthropic Provider ───────────────────────────────────────────
export class AnthropicProvider implements LLMProvider {
  async generateText(prompt: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text ?? ''
  }

  async generateStructured<T>(prompt: string, _schema: string): Promise<T> {
    const text = await this.generateText(prompt + '\n\nRespond with valid JSON only.')
    try {
      return JSON.parse(text) as T
    } catch {
      return {} as T
    }
  }
}

// ─── OpenAI Provider ──────────────────────────────────────────────
export class OpenAIProvider implements LLMProvider {
  async generateText(prompt: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  async generateStructured<T>(prompt: string, _schema: string): Promise<T> {
    const text = await this.generateText(prompt + '\n\nRespond with valid JSON only.')
    try {
      return JSON.parse(text) as T
    } catch {
      return {} as T
    }
  }
}

// ─── Active provider ──────────────────────────────────────────────
export const llm: LLMProvider = USE_REAL_LLM
  ? new AnthropicProvider()   // 换成 OpenAIProvider() 如果用 OpenAI
  : new MockLLMProvider()