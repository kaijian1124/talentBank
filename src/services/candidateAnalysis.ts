// ??? Frontend client for the candidate capability endpoints ?????????
// Same-origin calls (Vite proxies /api ??local server). The OpenAI key
// is never exposed here. Wired into ChatPage (candidate flow) + GraphPage.

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
  CapabilityNodeType,
  ChatMessage,
} from '../types'

const API_BASE = '/api/candidate'

const SOFT_SKILL_LABELS = new Set([
  'communication',
  'teamwork',
  'problem solving',
  'time management',
  'adaptability',
  'critical thinking',
  'self learning',
  'self-learning',
  'attention to detail',
  'leadership',
  'persistence',
])

// ??? Hot path: next question (consumes SSE stream) ??????????????????
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

// ??? Cold path: build graph deltas ??????????????????????????????????
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

export function preserveSelfClaimedSkills(
  delta: GraphBuildResponse,
  messages: ChatMessage[]
): GraphBuildResponse {
  const claimedItems = extractSelfClaimedItems(messages)
  if (claimedItems.length === 0) return limitGraphDeltaConfidence(delta)

  const existingNodes = [...delta.newNodes]
  const existingKeys = new Set(existingNodes.map(nodeSkillKey))
  const missingEvidence = new Set(delta.missingEvidence)

  for (const item of claimedItems) {
    const key = normaliseLabel(item.label)
    if (hasRelatedNode(existingNodes, key, item.type) || existingKeys.has(`${item.type}:${key}`)) {
      continue
    }

    existingNodes.push({
      id: `${nodePrefix(item.type)}_${key}`,
      type: item.type,
      label: item.label,
      domain: delta.domain,
      confidence: item.confidence,
      proficiency: item.proficiency,
      evidenceLevel: item.evidenceLevel,
      description: item.description,
    })
    if (item.type === 'capability') {
      missingEvidence.add(`Evidence for self-claimed skill: ${item.label}.`)
    }
  }

  return limitGraphDeltaConfidence({
    ...delta,
    newNodes: existingNodes,
    missingEvidence: [...missingEvidence],
  })
}

// ??? Pure helper: merge a build delta into an existing graph ????????
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
  const canonicalIdByMeaning = new Map<string, string>()

  for (const n of base.nodes) {
    canonicalIdByMeaning.set(nodeMeaningKey(n), n.id)
  }

  for (const incoming of delta.newNodes) {
    const existingId = nodeById.has(incoming.id)
      ? incoming.id
      : canonicalIdByMeaning.get(nodeMeaningKey(incoming))
    const id = existingId ?? incoming.id
    const current = nodeById.get(id)
    const cappedIncoming = applyConfidencePolicy(normaliseNodeType({ ...incoming, id }))
    const merged = current ? mergeNode(current, cappedIncoming) : cappedIncoming
    nodeById.set(id, merged)
    canonicalIdByMeaning.set(nodeMeaningKey(merged), id)
  }

  const edgeByKey = new Map<string, CapabilityEdge>(
    base.edges.map((e) => [`${e.from}->${e.to}:${e.type}`, e])
  )
  for (const e of delta.newEdges) {
    const from = canonicalNodeId(e.from, nodeById, canonicalIdByMeaning)
    const to = canonicalNodeId(e.to, nodeById, canonicalIdByMeaning)
    if (!from || !to || from === to) continue
    edgeByKey.set(`${from}->${to}:${e.type}`, { ...e, from, to, id: e.id || uuidv4() })
  }

  const missingEvidence = Array.from(new Set([
    ...base.missingEvidence,
    ...delta.missingEvidence,
  ].map((item) => item.trim()).filter(Boolean)))

  return {
    nodes: [...nodeById.values()],
    edges: [...edgeByKey.values()],
    confidence: smoothConfidence(base.confidence, delta.confidence),
    missingEvidence,
    generatedAt: Date.now(),
  }
}

// ??? Pure helper: compact summary to pass back into prompts ?????????
export function toGraphSummary(graph: CandidateCapabilityGraph | null): GraphSummaryItem[] {
  if (!graph) return []
  return graph.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type }))
}

// ??? internals ??????????????????????????????????????????????????????
function parseSseFrame(frame: string): { event?: string; data?: string } {
  let event: string | undefined
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  return { event, data: dataLines.length ? dataLines.join('\n') : undefined }
}

function mergeNode(current: CapabilityNode, incoming: CapabilityNode): CapabilityNode {
  return applyConfidencePolicy({
    ...current,
    ...incoming,
    id: current.id,
    label: current.label || incoming.label,
    confidence: smoothConfidence(current.confidence, incoming.confidence),
    proficiency: smoothProficiency(current.proficiency, incoming.proficiency),
    evidenceLevel: strongerEvidence(current.evidenceLevel, incoming.evidenceLevel),
    description: incoming.description || current.description,
    taxonomyId: incoming.taxonomyId ?? current.taxonomyId,
  })
}

