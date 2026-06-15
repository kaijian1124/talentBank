import type { AccountUser, JobPosting } from '../types'
import type { MatchResult as HybridMatchResult } from '../lib/matching'
import { candidateProfileFromAccount } from '../lib/matching'

type JobWithMatch = JobPosting & { match?: HybridMatchResult }

export type CareerCoachInsight = {
  title: string
  nextActions: string[]
  projectSuggestion: string
  interviewStory: string
}

export type FairPayInsight = {
  position: string
  salaryCurrency: string
  salaryMin?: number
  salaryMax?: number
  expectedSalary?: number
  payFit: 'Good' | 'Bad' | 'Unknown'
  negotiationNote: string
}

export type LifeChapterInsight = {
  chapter: string
  priorities: string[]
  matchingAdvice: string
}

export type CandidateModuleInsights = {
  careerCoach: CareerCoachInsight
  fairPay: FairPayInsight
  lifeChapter: LifeChapterInsight
  source: 'llm' | 'fallback'
}

export async function buildCandidateModuleInsights(input: {
  user: AccountUser
  jobs: JobPosting[]
  matches: Record<string, HybridMatchResult>
}): Promise<CandidateModuleInsights> {
  const fallback = buildFallbackInsights(input)

  try {
    const response = await fetch('/api/candidate/career-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toLLMPayload(input, fallback)),
    })
    if (!response.ok) return fallback
    const data = await response.json() as Partial<CandidateModuleInsights>
    return mergeLLMInsights(fallback, data)
  } catch {
    return fallback
  }
}

function buildFallbackInsights(input: {
  user: AccountUser
  jobs: JobPosting[]
  matches: Record<string, HybridMatchResult>
}): CandidateModuleInsights {
  const candidate = candidateProfileFromAccount(input.user)
  const rankedJobs = rankJobs(input.jobs, input.matches)
  const topJob = rankedJobs[0]
  const topMatch = topJob?.match
  const targetRole = topJob?.title ?? candidate.preferredRoles?.[0] ?? 'your target role'
  const salaryRange = topJob ? salaryRangeForPosition(topJob, input.jobs) : null
  const expectedSalary = candidate.expectedSalary
  const payFit = getPayFit(salaryRange, expectedSalary, topMatch)
  const strengths = topMatch?.exactSkillMatches?.slice(0, 3) ?? candidate.skills.slice(0, 3).map((skill) => skill.name)
  const nextSkills = unique([
    ...(topMatch?.missingRequiredSkills ?? []),
    ...(topMatch?.recommendedNextSkills ?? []),
  ]).slice(0, 3)
  const projectSkills = unique([...strengths, ...nextSkills]).slice(0, 4)

  return {
    source: 'fallback',
    careerCoach: {
      title: `Move toward ${targetRole}`,
      nextActions: buildCoachActions(nextSkills, strengths, targetRole),
      projectSuggestion: projectSkills.length
        ? `Build one small ${targetRole} project that demonstrates ${projectSkills.join(', ')}.`
        : `Build one small project that proves you can do the core work for ${targetRole}.`,
      interviewStory: strengths.length
        ? `Prepare one STAR story showing how you used ${strengths[0]} in a real task or project.`
        : 'Prepare one STAR story that explains a real project, your role, the challenge, and the result.',
    },
    fairPay: {
      position: targetRole,
      salaryCurrency: salaryRange?.currency ?? topJob?.salaryCurrency ?? 'MYR',
      salaryMin: salaryRange?.min,
      salaryMax: salaryRange?.max,
      expectedSalary,
      payFit,
      negotiationNote: buildNegotiationNote(expectedSalary, salaryRange, payFit, strengths, topMatch),
    },
    lifeChapter: {
      chapter: inferLifeChapter(candidate.preferredRoles?.[0], targetRole, topMatch),
      priorities: buildLifePriorities(candidate.preferredLocation, expectedSalary, topJob, nextSkills),
      matchingAdvice: buildLifeMatchingAdvice(topJob, topMatch),
    },
  }
}

function toLLMPayload(input: {
  user: AccountUser
  jobs: JobPosting[]
  matches: Record<string, HybridMatchResult>
}, fallback: CandidateModuleInsights) {
  const candidate = candidateProfileFromAccount(input.user)
  const rankedJobs = rankJobs(input.jobs, input.matches).slice(0, 5)
  return {
    candidate: {
      name: candidate.name,
      summary: candidate.summary,
      skills: candidate.skills.slice(0, 12),
      projects: candidate.projects.slice(0, 5),
      preferredRoles: candidate.preferredRoles,
      experienceLevel: candidate.experienceLevel,
      expectedSalary: candidate.expectedSalary,
    },
    jobs: rankedJobs.map((job) => ({
      id: job.id,
      title: job.title,
      companyName: job.companyName,
      location: job.location,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      match: job.match,
    })),
    fallback,
  }
}

function mergeLLMInsights(fallback: CandidateModuleInsights, data: Partial<CandidateModuleInsights>): CandidateModuleInsights {
  return {
    source: data.source === 'llm' ? 'llm' : fallback.source,
    careerCoach: {
      ...fallback.careerCoach,
      ...(data.careerCoach ?? {}),
      nextActions: data.careerCoach?.nextActions?.length ? data.careerCoach.nextActions.slice(0, 4) : fallback.careerCoach.nextActions,
    },
    fairPay: {
      ...fallback.fairPay,
      ...(data.fairPay ?? {}),
      salaryMin: fallback.fairPay.salaryMin,
      salaryMax: fallback.fairPay.salaryMax,
      salaryCurrency: fallback.fairPay.salaryCurrency,
      position: fallback.fairPay.position,
    },
    lifeChapter: {
      ...fallback.lifeChapter,
      ...(data.lifeChapter ?? {}),
      priorities: data.lifeChapter?.priorities?.length ? data.lifeChapter.priorities.slice(0, 4) : fallback.lifeChapter.priorities,
    },
  }
}

