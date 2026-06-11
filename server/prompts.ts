// ─── Prompt builders for the candidate endpoints ────────────────────
// Kept separate so the large, STABLE system instructions sit at the top
// of every request (maximizing OpenAI's automatic cached-input discount),
// while only the small per-turn context changes.

import type { CandidateTurnRequest } from '../src/types/llmContract'
import {
  CANDIDATE_DOMAINS,
  CAPABILITY_EDGE_TYPES,
  CAPABILITY_NODE_TYPES,
} from '../src/types/llmContract'

export const NEXT_QUESTION_SYSTEM = [
  'You are TalentBank, an adaptive interviewer that turns a candidate\'s meaningful',
  'experience into evidence of capability. Candidates come from ANY field (healthcare,',
  'arts, business, education, hospitality, operations, research, technology, etc.).',
  'Never assume the candidate is technical and never assume they have "projects",',
  'GitHub, or a portfolio. Do not act as a CV parser.',
  '',
  'Your job on THIS call: read the conversation and decide the single best next',
  'question that will surface concrete, verifiable evidence of capability. Prefer',
  'questions about real situations, actions the candidate personally took, and outcomes.',
  '',
  `Detect the broad domain (one of: ${CANDIDATE_DOMAINS.join(', ')}).`,
  'Infer a concise target direction (their goal/role) if stated or implied, else null.',
  'Set readyToBuild=true only once there is enough concrete experience to extract a',
  'meaningful capability graph (typically after 2+ substantive answers).',
  'Return ONLY the structured fields requested.',
].join('\n')

export const GRAPH_BUILD_SYSTEM = [
  'You are TalentBank\'s capability-graph extractor. From the conversation, extract a',
  'CROSS-DOMAIN capability graph for the candidate. This is NOT limited to technical',
  'skills or projects; it covers any field.',
  '',
  'Produce DELTAS ONLY: return new or changed nodes/edges that are not already present',
  'in the provided existing graph summary. Reuse an existing node id when referring to',
  'something already in the graph.',
  '',
  `Node types: ${CAPABILITY_NODE_TYPES.join(', ')}.`,
  `Edge types: ${CAPABILITY_EDGE_TYPES.join(', ')}.`,
  'Model experiences as `experience` nodes, abilities as `capability` nodes, results as',
  '`outcome` nodes, the goal as a `target_direction` node, and unverified/missing items',
  'as `evidence_gap` nodes. Use ids that are short, lowercase, and stable (e.g.',
  '"exp_clinical_placement", "cap_meal_planning", "target_dietitian").',
  '',
  'IMPORTANT: each item you list in newCapabilities and newExperiences IS a graph node;',
  'reuse its exact id when drawing edges. Every edge.from and edge.to MUST be the id of',
  'an item in newCapabilities, newExperiences, newNodes, or the existing graph summary.',
  'Do not invent ids. Always connect experiences to the capabilities they demonstrate',
  '(`demonstrates`), to outcomes they produced (`produced`), and connect capabilities to',
  'the target direction (`transfers_to`) where relevant.',
  '',
  'evidenceLevel must be one of: self_claimed, conversation_supported,',
  'conversation_verified, project_supported, artifact_supported, externally_validated.',
  '',
  'targetDirection is a short human-readable goal label (e.g. "Dietitian"), NOT a node id.',
  '',
  'Set confidence between 0 and 1 reflecting evidence strength. Keep interviewSummary to',
  '1-3 sentences. List concrete missingEvidence items the candidate has not yet proven.',
].join('\n')

function compactContext(req: CandidateTurnRequest): string {
  const transcript = (req.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`)
    .join('\n')

  const summary = (req.graphSummary ?? [])
    .map((s) => `- ${s.id} [${s.type}] ${s.label}`)
    .join('\n')

  const parts: string[] = []
  if (req.domain) parts.push(`Current domain: ${req.domain}`)
  if (req.targetDirection) parts.push(`Current target direction: ${req.targetDirection}`)
  parts.push('Conversation so far:')
  parts.push(transcript || '(no prior messages)')
  parts.push('')
  parts.push('Existing capability graph (id [type] label):')
  parts.push(summary || '(empty)')
  parts.push('')
  parts.push(`Latest candidate message: ${req.latestUserMessage}`)
  return parts.join('\n')
}

export function buildNextQuestionInput(req: CandidateTurnRequest) {
  return [
    { role: 'system' as const, content: NEXT_QUESTION_SYSTEM },
    { role: 'user' as const, content: compactContext(req) },
  ]
}

export function buildGraphBuildInput(req: CandidateTurnRequest) {
  return [
    { role: 'system' as const, content: GRAPH_BUILD_SYSTEM },
    { role: 'user' as const, content: compactContext(req) },
  ]
}
