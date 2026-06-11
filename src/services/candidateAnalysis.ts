// ─── Frontend client for the candidate capability endpoints ─────────
// Same-origin calls (Vite proxies /api → local server). The OpenAI key
// is never exposed here. NOT wired into ChatPage yet — available for the
// next UX step.

import { v4 as uuidv4 } from 'uuid'
import type {
  CandidateTurnRequest,
  GraphBuildResponse,
  GraphSummaryItem,
  NextQuestionResponse,
} from '../types/llmContract'
import type {
  CandidateCapabilityGraph,
  CapabilityEdge,
  CapabilityNode,
} from '../types'

const API_BASE = '/api/candidate'

// ─── Hot path: next question (consumes SSE stream) ──────────────────
// onToken (optional) receives incremental raw JSON text deltas for
// progress UIs. The resolved value is the fully parsed response.
export async function getNextQuestion(
  input: CandidateTurnRequest,
  onToken?: (text: string) => void
): Promise<NextQuestionResponse> {
  const res = await fetch(`${API_BASE}/next-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok || !res.body) {
    const detail = await safeReadError(res)
    throw new Error(detail ?? `next-question failed with status ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: NextQuestionResponse | null = null
  let streamError: string | null = null

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line.
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const { event, data } = parseSseFrame(frame)
      if (!event) continue
      if (event === 'delta' && onToken && data) {
        try {
          onToken((JSON.parse(data) as { text: string }).text)
        } catch {
          /* ignore malformed delta */
        }
      } else if (event === 'done' && data) {
        result = JSON.parse(data) as NextQuestionResponse
      } else if (event === 'error' && data) {
        streamError = (JSON.parse(data) as { error: string }).error
      }
    }
  }

  if (streamError) throw new Error(streamError)
  if (!result) throw new Error('next-question stream ended without a result.')
  return result
}

// ─── Cold path: build graph deltas ──────────────────────────────────
export async function buildCapabilityGraph(
  input: CandidateTurnRequest
): Promise<GraphBuildResponse> {
  const res = await fetch(`${API_BASE}/build-graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const detail = await safeReadError(res)
    throw new Error(detail ?? `build-graph failed with status ${res.status}`)
  }
  return (await res.json()) as GraphBuildResponse
}

// ─── Pure helper: merge a build delta into an existing graph ────────
export function mergeGraphDelta(
  graph: CandidateCapabilityGraph | null,
  delta: GraphBuildResponse
): CandidateCapabilityGraph {
  const base: CandidateCapabilityGraph = graph ?? {
    nodes: [],
    edges: [],
    confidence: 0,
    missingEvidence: [],
    generatedAt: Date.now(),
  }

  const nodeById = new Map<string, CapabilityNode>(base.nodes.map((n) => [n.id, n]))
  for (const n of delta.newNodes) nodeById.set(n.id, { ...nodeById.get(n.id), ...n })

  const edgeByKey = new Map<string, CapabilityEdge>(
    base.edges.map((e) => [`${e.from}->${e.to}:${e.type}`, e])
  )
  for (const e of delta.newEdges) {
    edgeByKey.set(`${e.from}->${e.to}:${e.type}`, { ...e, id: e.id || uuidv4() })
  }

  return {
    nodes: [...nodeById.values()],
    edges: [...edgeByKey.values()],
    confidence: delta.confidence,
    missingEvidence: delta.missingEvidence,
    generatedAt: Date.now(),
  }
}

// ─── Pure helper: compact summary to pass back into prompts ─────────
export function toGraphSummary(graph: CandidateCapabilityGraph | null): GraphSummaryItem[] {
  if (!graph) return []
  return graph.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type }))
}

// ─── internals ──────────────────────────────────────────────────────
function parseSseFrame(frame: string): { event?: string; data?: string } {
  let event: string | undefined
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  return { event, data: dataLines.length ? dataLines.join('\n') : undefined }
}

async function safeReadError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? null
  } catch {
    return null
  }
}
