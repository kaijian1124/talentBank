// Candidate capability endpoints
import { Router } from 'express'
import type { Request, Response } from 'express'
import { getOpenAIClient, OPENAI_MODEL } from '../openaiClient'
import { buildGraphBuildInput, buildNextQuestionInput } from '../prompts'
import { sanitizeGraphBuildResponse, validateTurnRequest } from '../validation'
import { buildNextQuestionResponse } from '../structuredOptions'
import {
  GRAPH_BUILD_JSON_SCHEMA,
  NEXT_QUESTION_JSON_SCHEMA,
} from '../../src/types/llmContract'
import type {
  GraphBuildResponse,
  NextQuestionLLMOutput,
} from '../../src/types/llmContract'

const NEXT_QUESTION_MAX_TOKENS = 400
const GRAPH_BUILD_MAX_TOKENS = 2000
const CAREER_MODULES_MAX_TOKENS = 900

export const candidateRouter = Router()

// Hot path: streamed next question (SSE)
candidateRouter.post('/next-question', async (req: Request, res: Response) => {
  const parsed = validateTurnRequest(req.body)
  if (!parsed.ok || !parsed.value) {
    res.status(400).json({ error: parsed.error })
    return
  }

  // Set up Server-Sent Events.
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const client = getOpenAIClient()
    const stream = await client.responses.create({
      model: OPENAI_MODEL,
      input: buildNextQuestionInput(parsed.value),
      max_output_tokens: NEXT_QUESTION_MAX_TOKENS,
      text: {
        format: {
          type: 'json_schema',
          name: NEXT_QUESTION_JSON_SCHEMA.name,
          schema: NEXT_QUESTION_JSON_SCHEMA.schema,
          strict: NEXT_QUESTION_JSON_SCHEMA.strict,
        },
      },
      stream: true,
    })

    let accumulated = ''
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        accumulated += event.delta
        send('delta', { text: event.delta })
      }
    }

    let llmOutput: NextQuestionLLMOutput
    try {
      llmOutput = JSON.parse(accumulated) as NextQuestionLLMOutput
    } catch {
      send('error', { error: 'Failed to parse model output as JSON.' })
      res.end()
      return
    }

    // Server fills structured-question options from the seed before sending.
    const final = buildNextQuestionResponse(llmOutput, parsed.value)
    send('done', final)
    res.end()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Headers already sent (SSE), so report the error as an SSE event.
    send('error', { error: message })
    res.end()
  }
})

// Cold path: build graph deltas (JSON)
candidateRouter.post('/build-graph', async (req: Request, res: Response) => {
  const parsed = validateTurnRequest(req.body)
  if (!parsed.ok || !parsed.value) {
    res.status(400).json({ error: parsed.error })
    return
  }

  try {
    const client = getOpenAIClient()
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: buildGraphBuildInput(parsed.value),
      max_output_tokens: GRAPH_BUILD_MAX_TOKENS,
      text: {
        format: {
          type: 'json_schema',
          name: GRAPH_BUILD_JSON_SCHEMA.name,
          schema: GRAPH_BUILD_JSON_SCHEMA.schema,
          strict: GRAPH_BUILD_JSON_SCHEMA.strict,
        },
      },
    })

    let result: GraphBuildResponse
    try {
      result = JSON.parse(response.output_text) as GraphBuildResponse
    } catch {
      res.status(502).json({ error: 'Failed to parse model output as JSON.' })
      return
    }

    const { response: clean, droppedEdges } = sanitizeGraphBuildResponse(
      result,
      parsed.value.graphSummary
    )

    res.json({ ...clean, _meta: { droppedEdges } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isConfig = message.includes('OPENAI_API_KEY')
    res.status(isConfig ? 500 : 502).json({ error: message })
  }
})

candidateRouter.post('/career-modules', async (req: Request, res: Response) => {
  const body = req.body as {
    candidate?: unknown
    jobs?: unknown
    fallback?: unknown
  }

  if (!body.candidate || !body.fallback) {
    res.status(400).json({ error: 'candidate and fallback are required.' })
    return
  }

  try {
    const client = getOpenAIClient()
    const response = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [
            'You are TalentBank Career OS for candidates.',
            'Return only valid JSON matching the requested shape.',
            'Do not invent market salary data. Use the provided salary range only.',
            'Do not estimate expectedSalary. Use candidate.expectedSalary from the input. If it is missing, return null.',
            'Pay fit must evaluate candidate.expectedSalary against the provided salary range and evidence; return Unknown when expectedSalary or salary range is missing.',
            'Keep all text concise, practical, and in English.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify(body),
        },
      ],
      max_output_tokens: CAREER_MODULES_MAX_TOKENS,
      text: {
        format: {
          type: 'json_schema',
          name: 'candidate_career_modules',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['source', 'careerCoach', 'fairPay', 'lifeChapter'],
            properties: {
              source: { type: 'string', enum: ['llm'] },
              careerCoach: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'nextActions', 'projectSuggestion', 'interviewStory'],
                properties: {
                  title: { type: 'string' },
                  nextActions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
                  projectSuggestion: { type: 'string' },
                  interviewStory: { type: 'string' },
                },
              },
              fairPay: {
                type: 'object',
                additionalProperties: false,
                required: ['expectedSalary', 'payFit', 'negotiationNote'],
                properties: {
                  expectedSalary: { type: ['number', 'null'] },
                  payFit: { type: 'string', enum: ['Good', 'Bad', 'Unknown'] },
                  negotiationNote: { type: 'string' },
                },
              },
              lifeChapter: {
                type: 'object',
                additionalProperties: false,
                required: ['chapter', 'priorities', 'matchingAdvice'],
                properties: {
                  chapter: { type: 'string' },
                  priorities: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
                  matchingAdvice: { type: 'string' },
                },
              },
            },
          },
        },
      },
    })

    res.json(JSON.parse(response.output_text))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isConfig = message.includes('OPENAI_API_KEY')
    res.status(isConfig ? 500 : 502).json({ error: message })
  }
})