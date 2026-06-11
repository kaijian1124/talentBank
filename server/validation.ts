// ─── Pure, testable validation helpers for the candidate API ────────
import type {
  CandidateTurnRequest,
  GraphBuildResponse,
  GraphSummaryItem,
} from '../src/types/llmContract'
import type { CapabilityEdge, CapabilityNode } from '../src/types'

export interface ValidationResult<T> {
  ok: boolean
  value?: T
  error?: string
}

// Validate the incoming request body shared by both endpoints.
export function validateTurnRequest(body: unknown): ValidationResult<CandidateTurnRequest> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }
  const b = body as Record<string, unknown>

  if (typeof b.latestUserMessage !== 'string' || b.latestUserMessage.trim() === '') {
    return { ok: false, error: 'latestUserMessage is required and must be a non-empty string.' }
  }
  if (b.messages !== undefined && !Array.isArray(b.messages)) {
    return { ok: false, error: 'messages must be an array when provided.' }
  }
  if (b.graphSummary !== undefined && !Array.isArray(b.graphSummary)) {
    return { ok: false, error: 'graphSummary must be an array when provided.' }
  }

  const value: CandidateTurnRequest = {
    messages: Array.isArray(b.messages) ? (b.messages as CandidateTurnRequest['messages']) : [],
    latestUserMessage: b.latestUserMessage,
    graphSummary: Array.isArray(b.graphSummary)
      ? (b.graphSummary as GraphSummaryItem[])
      : [],
    domain: b.domain as CandidateTurnRequest['domain'],
    targetDirection: (b.targetDirection as string | null | undefined) ?? null,
  }
  return { ok: true, value }
}

// Validate LLM-proposed edges against the set of valid node ids.
// Valid ids = existing graph summary ids ∪ newly proposed node ids.
// Drops dangling edges, self-loops, and duplicate (from,to,type) edges.
export function validateGraphEdges(
  newNodes: CapabilityNode[],
  newEdges: CapabilityEdge[],
  existingSummary: GraphSummaryItem[] = []
): { edges: CapabilityEdge[]; dropped: number } {
  const validIds = new Set<string>()
  for (const n of newNodes) validIds.add(n.id)
  for (const s of existingSummary) validIds.add(s.id)

  const seen = new Set<string>()
  const edges: CapabilityEdge[] = []
  let dropped = 0

  for (const e of newEdges) {
    const fromOk = validIds.has(e.from)
    const toOk = validIds.has(e.to)
    const selfLoop = e.from === e.to
    const key = `${e.from}->${e.to}:${e.type}`
    const dup = seen.has(key)

    if (!fromOk || !toOk || selfLoop || dup) {
      dropped++
      continue
    }
    seen.add(key)
    edges.push(e)
  }

  return { edges, dropped }
}

// Apply edge validation to a full GraphBuildResponse, returning a cleaned copy.
export function sanitizeGraphBuildResponse(
  resp: GraphBuildResponse,
  existingSummary: GraphSummaryItem[] = []
): { response: GraphBuildResponse; droppedEdges: number } {
  const { edges, dropped } = validateGraphEdges(
    resp.newNodes ?? [],
    resp.newEdges ?? [],
    existingSummary
  )
  return { response: { ...resp, newEdges: edges }, droppedEdges: dropped }
}
