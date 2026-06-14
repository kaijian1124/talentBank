// ??? LLM structured-output contracts (Step 1 backbone) ??????????????
// Two wire contracts, one per endpoint:
//   - NextQuestionResponse  ??POST /api/candidate/next-question (hot path)
//   - GraphBuildResponse    ??POST /api/candidate/build-graph   (cold path)
// Each ships with a JSON Schema constant for OpenAI Structured Outputs,
// exported so the client and server agree on the exact shape.

import type {
  CandidateDomain,
  CapabilityClaim,
  CapabilityEdge,
  CapabilityNode,
  CapabilityNodeType,
  CapabilityEdgeType,
  EvidenceLevel,
  MeaningfulExperience,
  MeaningfulExperienceKind,
  ChatMessage,
} from './index'

// ??? Shared enum value lists (single source of truth for schemas) ??
export const CANDIDATE_DOMAINS: CandidateDomain[] = [
  'technology',
  'engineering',
  'healthcare',
  'finance',
  'business',
  'creative',
  'media_communications',
  'education',
  'research',
  'operations',
  'hospitality',
  'public_sector',
  'skilled_trades',
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
  'preference',
  'credential',
]

export const CAPABILITY_EDGE_TYPES: CapabilityEdgeType[] = [
  'demonstrates',
  'supports',
  'transfers_to',
  'produced',
  'performed_in',
  'indicates',
  'needs_evidence',
  'requires',
  'part_of',
  'prefers',
]

export const EVIDENCE_LEVELS: EvidenceLevel[] = [
  'self_claimed',
  'conversation_supported',
  'conversation_verified',
  'project_supported',
  'artifact_supported',
  'externally_validated',
]

export const MEANINGFUL_EXPERIENCE_KINDS: MeaningfulExperienceKind[] = [
  'internship',
  'capstone',
  'coursework',
  'competition',
  'placement',
  'portfolio',
  'assignment',
  'case_work',
  'customer_interaction',
  'leadership',
  'club_leadership',
  'part_time',
  'research',
  'volunteering',
  'other',
]

// ??? Phased intake vocabulary ??????????????????????????????????????
export type IntakePhase = 'anchor' | 'breadth' | 'depth' | 'ready'
export type QuestionFormat = 'single_select' | 'multi_select' | 'open'
export type OptionRequestKind = 'none' | 'domain' | 'role' | 'skills_for_role'
export type StructuredOptionSource = 'seed' | 'esco' | 'ai_suggested' | 'manual'

export const INTAKE_PHASES: IntakePhase[] = ['anchor', 'breadth', 'depth', 'ready']
export const QUESTION_FORMATS: QuestionFormat[] = ['single_select', 'multi_select', 'open']
export const OPTION_REQUEST_KINDS: OptionRequestKind[] = ['none', 'domain', 'role', 'skills_for_role']

export interface OptionRequest {
  kind: OptionRequestKind
  domain: CandidateDomain | null
  roleId: string | null
}

export interface StructuredOption {
  id: string
  label: string
  source: StructuredOptionSource
  group: string | null
  essential: boolean | null
}

export interface StructuredQuestion {
  id: string
  prompt: string
  format: QuestionFormat
  phase: IntakePhase
  options: StructuredOption[]
  allowManualEntry: boolean
}

export interface StructuredAnswer {
  questionId: string
  phase: IntakePhase
  selectedOptionIds: string[]
  selectedLabels: string[]
  manualEntries: string[]
}

// ??? Shared request shapes ?????????????????????????????????????????
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
  structuredAnswers?: StructuredAnswer[]
  phase?: IntakePhase
  graphSummary?: GraphSummaryItem[]
  domain?: CandidateDomain
  targetDirection?: string | null
}

// ??? Hot path: next-question response ??????????????????????????????
export interface NextQuestionLLMOutput {
  phase: IntakePhase
  questionFormat: QuestionFormat
  nextQuestion: string
  optionRequest: OptionRequest
  detectedDomain: CandidateDomain
  targetDirection: string | null
  readyToBuild: boolean
  coverageNote: string | null
}

export interface NextQuestionResponse {
  phase: IntakePhase
  questionFormat: QuestionFormat
  nextQuestion: string
  structuredQuestion: StructuredQuestion | null
  detectedDomain: CandidateDomain
  targetDirection: string | null
  readyToBuild: boolean
  coverageNote?: string
}

// ??? Cold path: graph build (delta-first) response ?????????????????
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

// ??? JSON Schemas for OpenAI Structured Outputs ????????????????????
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
      phase: { type: 'string', enum: INTAKE_PHASES },
      questionFormat: { type: 'string', enum: QUESTION_FORMATS },
      nextQuestion: { type: 'string' },
      optionRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string', enum: OPTION_REQUEST_KINDS },
          domain: { type: ['string', 'null'], enum: [...CANDIDATE_DOMAINS, null] },
          roleId: { type: ['string', 'null'] },
        },
        required: ['kind', 'domain', 'roleId'],
      },
      detectedDomain: { type: 'string', enum: CANDIDATE_DOMAINS },
      targetDirection: { type: ['string', 'null'] },
      readyToBuild: { type: 'boolean' },
      coverageNote: { type: ['string', 'null'] },
    },
    required: [
      'phase',
      'questionFormat',
      'nextQuestion',
      'optionRequest',
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
    proficiency: { type: ['number', 'null'] },
    evidenceLevel: { type: 'string', enum: EVIDENCE_LEVELS },
    sourceMessageIds: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'id',
    'label',
    'domain',
    'rawText',
    'confidence',
    'proficiency',
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
    proficiency: { type: ['number', 'null'] },
    evidenceLevel: { type: ['string', 'null'], enum: [...EVIDENCE_LEVELS, null] },
    taxonomyId: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
  },
  required: ['id', 'type', 'label', 'domain', 'confidence', 'proficiency', 'evidenceLevel', 'taxonomyId', 'description'],
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

// Company hiring intake -> job_postings draft
export interface CompanyJobPostingRequest {
  messages: ChatMessage[]
  fallbackCompanyName?: string
}

export interface CompanyJobPostingResponse {
  companyName: string
  title: string
  description: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string
  companyIntro: string | null
  location: string | null
  employmentType: string | null
}

export const COMPANY_JOB_POSTING_JSON_SCHEMA = {
  name: 'company_job_posting',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'companyName',
      'title',
      'description',
      'salaryMin',
      'salaryMax',
      'salaryCurrency',
      'companyIntro',
      'location',
      'employmentType',
    ],
    properties: {
      companyName: { type: 'string', minLength: 1 },
      title: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      salaryMin: { type: ['number', 'null'] },
      salaryMax: { type: ['number', 'null'] },
      salaryCurrency: { type: 'string', minLength: 1 },
      companyIntro: { type: ['string', 'null'] },
      location: { type: ['string', 'null'] },
      employmentType: { type: ['string', 'null'] },
    },
  },
} as const