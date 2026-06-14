// ─── Structured option assembly (server-owned, seed-grounded) ───────
// The LLM plans WHICH structured question to ask (via optionRequest) but
// never invents the option list. Here we fill the options from the static
// skill seed so candidate selections stay consistent and matchable.

import type {
  CandidateTurnRequest,
  NextQuestionLLMOutput,
  NextQuestionResponse,
  StructuredOption,
  StructuredQuestion,
} from '../src/types/llmContract'
import type { CandidateDomain } from '../src/types'
import {
  DOMAIN_LABELS,
  domainOptions,
  getRole,
  resolveRole,
  roleOptions,
  roleSkillOptions,
} from '../src/data/skillSeed'

function toDomainQuestion(prompt: string): StructuredQuestion {
  const options: StructuredOption[] = domainOptions().map((d) => ({
    id: d.id,
    label: d.label,
    source: 'seed',
    group: null,
    essential: null,
  }))
  return {
    id: 'sq_domain',
    prompt: prompt || 'Which field best matches the kind of work you want?',
    format: 'single_select',
    phase: 'anchor',
    options,
    allowManualEntry: false,
  }
}

function toRoleQuestion(domain: CandidateDomain, prompt: string): StructuredQuestion {
  const options: StructuredOption[] = roleOptions(domain).map((r) => ({
    id: r.id,
    label: r.label,
    source: 'seed',
    group: DOMAIN_LABELS[domain],
    essential: null,
  }))
  return {
    id: `sq_role_${domain}`,
    prompt: prompt || `Which role in ${DOMAIN_LABELS[domain]} are you aiming for?`,
    format: 'single_select',
    phase: 'anchor',
    options,
    allowManualEntry: true,
  }
}

function toSkillsQuestion(
  domain: CandidateDomain,
  roleId: string,
  prompt: string
): StructuredQuestion {
  const role = getRole(domain, roleId)
  const options: StructuredOption[] = roleSkillOptions(domain, roleId).map((s) => ({
    id: s.id,
    label: s.label,
    source: 'seed',
    group: s.essential ? 'Core skills' : 'Related & transferable',
    essential: s.essential,
  }))
  const roleLabel = role?.label ?? 'this role'
  return {
    id: `sq_skills_${domain}_${roleId}`,
    prompt: prompt || `Select the skills you have any experience with for ${roleLabel}. Add your own if something is missing.`,
    format: 'multi_select',
    phase: 'breadth',
    options,
    allowManualEntry: true,
  }
}

// Resolve the role the skills checklist should be built for, using the
// explicit roleId first, then the target direction as a loose fallback.
function resolveRoleId(
  domain: CandidateDomain,
  roleIdHint: string | null,
  targetDirection: string | null
): string | null {
  if (roleIdHint) {
    if (getRole(domain, roleIdHint)) return roleIdHint
    const matched = resolveRole(roleIdHint, domain)
    if (matched) return matched.role.id
  }
  if (targetDirection) {
    const matched = resolveRole(targetDirection, domain)
    if (matched) return matched.role.id
  }
  return null
}

export function assembleStructuredQuestion(
  llm: NextQuestionLLMOutput,
  req: CandidateTurnRequest
): StructuredQuestion | null {
  if (llm.questionFormat === 'open') return null

  const domain: CandidateDomain =
    llm.optionRequest.domain ?? llm.detectedDomain ?? req.domain ?? 'general'
  const prompt = llm.nextQuestion

  switch (llm.optionRequest.kind) {
    case 'domain':
      return toDomainQuestion(prompt)
    case 'role':
      return toRoleQuestion(domain, prompt)
    case 'skills_for_role': {
      const roleId = resolveRoleId(
        domain,
        llm.optionRequest.roleId,
        llm.targetDirection ?? req.targetDirection ?? null
      )
      // If we cannot pin down a role, ask for the role first instead of
      // guessing a skill list.
      return roleId ? toSkillsQuestion(domain, roleId, prompt) : toRoleQuestion(domain, prompt)
    }
    case 'none':
    default:
      // Format implied a structured question but no option source was set.
      // Fall back to the most useful anchor question.
      return req.domain ? toRoleQuestion(domain, prompt) : toDomainQuestion(prompt)
  }
}

// Merge the model output with server-filled options into the client wire
// response. questionFormat follows the assembled question when present.
export function buildNextQuestionResponse(
  llm: NextQuestionLLMOutput,
  req: CandidateTurnRequest
): NextQuestionResponse {
  const structuredQuestion = assembleStructuredQuestion(llm, req)
  return {
    phase: llm.phase,
    questionFormat: structuredQuestion?.format ?? llm.questionFormat,
    nextQuestion: llm.nextQuestion,
    structuredQuestion,
    detectedDomain: llm.detectedDomain,
    targetDirection: llm.targetDirection,
    readyToBuild: llm.readyToBuild,
    coverageNote: llm.coverageNote ?? undefined,
  }
}
