// ─── LLM structured-output contracts (Step 1 backbone) ──────────────
// Two wire contracts, one per endpoint:
//   - NextQuestionResponse  → POST /api/candidate/next-question (hot path)
//   - GraphBuildResponse    → POST /api/candidate/build-graph   (cold path)
// Each ships with a JSON Schema constant for OpenAI Structured Outputs,
// exported so the client and server agree on the exact shape.

import type {
  CandidateDomain,
  CapabilityClaim,
  CapabilityEdge,
  CapabilityNode,
  CapabilityNodeType,
  CapabilityEdgeType,
  MeaningfulExperience,
  MeaningfulExperienceKind,
  ChatMessage,
} from './index'

// ─── Shared enum value lists (single source of truth for schemas) ──
export const CANDIDATE_DOMAINS: CandidateDomain[] = [
  'technology',
  'healthcare',
  'creative',
  'business',
  'education',
  'research',
  'operations',
  'general',
]

export const CAPABILITY_NODE_TYPES: CapabilityNodeType[] = [
  'capability',
  'experience',
  'outcome',
  'context',
  'target_direction',
  'evidence_gap',
  'trait',
]

export const CAPABILITY_EDGE_TYPES: CapabilityEdgeType[] = [
  'demonstrates',
  'supports',
  'transfers_to',
  'produced',
  'performed_in',
  'indicates',
  'needs_evidence',
]

export const MEANINGFUL_EXPERIENCE_KINDS: MeaningfulExperienceKind[] = [
  'internship',
  'placement',
  'portfolio',
  'assignment',
  'case_work',
  'customer_interaction',
  'leadership',
  'research',
  'volunteering',
  'other',
]

// ─── Shared request shapes ─────────────────────────────────────────
// Compact summary of the existing graph passed into prompts instead of
// full node objects, to keep input tokens low.
export interface GraphSummaryItem {
  id: string
  label: string
  type: CapabilityNodeType
}

export interface CandidateTurnRequest {
  messages: ChatMessage[]
  latestUserMessage: string
  graphSummary?: GraphSummaryItem[]
  domain?: CandidateDomain
  targetDirection?: string | null
}

// ─── Hot path: next-question response ──────────────────────────────
export interface NextQuestionResponse {
  nextQuestion: string
  detectedDomain: CandidateDomain
  targetDirection: string | null
  readyToBuild: boolean
  coverageNote?: string
}

// ─── Cold path: graph build (delta-first) response ─────────────────
export interface GraphBuildResponse {
  domain: CandidateDomain
  targetDirection: string | null
  newCapabilities: CapabilityClaim[]
  newExperiences: MeaningfulExperience[]
  newNodes: CapabilityNode[]
  newEdges: CapabilityEdge[]
  missingEvidence: string[]
  confidence: number
  interviewSummary: string
}

// Downstream convenience alias (used in a later UX step). The actual
// wire contracts remain the two interfaces above.
export interface CandidateInterviewAnalysis
  extends NextQuestionResponse,
    Omit<GraphBuildResponse, 'domain' | 'targetDirection'> {}

// ─── JSON Schemas for OpenAI Structured Outputs ────────────────────
// Note: OpenAI strict structured outputs require `additionalProperties:false`
// and every property listed in `required`. Optional fields are modelled as
// nullable instead of omitted.

export const NEXT_QUESTION_JSON_SCHEMA = {
  name: 'next_question_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      nextQuestion: { type: 'string' },
      detectedDomain: { type: 'string', enum: CANDIDATE_DOMAINS },
      targetDirection: { type: ['string', 'null'] },
      readyToBuild: { type: 'boolean' },
      coverageNote: { type: ['string', 'null'] },
    },
    required: [
      'nextQuestion',
      'detectedDomain',
      'targetDirection',
      'readyToBuild',
      'coverageNote',
    ],
  },
} as const

const capabilityClaimSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    label: { type: 'string' },
    domain: { type: 'string', enum: CANDIDATE_DOMAINS },
    rawText: { type: 'string' },
    confidence: { type: 'number' },
    evidenceLevel: { type: 'string' },
    sourceMessageIds: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'id',
    'label',
    'domain',
    'rawText',
    'confidence',
    'evidenceLevel',
    'sourceMessageIds',
  ],
} as const

const meaningfulExperienceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    kind: { type: 'string', enum: MEANINGFUL_EXPERIENCE_KINDS },
    organization: { type: ['string', 'null'] },
    description: { type: 'string' },
    outcomes: { type: 'array', items: { type: 'string' } },
    domain: { type: 'string', enum: CANDIDATE_DOMAINS },
    sourceMessageIds: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'id',
    'title',
    'kind',
    'organization',
    'description',
    'outcomes',
    'domain',
    'sourceMessageIds',
  ],
} as const

const capabilityNodeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: CAPABILITY_NODE_TYPES },
    label: { type: 'string' },
    domain: { type: ['string', 'null'], enum: [...CANDIDATE_DOMAINS, null] },
    confidence: { type: 'number' },
    evidenceLevel: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
  },
  required: ['id', 'type', 'label', 'domain', 'confidence', 'evidenceLevel', 'description'],
} as const

const capabilityEdgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    type: { type: 'string', enum: CAPABILITY_EDGE_TYPES },
    weight: { type: ['number', 'null'] },
    reason: { type: ['string', 'null'] },
  },
  required: ['id', 'from', 'to', 'type', 'weight', 'reason'],
} as const

export const GRAPH_BUILD_JSON_SCHEMA = {
  name: 'graph_build_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      domain: { type: 'string', enum: CANDIDATE_DOMAINS },
      targetDirection: { type: ['string', 'null'] },
      newCapabilities: { type: 'array', items: capabilityClaimSchema },
      newExperiences: { type: 'array', items: meaningfulExperienceSchema },
      newNodes: { type: 'array', items: capabilityNodeSchema },
      newEdges: { type: 'array', items: capabilityEdgeSchema },
      missingEvidence: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' },
      interviewSummary: { type: 'string' },
    },
    required: [
      'domain',
      'targetDirection',
      'newCapabilities',
      'newExperiences',
      'newNodes',
      'newEdges',
      'missingEvidence',
      'confidence',
      'interviewSummary',
    ],
  },
} as const
