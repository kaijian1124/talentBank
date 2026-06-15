import { Router } from 'express'
import type { Request, Response } from 'express'
import { getOpenAIClient } from '../openaiClient'

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const ALLOWED_EMBEDDING_MODELS = new Set(['text-embedding-3-small', 'text-embedding-3-large'])

export const matchingRouter = Router()

matchingRouter.post('/embeddings', async (req: Request, res: Response) => {
  const { text, model } = req.body as { text?: string; model?: string }
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'text is required.' })
    return
  }

  const embeddingModel = model && ALLOWED_EMBEDDING_MODELS.has(model) ? model : DEFAULT_EMBEDDING_MODEL

  try {
    const client = getOpenAIClient()
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: text.replace(/\n/g, ' '),
      encoding_format: 'float',
    })
    res.json({ model: embeddingModel, embedding: response.data[0]?.embedding ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isConfig = message.includes('OPENAI_API_KEY')
    res.status(isConfig ? 500 : 502).json({ error: message })
  }
})