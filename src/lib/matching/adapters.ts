import type { AccountUser, CapabilityNode, JobPosting } from '../../types'
import type { CandidateProfile, CandidateSkill, ExperienceLevel, JobProfile } from './types'
import { getKnownSkills, normalizeSkill } from './skillGraph'

export function candidateProfileFromAccount(user: AccountUser): CandidateProfile {
  const graph = user.candidateGraph
  const nodes = graph?.nodes ?? []
  const skills = nodes
    .filter((node) => node.type === 'capability' || node.type === 'trait')
    .map(toCandidateSkill)

  const projects = nodes
    .filter((node) => node.type === 'experience')
    .map((node) => ({
      name: node.label,
      description: node.description ?? node.label,
      skills: connectedSkillLabels(node, nodes, graph?.edges ?? []),
    }))

  const targetRoles = nodes
    .filter((node) => node.type === 'target_direction' || node.type === 'preference')
    .map((node) => node.label)

  return {
    id: user.id,
    name: user.displayName ?? user.email,
    summary: graph
      ? `Candidate capability graph with ${graph.nodes.length} nodes and ${graph.edges.length} relationships.`
      : 'Candidate has not completed a capability graph yet.',
    skills,
    projects,
    preferredRoles: targetRoles.length ? targetRoles : undefined,
    experienceLevel: inferCandidateExperienceLevel(nodes),
  }
}

export function jobProfileFromPosting(job: JobPosting): JobProfile {
  const extractedSkills = extractSkillsFromJob(job)
  const requiredSkills = extractedSkills.required.length ? extractedSkills.required : extractedSkills.all.slice(0, 5)
  const niceToHaveSkills = extractedSkills.niceToHave.length
    ? extractedSkills.niceToHave
    : extractedSkills.all.filter((skill) => !requiredSkills.includes(skill)).slice(0, 5)

  return {
    id: job.id,
    title: job.title,
    company: job.companyName,
    description: [job.description, job.companyIntro ?? ''].filter(Boolean).join('\n'),
    requiredSkills,
    niceToHaveSkills,
    location: job.location,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    experienceLevel: inferJobExperienceLevel(job),
  }
}

function toCandidateSkill(node: CapabilityNode): CandidateSkill {
  return {
    name: node.label,
    confidence: node.confidence,
    proficiency: node.proficiency ?? undefined,
    evidence: node.evidenceLevel,
  }
}

function connectedSkillLabels(
  experience: CapabilityNode,
  nodes: CapabilityNode[],
  edges: { from: string; to: string }[]
): string[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  return edges
    .filter((edge) => edge.from === experience.id || edge.to === experience.id)
    .map((edge) => nodeById.get(edge.from === experience.id ? edge.to : edge.from))
    .filter((node): node is CapabilityNode => node !== undefined && (node.type === 'capability' || node.type === 'trait'))
    .map((node) => node.label)
}

function extractSkillsFromJob(job: JobPosting): { all: string[]; required: string[]; niceToHave: string[] } {
  const text = `${job.title}\n${job.description}\n${job.companyIntro ?? ''}`
  const all = getKnownSkills().filter((skill) => includesSkill(text, skill))
  const requiredText = extractSection(text, /(must[- ]?have|required|requirements?|need|needs)[:\s]/i)
  const niceText = extractSection(text, /(nice[- ]?to[- ]?have|bonus|preferred|plus)[:\s]/i)
  const required = all.filter((skill) => includesSkill(requiredText || text, skill))
  const niceToHave = all.filter((skill) => niceText && includesSkill(niceText, skill))
  return {
    all: unique(all),
    required: unique(required),
    niceToHave: unique(niceToHave),
  }
}

function includesSkill(text: string, skill: string): boolean {
  const normalizedText = normalizeSkill(text).replace(/[^a-z0-9+#.\s-]/g, ' ')
  const normalizedSkill = normalizeSkill(skill)
  return new RegExp(`(^|[^a-z0-9+#.])${escapeRegExp(normalizedSkill)}([^a-z0-9+#.]|$)`, 'i').test(normalizedText)
}

function extractSection(text: string, marker: RegExp): string {
  const match = marker.exec(text)
  if (!match) return ''
  return text.slice(match.index, match.index + 280)
}

function inferCandidateExperienceLevel(nodes: CapabilityNode[]): ExperienceLevel {
  const labels = nodes.map((node) => node.label.toLowerCase()).join(' ')
  if (/intern|internship|fresh|student|graduate/.test(labels)) return 'junior'
  return 'unknown'
}

function inferJobExperienceLevel(job: JobPosting): ExperienceLevel {
  const text = `${job.title} ${job.description}`.toLowerCase()
  if (/intern|internship/.test(text)) return 'intern'
  if (/junior|fresh|graduate|entry/.test(text)) return 'junior'
  if (/senior|lead|principal/.test(text)) return 'senior'
  if (/mid/.test(text)) return 'mid'
  return 'unknown'
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}