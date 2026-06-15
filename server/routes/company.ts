import { Router } from 'express'
import type { Request, Response } from 'express'
import { getOpenAIClient, OPENAI_MODEL } from '../openaiClient'
import { buildCompanyJobPostingInput } from '../companyPrompts'
import { COMPANY_JOB_POSTING_JSON_SCHEMA } from '../../src/types/llmContract'
import type { CompanyJobPostingRequest, CompanyJobPostingResponse } from '../../src/types/llmContract'

const COMPANY_JOB_POSTING_MAX_TOKENS = 1200

export const companyRouter = Router()

companyRouter.post('/job-posting', async (req: Request, res: Response) => {
  const body = req.body as CompanyJobPostingRequest
  if (!body || !Array.isArray(body.messages)) {
    res.status(400).json({ error: 'messages is required.' })
    return
  }

  try {
    const client = getOpenAIClient()
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: buildCompanyJobPostingInput(body),
      max_output_tokens: COMPANY_JOB_POSTING_MAX_TOKENS,
      text: {
        format: {
          type: 'json_schema',
          name: COMPANY_JOB_POSTING_JSON_SCHEMA.name,
          schema: COMPANY_JOB_POSTING_JSON_SCHEMA.schema,
          strict: COMPANY_JOB_POSTING_JSON_SCHEMA.strict,
        },
      },
    })

    let result: CompanyJobPostingResponse
    try {
      result = JSON.parse(response.output_text) as CompanyJobPostingResponse
    } catch {
      res.status(502).json({ error: 'Failed to parse model output as JSON.' })
      return
    }

    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isConfig = message.includes('OPENAI_API_KEY')
    res.status(isConfig ? 500 : 502).json({ error: message })
  }
})