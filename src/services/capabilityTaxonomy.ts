// ─── Internal capability taxonomy placeholder (Step 1) ──────────────
// Small, hand-curated set of broad domains and common cross-domain
// capability labels. This is a placeholder ONLY — full ESCO ingestion
// is intentionally out of scope for this step. The LLM is not limited to
// these labels; they exist to seed prompts and future normalization.

import type { CandidateDomain } from '../types'

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
  engineering: ['CAD modelling', 'circuit design', 'structural analysis'],
  healthcare: ['nutrition assessment', 'meal planning', 'patient communication'],
  finance: ['financial modelling', 'auditing', 'risk analysis'],
  business: ['stakeholder management', 'financial analysis', 'negotiation'],
  creative: ['visual design', 'storytelling', 'content creation'],
  media_communications: ['copywriting', 'public relations', 'social media strategy'],
  education: ['lesson planning', 'tutoring', 'curriculum design'],
  research: ['literature review', 'experiment design', 'data interpretation'],
  operations: ['process improvement', 'logistics coordination', 'scheduling'],
  hospitality: ['guest service', 'event coordination', 'food & beverage operations'],
  public_sector: ['policy analysis', 'community outreach', 'case management'],
  skilled_trades: ['electrical wiring', 'welding', 'equipment maintenance'],
  general: ['communication', 'teamwork', 'adaptability'],
}