function smoothConfidence(current = 0, incoming = 0): number {
  if (current <= 0) return clampConfidence(incoming)
  if (incoming <= 0) return clampConfidence(current)
  const maxStep = 0.12
  const diff = incoming - current
  const adjusted = current + Math.max(-maxStep, Math.min(maxStep, diff))
  return clampConfidence(Math.max(adjusted, current))
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))))
}

// Proficiency (mastery estimate) is tracked separately from confidence and
// may move in either direction as more is learned, so it is not forced to be
// monotonic. null means "not meaningful for this node type".
function clampProficiency(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Math.max(0, Math.min(1, Number(value.toFixed(2))))
}

function smoothProficiency(
  current: number | null | undefined,
  incoming: number | null | undefined
): number | null {
  const c = clampProficiency(current)
  const i = clampProficiency(incoming)
  if (i === null) return c
  if (c === null) return i
  const maxStep = 0.15
  const diff = i - c
  return clampProficiency(c + Math.max(-maxStep, Math.min(maxStep, diff)))
}

function strongerEvidence(
  current: CapabilityNode['evidenceLevel'],
  incoming: CapabilityNode['evidenceLevel']
): CapabilityNode['evidenceLevel'] {
  const rank = [
    undefined,
    'self_claimed',
    'conversation_supported',
    'conversation_verified',
    'project_supported',
    'artifact_supported',
    'externally_validated',
  ]
  return rank.indexOf(incoming) > rank.indexOf(current) ? incoming : current
}

function normaliseNodeType(node: CapabilityNode): CapabilityNode {
  return node.type === 'capability' && isSoftSkillLabel(node.label)
    ? { ...node, type: 'trait' }
    : node
}

function isSoftSkillLabel(label: string): boolean {
  return SOFT_SKILL_LABELS.has(label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
}

function nodeMeaningKey(node: CapabilityNode): string {
  return `${node.type}:${normaliseLabel(node.label)}`
}

function nodeSkillKey(node: CapabilityNode): string {
  return `${node.type}:${normaliseLabel(node.label)}`
}

function limitGraphDeltaConfidence(delta: GraphBuildResponse): GraphBuildResponse {
  return {
    ...delta,
    confidence: clampConfidence(delta.confidence),
    newNodes: delta.newNodes.map(applyConfidencePolicy),
    newCapabilities: delta.newCapabilities.map((claim) => ({
      ...claim,
      confidence: capConfidenceForEvidence(
        claim.confidence,
        claim.evidenceLevel,
        claim.label,
        'capability'
      ),
      proficiency: clampProficiency(claim.proficiency),
    })),
  }
}

function applyConfidencePolicy(node: CapabilityNode): CapabilityNode {
  return {
    ...node,
    confidence: capConfidenceForEvidence(
      node.confidence,
      node.evidenceLevel,
      node.label,
      node.type
    ),
    proficiency: clampProficiency(node.proficiency),
  }
}

function capConfidenceForEvidence(
  confidence = 0,
  evidenceLevel: CapabilityNode['evidenceLevel'],
  label: string,
  type: CapabilityNodeType
): number {
  const evidenceCap = evidenceConfidenceCap(evidenceLevel)
  const credentialCap = requiresCredential(label, type) && !hasExternalProof(evidenceLevel) ? 0.8 : 1
  return clampConfidence(Math.min(confidence, evidenceCap, credentialCap))
}

function evidenceConfidenceCap(evidenceLevel: CapabilityNode['evidenceLevel']): number {
  switch (evidenceLevel) {
    case 'self_claimed':
    case undefined:
      return 0.4
    case 'conversation_supported':
      return 0.6
    case 'conversation_verified':
      return 0.8
    case 'project_supported':
      return 0.9
    case 'artifact_supported':
    case 'externally_validated':
      return 1
    default:
      return 0.6
  }
}

function requiresCredential(label: string, type: CapabilityNodeType): boolean {
  if (type !== 'capability') return false
  const key = normaliseLabel(label)
  return CERTIFICATION_CAPPED_SKILLS.some((skill) => key.includes(skill))
}

function hasExternalProof(evidenceLevel: CapabilityNode['evidenceLevel']): boolean {
  return evidenceLevel === 'artifact_supported' || evidenceLevel === 'externally_validated'
}

function normaliseLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\bc\+\+\b/g, 'cpp')
    .replace(/\bc sharp\b/g, 'csharp')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
}

function canonicalNodeId(
  id: string,
  nodeById: Map<string, CapabilityNode>,
  canonicalIdByMeaning: Map<string, string>
): string | null {
  if (nodeById.has(id)) return id
  const normalisedId = normaliseLabel(id.replace(/^(cap|exp|out|ctx|trait|target)_/, ''))
  for (const node of nodeById.values()) {
    if (normaliseLabel(node.id) === normaliseLabel(id)) return node.id
    if (normaliseLabel(node.label) === normalisedId) return node.id
    const canonical = canonicalIdByMeaning.get(nodeMeaningKey(node))
    if (canonical && normaliseLabel(canonical) === normaliseLabel(id)) return canonical
  }
  return null
}

