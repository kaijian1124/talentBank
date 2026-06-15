// Local API server (development)
// Boots an Express server that proxies candidate analysis to OpenAI so
// the API key stays server-side. Run via `npm run dev:server` (tsx) or
// alongside Vite via `npm run dev` (concurrently).
import dotenv from 'dotenv'
// Load .env.local first (matches Vite's convention), then .env as fallback.
// Plain `dotenv/config` only reads .env, so we configure paths explicitly.
dotenv.config({ path: '.env.local' })
dotenv.config()
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { candidateRouter } from './routes/candidate'
import { companyRouter } from './routes/company'
import { matchingRouter } from './routes/matching'
import { OPENAI_MODEL } from './openaiClient'

const PORT = Number(process.env.PORT) || 8787

const app = express()
app.use(express.json({ limit: '1mb' }))

// Lightweight request logging.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    // eslint-disable-next-line no-console
    console.log(`[api] ${req.method} ${req.path}`)
  }
  next()
})

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    model: OPENAI_MODEL,
    hasKey: Boolean(process.env.OPENAI_API_KEY),
  })
})

app.use('/api/candidate', candidateRouter)
app.use('/api/company', companyRouter)
app.use('/api/matching', matchingRouter)

// Central error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  // eslint-disable-next-line no-console
  console.error('[api] error:', message)
  if (!res.headersSent) {
    res.status(500).json({ error: message })
  }
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] candidate server listening on http://localhost:${PORT} (model: ${OPENAI_MODEL})`)
  if (!process.env.OPENAI_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[api] OPENAI_API_KEY not set; candidate endpoints will return an error until configured in .env.local')
  }
})
