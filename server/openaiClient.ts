// ─── Shared OpenAI client + model config (server-side only) ─────────
import OpenAI from 'openai'

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

let client: OpenAI | null = null

// Lazily construct the client so the server can boot (and serve /health)
// even when no key is configured yet. Throws a clear error on first use.
export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to .env.local before calling the candidate endpoints.'
    )
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}
