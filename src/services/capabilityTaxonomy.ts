// ─── Internal capability taxonomy placeholder (Step 1) ──────────────
// Small, hand-curated set of broad domains and common cross-domain
// capability labels. This is a placeholder ONLY — full ESCO ingestion
// is intentionally out of scope for this step. The LLM is not limited to
// these labels; they exist to seed prompts and future normalization.

import type { CandidateDomain } from '../types'

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

// Broadly-applicable capabilities that show up across many domains.
export const COMMON_CAPABILITY_LABELS: string[] = [
  'communication',
  'written communication',
  'collaboration',
  'planning',
  'problem solving',
  'analysis',
  'attention to detail',
  'leadership',
  'time management',
  'research',
  'customer service',
  'data analysis',
]

// A few domain-flavoured examples to illustrate cross-domain breadth.
export const DOMAIN_CAPABILITY_EXAMPLES: Record<CandidateDomain, string[]> = {
  technology: ['software development', 'debugging', 'system design'],
  healthcare: ['nutrition assessment', 'meal planning', 'patient communication'],
  creative: ['visual design', 'storytelling', 'content creation'],
  business: ['stakeholder management', 'financial analysis', 'negotiation'],
  education: ['lesson planning', 'tutoring', 'curriculum design'],
  research: ['literature review', 'experiment design', 'data interpretation'],
  operations: ['process improvement', 'logistics coordination', 'scheduling'],
  general: ['communication', 'teamwork', 'adaptability'],
}