const KNOWN_SKILL_ALIASES: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'Java', patterns: [/\bjava\b/i] },
  { label: 'JavaScript', patterns: [/\bjavascript\b/i, /\bjs\b/i] },
  { label: 'TypeScript', patterns: [/\btypescript\b/i, /\bts\b/i] },
  { label: 'Python', patterns: [/\bpython\b/i] },
  { label: 'C++', patterns: [/\bc\+\+\b/i, /\bcpp\b/i] },
  { label: 'C#', patterns: [/\bc#\b/i, /\bc sharp\b/i] },
  { label: 'Bash', patterns: [/\bbash\b/i, /\bshell scripting\b/i] },
  { label: 'Machine Learning', patterns: [/\bmachine learning\b/i, /\bml\b/i] },
  { label: 'Cloud', patterns: [/\bcloud\b/i, /\baws\b/i, /\bazure\b/i, /\bgcp\b/i] },
  { label: 'SQL', patterns: [/\bsql\b/i] },
  { label: 'React', patterns: [/\breact\b/i] },
  { label: 'Node.js', patterns: [/\bnode\.?js\b/i] },
  { label: 'Docker', patterns: [/\bdocker\b/i] },
  { label: 'Git', patterns: [/\bgit\b/i, /\bgithub\b/i] },
]

const KNOWN_SOFT_SKILL_ALIASES: Array<{
  label: string
  confidence: number
  patterns: RegExp[]
}> = [
  { label: 'Problem Solving', confidence: 0.55, patterns: [/\bsolve[ds]?\b/i, /\bsolution\b/i, /\bdebug/i, /\bfix(?:ed)?\b/i] },
  { label: 'Self Learning', confidence: 0.5, patterns: [/\blearn(?:ed|t)? by myself\b/i, /\bself[- ]learn/i, /\bresearch(?:ed)?\b/i, /\blook(?:ed)? up\b/i] },
  { label: 'Communication', confidence: 0.5, patterns: [/\bask(?:ed)?\b/i, /\bexplain(?:ed)?\b/i, /\bdiscuss(?:ed)?\b/i, /\bpresent(?:ed)?\b/i] },
  { label: 'Attention to Detail', confidence: 0.5, patterns: [/\bconsistent\b/i, /\bdetail\b/i, /\bcheck(?:ed)?\b/i, /\bvalidate/i] },
  { label: 'Persistence', confidence: 0.5, patterns: [/\bdifficult/i, /\bobstacle\b/i, /\bchallenge\b/i, /\btried\b/i] },
  { label: 'Teamwork', confidence: 0.45, patterns: [/\bteam\b/i, /\bcollaborat/i, /\bgroup\b/i] },
  { label: 'Leadership', confidence: 0.45, patterns: [/\bled\b/i, /\bleadership\b/i, /\bmanaged\b/i, /\borganised\b/i, /\borganized\b/i] },
]

const CERTIFICATION_CAPPED_SKILLS = [
  'java',
  'cloud',
  'aws',
  'azure',
  'gcp',
  'machine_learning',
  'sql',
  'docker',
  'git',
  'python',
]

type ClaimedGraphItem = {
  label: string
  type: Extract<CapabilityNodeType, 'capability' | 'trait'>
  confidence: number
  proficiency: number
  evidenceLevel: NonNullable<CapabilityNode['evidenceLevel']>
  description: string
}

function extractSelfClaimedItems(messages: ChatMessage[]): ClaimedGraphItem[] {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n')

  const found = new Map<string, ClaimedGraphItem>()
  for (const skill of KNOWN_SKILL_ALIASES) {
    if (skill.patterns.some((pattern) => pattern.test(userText))) {
      found.set(normaliseLabel(skill.label), {
        label: skill.label,
        type: 'capability',
        confidence: 0.35,
        proficiency: 0.3,
        evidenceLevel: 'self_claimed',
        description: `Candidate listed ${skill.label} during the skill inventory.`,
      })
    }
  }

  for (const trait of KNOWN_SOFT_SKILL_ALIASES) {
    if (trait.patterns.some((pattern) => pattern.test(userText))) {
      found.set(`trait:${normaliseLabel(trait.label)}`, {
        label: trait.label,
        type: 'trait',
        confidence: trait.confidence,
        proficiency: trait.confidence,
        evidenceLevel: 'conversation_supported',
        description: `Inferred from how the candidate described obstacles, actions, or resolution.`,
      })
    }
  }
  return [...found.values()]
}

function hasRelatedNode(nodes: CapabilityNode[], skillKey: string, type: CapabilityNodeType): boolean {
  return nodes.some((node) => {
    if (node.type !== type) return false
    const labelKey = normaliseLabel(node.label)
    const idKey = normaliseLabel(node.id)
    return labelKey === skillKey || idKey.endsWith(skillKey) || labelKey.includes(skillKey)
  })
}

function nodePrefix(type: CapabilityNodeType): string {
  if (type === 'trait') return 'trait'
  if (type === 'experience') return 'exp'
  if (type === 'outcome') return 'out'
  if (type === 'context') return 'ctx'
  if (type === 'target_direction') return 'target'
  if (type === 'evidence_gap') return 'gap'
  return 'cap'
}

async function safeReadError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: string }
    return body.error ?? null
  } catch {
    return null
  }
}