function rankJobs(jobs: JobPosting[], matches: Record<string, HybridMatchResult>): JobWithMatch[] {
  return jobs
    .map((job) => ({ ...job, match: matches[job.id] }))
    .sort((a, b) => (b.match?.finalScore ?? b.fitScore) - (a.match?.finalScore ?? a.fitScore))
}

function salaryRangeForPosition(targetJob: JobPosting, jobs: JobPosting[]) {
  const similar = jobs.filter((job) => isSimilarPosition(targetJob.title, job.title))
  const salaries = similar
    .flatMap((job) => [job.salaryMin, job.salaryMax])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!salaries.length) return null
  return {
    min: Math.min(...salaries),
    max: Math.max(...salaries),
    currency: targetJob.salaryCurrency,
  }
}

function getPayFit(
  range: { min: number; max: number } | null,
  expectedSalary?: number,
  match?: HybridMatchResult
): FairPayInsight['payFit'] {
  if (!range || !expectedSalary) return 'Unknown'
  const withinRange = expectedSalary >= range.min && expectedSalary <= range.max
  const score = match?.finalScore ?? 0
  return withinRange && score >= 55 ? 'Good' : 'Bad'
}

function buildNegotiationNote(
  expectedSalary: number | undefined,
  range: { min: number; max: number } | null,
  payFit: FairPayInsight['payFit'],
  strengths: string[],
  match?: HybridMatchResult
): string {
  if (!expectedSalary) return 'Add your expected salary during intake to unlock pay-fit guidance.'
  if (!range) return 'Not enough salary data for this position yet.'
  const evidence = strengths.length ? strengths.join(' + ') : 'your current project evidence'
  const score = match?.finalScore ?? 0
  if (payFit === 'Good') {
    if (expectedSalary >= range.min + (range.max - range.min) * 0.65) {
      return `${evidence} and a ${score}% fit support asking near the upper half of this range.`
    }
    return `${evidence} supports this expectation, but stronger project evidence would help you negotiate higher.`
  }
  if (expectedSalary > range.max) {
    return `Based on the current graph evidence and a ${score}% fit, ${formatMoney(expectedSalary, 'MYR')} looks high for this role range. Add stronger evidence before asking above the range.`
  }
  return `This expectation is below the observed range. You may be able to ask for more if your evidence matches the role requirements.`
}

function buildCoachActions(nextSkills: string[], strengths: string[], targetRole: string): string[] {
  const actions = []
  if (nextSkills[0]) actions.push(`Learn or refresh ${nextSkills[0]} because it appears as a gap for ${targetRole}.`)
  if (nextSkills[1]) actions.push(`Add one small proof-of-work item using ${nextSkills[1]}.`)
  if (strengths[0]) actions.push(`Turn your ${strengths[0]} experience into a clear interview story.`)
  actions.push('Apply to roles where your graph already has direct or 1-hop skill evidence.')
  return actions.slice(0, 4)
}

function inferLifeChapter(preferredRole: string | undefined, targetRole: string, match?: HybridMatchResult): string {
  const score = match?.finalScore ?? 0
  if (score >= 80) return `Ready-to-apply chapter for ${targetRole}`
  if (score >= 60) return `Skill-building chapter toward ${targetRole}`
  return `Exploration chapter toward ${preferredRole ?? targetRole}`
}

function buildLifePriorities(
  preferredLocation: string | undefined,
  expectedSalary: number | undefined,
  topJob: JobPosting | undefined,
  nextSkills: string[]
): string[] {
  return [
    topJob?.employmentType ? `Target ${topJob.employmentType} roles first.` : 'Choose roles with clear mentorship and scope.',
    topJob?.location || preferredLocation ? `Prioritize ${topJob?.location ?? preferredLocation} opportunities.` : 'Clarify location and remote-work preference.',
    expectedSalary ? `Use ${formatMoney(expectedSalary, topJob?.salaryCurrency ?? 'MYR')} as your stated expected salary, then support it with evidence.` : 'Add your expected salary during intake.',
    nextSkills[0] ? `Make ${nextSkills[0]} the next learning focus.` : 'Keep adding project evidence to strengthen matching.',
  ]
}

function buildLifeMatchingAdvice(topJob?: JobPosting, match?: HybridMatchResult): string {
  if (!topJob) return 'Complete the intake and add evidence so Career OS can identify the right chapter.'
  if ((match?.finalScore ?? 0) >= 80) return `${topJob.title} fits your current chapter well. Apply and prepare evidence-backed interview stories.`
  return `${topJob.title} is promising, but your next chapter should focus on closing the missing skill gaps before aiming higher.`
}

function isSimilarPosition(a: string, b: string): boolean {
  const aTokens = titleTokens(a)
  const bTokens = titleTokens(b)
  if (!aTokens.length || !bTokens.length) return false
  const overlap = aTokens.filter((token) => bTokens.includes(token)).length
  return overlap >= Math.min(2, Math.max(1, Math.min(aTokens.length, bTokens.length)))
}

function titleTokens(title: string): string[] {
  const stop = new Set(['junior', 'senior', 'lead', 'intern', 'internship', 'engineer', 'developer', 'specialist', 'role'])
  return title.toLowerCase().split(/[^a-z0-9+#]+/).filter((token) => token.length > 1 && !stop.has(token))
}

function formatMoney(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString()}`
}


function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}