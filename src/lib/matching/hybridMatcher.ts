import { calculateVectorScore, MockEmbeddingProvider, OpenAIEmbeddingProvider } from './embeddingMatcher'
import { calculateGraphMatch } from './graphMatcher'
import type { CandidateProfile, HybridMatchOptions, JobProfile, MatchResult } from './types'

export async function matchCandidateToJob(
  candidate: CandidateProfile,
  job: JobProfile,
  options: HybridMatchOptions = {}
): Promise<MatchResult> {
  const graphWeight = options.graphWeight ?? 0.55
  const vectorWeight = options.vectorWeight ?? 0.35
  const preferenceWeight = options.preferenceWeight ?? 0.1
  const provider = options.embeddingProvider ?? new OpenAIEmbeddingProvider()

  const graph = calculateGraphMatch(candidate, job)
  const vectorScore = await calculateVectorScoreWithFallback(candidate, job, provider)
  const preferenceScore = calculatePreferenceScore(candidate, job)
  const finalScore = Math.round(
    graph.graphScore * graphWeight + vectorScore * vectorWeight + preferenceScore * preferenceWeight
  )

  return {
    candidateId: candidate.id,
    jobId: job.id,
    finalScore: clampScore(finalScore),
    vectorScore,
    graphScore: graph.graphScore,
    exactSkillMatches: graph.exactSkillMatches,
    relatedSkillMatches: graph.relatedSkillMatches,
    missingRequiredSkills: graph.missingRequiredSkills,
    missingNiceToHaveSkills: graph.missingNiceToHaveSkills,
    recommendedNextSkills: graph.recommendedNextSkills,
    explanation: buildExplanation(candidate, job, graph, vectorScore, preferenceScore),
  }
}

async function calculateVectorScoreWithFallback(
  candidate: CandidateProfile,
  job: JobProfile,
  provider: NonNullable<HybridMatchOptions['embeddingProvider']>
): Promise<number> {
  try {
    return await calculateVectorScore(candidate, job, provider)
  } catch {
    return calculateVectorScore(candidate, job, new MockEmbeddingProvider())
  }
}

function calculatePreferenceScore(candidate: CandidateProfile, job: JobProfile): number {
  const scores: number[] = []

  if (candidate.preferredRoles?.length) {
    const title = job.title.toLowerCase()
    scores.push(candidate.preferredRoles.some((role) => title.includes(role.toLowerCase())) ? 100 : 60)
  } else {
    scores.push(75)
  }

  if (candidate.preferredLocation && job.location) {
    const preferred = candidate.preferredLocation.toLowerCase()
    const location = job.location.toLowerCase()
    scores.push(preferred === location || preferred.includes(location) || location.includes(preferred) ? 100 : 60)
  } else {
    scores.push(75)
  }

  if (candidate.expectedSalary && (job.salaryMin || job.salaryMax)) {
    const min = job.salaryMin ?? 0
    const max = job.salaryMax ?? Number.POSITIVE_INFINITY
    scores.push(candidate.expectedSalary >= min && candidate.expectedSalary <= max ? 100 : 55)
  } else {
    scores.push(75)
  }

  if (candidate.experienceLevel && job.experienceLevel && candidate.experienceLevel !== 'unknown' && job.experienceLevel !== 'unknown') {
    scores.push(candidate.experienceLevel === job.experienceLevel ? 100 : 70)
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

function buildExplanation(
  _candidate: CandidateProfile,
  _job: JobProfile,
  graph: ReturnType<typeof calculateGraphMatch>,
  vectorScore: number,
  preferenceScore: number
): string[] {
  const explanation: string[] = []
  if (graph.exactSkillMatches.length) {
    explanation.push(`Strong match because candidate has ${graph.exactSkillMatches.slice(0, 3).join(', ')}.`)
  }
  for (const match of graph.relatedSkillMatches.slice(0, 2)) {
    explanation.push(
      `Candidate does not list ${match.jobSkill} directly, but ${match.candidateSkill} is related through the skill graph (${match.depth} hop${match.depth > 1 ? 's' : ''}).`
    )
  }
  if (graph.missingRequiredSkills.length) {
    explanation.push(`Main missing skill: ${graph.missingRequiredSkills[0]}.`)
  }
  if (graph.recommendedNextSkills.length) {
    explanation.push(`Recommended next skills: ${graph.recommendedNextSkills.slice(0, 3).join(', ')}.`)
  }
  explanation.push(`Semantic similarity score is ${vectorScore}/100 and preference score is ${preferenceScore}/100.`)
  return explanation
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}