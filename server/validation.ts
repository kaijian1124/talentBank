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

// Ensure every extracted capability/experience is represented as a graph node.
// The LLM returns these in dedicated arrays; mirroring them into `newNodes`
// (when not already present) guarantees a complete graph and keeps edges that
// reference their ids from being dropped during validation.
export function synthesizeNodesFromClaims(resp: GraphBuildResponse): CapabilityNode[] {
  const byId = new Map<string, CapabilityNode>()
  for (const n of resp.newNodes ?? []) byId.set(n.id, n)

  for (const c of resp.newCapabilities ?? []) {
    if (!byId.has(c.id)) {
      byId.set(c.id, {
        id: c.id,
        type: 'capability',
        label: c.label,
        domain: c.domain,
        confidence: c.confidence,
        evidenceLevel: c.evidenceLevel,
        description: c.rawText,
      })
    }
  }

  for (const e of resp.newExperiences ?? []) {
    if (!byId.has(e.id)) {
      byId.set(e.id, {
        id: e.id,
        type: 'experience',
        label: e.title,
        domain: e.domain,
        confidence: resp.confidence,
        description: e.description,
      })
    }
  }

  return [...byId.values()]
}

// Apply node synthesis + edge validation to a full GraphBuildResponse.
export function sanitizeGraphBuildResponse(
  resp: GraphBuildResponse,
  existingSummary: GraphSummaryItem[] = []
): { response: GraphBuildResponse; droppedEdges: number } {
  const newNodes = synthesizeNodesFromClaims(resp)
  const { edges, dropped } = validateGraphEdges(
    newNodes,
    resp.newEdges ?? [],
    existingSummary
  )
  return { response: { ...resp, newNodes, newEdges: edges }, droppedEdges: dropped }
}
