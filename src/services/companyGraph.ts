import type { CandidateCapabilityGraph, CapabilityEdge, CapabilityNode, CompanyProfile, JobPosting } from '../types'
import { jobProfileFromPosting } from '../lib/matching'

type RoleGraphInput = {
  id: string
  title: string
  description?: string
  requiredSkills: string[]
  niceToHaveSkills: string[]
  teamContext?: string[]
  successCriteria?: string[]
  cultureSignals?: string[]
  location?: string
  employmentType?: string
}

export function buildCompanyRoleGraphFromJob(job: JobPosting): CandidateCapabilityGraph {
  const profile = jobProfileFromPosting(job)
  return buildRoleGraph({
    id: job.id,
    title: job.title,
    description: job.description,
    requiredSkills: profile.requiredSkills,
    niceToHaveSkills: profile.niceToHaveSkills ?? [],
    teamContext: [job.companyIntro ?? ''].filter(Boolean),
    successCriteria: extractSuccessCriteria(job.description),
    location: job.location,
    employmentType: job.employmentType,
  })
}

export function buildCompanyRoleGraphFromProfile(profile: CompanyProfile, fallbackId = 'company-role'): CandidateCapabilityGraph {
  return buildRoleGraph({
    id: fallbackId,
    title: profile.roleTitle || 'Open Role',
    description: profile.roleDescription,
    requiredSkills: profile.mustHaveSkills,
    niceToHaveSkills: profile.niceToHaveSkills,
    teamContext: profile.teamContext,
    successCriteria: profile.successCriteria,
    cultureSignals: profile.cultureSignals,
  })
}

function buildRoleGraph(input: RoleGraphInput): CandidateCapabilityGraph {
  const nodes: CapabilityNode[] = []
  const edges: CapabilityEdge[] = []
  const roleId = nodeId('role', input.id, input.title)

  nodes.push({
    id: roleId,
    type: 'target_direction',
    label: input.title,
    confidence: 0.95,
    evidenceLevel: 'conversation_verified',
    description: input.description,
  })

  unique(input.requiredSkills).forEach((skill) => {
    const id = nodeId('required', input.id, skill)
    nodes.push({
      id,
      type: isTrait(skill) ? 'trait' : 'capability',
      label: skill,
      confidence: 0.86,
      evidenceLevel: 'conversation_supported',
      description: 'Required capability for this role.',
    })
    edges.push({
      id: edgeId(roleId, id, 'requires'),
      from: roleId,
      to: id,
      type: 'requires',
      weight: 0.9,
      reason: 'Company described this as a required role capability.',
    })
  })

  unique(input.niceToHaveSkills).filter((skill) => !input.requiredSkills.includes(skill)).forEach((skill) => {
    const id = nodeId('nice', input.id, skill)
    nodes.push({
      id,
      type: isTrait(skill) ? 'trait' : 'capability',
      label: skill,
      confidence: 0.68,
      evidenceLevel: 'conversation_supported',
      description: 'Nice-to-have capability for this role.',
    })
    edges.push({
      id: edgeId(id, roleId, 'supports'),
      from: id,
      to: roleId,
      type: 'supports',
      weight: 0.55,
      reason: 'This capability can strengthen the role fit.',
    })
  })

  unique([...(input.teamContext ?? []), ...(input.cultureSignals ?? [])]).slice(0, 4).forEach((context) => {
    const id = nodeId('context', input.id, context)
    nodes.push({
      id,
      type: 'context',
      label: compactLabel(context),
      confidence: 0.72,
      evidenceLevel: 'conversation_supported',
      description: context,
    })
    edges.push({
      id: edgeId(id, roleId, 'performed_in'),
      from: id,
      to: roleId,
      type: 'performed_in',
      weight: 0.5,
      reason: 'This describes the working context for the role.',
    })
  })

  unique(input.successCriteria ?? []).slice(0, 4).forEach((criteria) => {
    const id = nodeId('outcome', input.id, criteria)
    nodes.push({
      id,
      type: 'outcome',
      label: compactLabel(criteria),
      confidence: 0.76,
      evidenceLevel: 'conversation_supported',
      description: criteria,
    })
    edges.push({
      id: edgeId(roleId, id, 'produced'),
      from: roleId,
      to: id,
      type: 'produced',
      weight: 0.62,
      reason: 'This is an expected success outcome for the role.',
    })
  })

  unique([input.location, input.employmentType].filter((value): value is string => Boolean(value))).forEach((label) => {
    const id = nodeId('preference', input.id, label)
    nodes.push({
      id,
      type: 'preference',
      label,
      confidence: 0.8,
      evidenceLevel: 'conversation_supported',
    })
    edges.push({
      id: edgeId(roleId, id, 'prefers'),
      from: roleId,
      to: id,
      type: 'prefers',
      weight: 0.6,
      reason: 'This is a job preference or constraint.',
    })
  })

  const missingEvidence = []
  if (!input.requiredSkills.length) missingEvidence.push('Required skills are not specific enough yet.')
  if (!input.successCriteria?.length) missingEvidence.push('Success criteria can be made more measurable.')

  return {
    nodes,
    edges,
    confidence: nodes.length > 1 ? 0.78 : 0.45,
    missingEvidence,
    generatedAt: Date.now(),
  }
}

function extractSuccessCriteria(description: string): string[] {
  return description
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter((part) => /success|deliver|build|improve|manage|create|maintain|develop|implement/i.test(part))
    .slice(0, 3)
}

function compactLabel(value: string): string {
  const trimmed = value.trim()
  return trimmed.length > 46 ? `${trimmed.slice(0, 43)}...` : trimmed
}

function isTrait(skill: string): boolean {
  return /communication|teamwork|leadership|problem solving|time management|self[- ]?learning|critical thinking/i.test(skill)
}

function nodeId(...parts: string[]): string {
  return parts.map(slug).filter(Boolean).join('_').slice(0, 90)
}

function edgeId(from: string, to: string, type: string): string {
  return `${slug(type)}_${from}_to_${to}`.slice(0, 120)
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}