import type { CandidateProfile, CandidateSkill, GraphMatchResult, JobProfile, RelatedSkillMatch } from './types'
import { displaySkill, findSkillPath, getPrerequisites, normalizeSkill } from './skillGraph'

const REQUIRED_WEIGHT = 0.75
const NICE_TO_HAVE_WEIGHT = 0.25
const DEPTH_BASE_SCORE: Record<number, number> = { 1: 0.78, 2: 0.48 }

export function calculateGraphMatch(candidate: CandidateProfile, job: JobProfile): GraphMatchResult {
  const candidateSkills = candidate.skills.map((skill) => skill.name)
  const candidateSkillByName = new Map(candidate.skills.map((skill) => [normalizeSkill(skill.name), skill]))
  const exactSkillMatches: string[] = []
  const relatedSkillMatches: RelatedSkillMatch[] = []
  const missingRequiredSkills: string[] = []
  const missingNiceToHaveSkills: string[] = []

  const requiredScore = scoreSkillSet(job.requiredSkills, 1, missingRequiredSkills)
  const niceScore = scoreSkillSet(job.niceToHaveSkills ?? [], 0.6, missingNiceToHaveSkills)
  const requiredPortion = job.requiredSkills.length ? requiredScore : 1
  const nicePortion = job.niceToHaveSkills?.length ? niceScore : 1
  const graphScore = Math.round((requiredPortion * REQUIRED_WEIGHT + nicePortion * NICE_TO_HAVE_WEIGHT) * 100)

  const recommendedNextSkills = recommendNextSkills(missingRequiredSkills, missingNiceToHaveSkills)

  return {
    graphScore: clampScore(graphScore),
    exactSkillMatches: unique(exactSkillMatches.map(displaySkill)),
    relatedSkillMatches,
    missingRequiredSkills: unique(missingRequiredSkills.map(displaySkill)),
    missingNiceToHaveSkills: unique(missingNiceToHaveSkills.map(displaySkill)),
    recommendedNextSkills,
  }

  function scoreSkillSet(skills: string[], importance: number, missing: string[]): number {
    if (!skills.length) return 1
    let total = 0
    for (const jobSkill of skills) {
      const normalizedJobSkill = normalizeSkill(jobSkill)
      const exact = candidateSkillByName.get(normalizedJobSkill)
      if (exact) {
        exactSkillMatches.push(normalizedJobSkill)
        total += skillEvidenceMultiplier(exact) * importance
        continue
      }

      const related = bestRelatedMatch(candidateSkills, jobSkill, candidateSkillByName)
      if (related) {
        relatedSkillMatches.push(related)
        total += (related.score / 100) * importance
        continue
      }

      missing.push(normalizedJobSkill)
    }
    return total / skills.length
  }
}

function bestRelatedMatch(
  candidateSkills: string[],
  jobSkill: string,
  candidateSkillByName: Map<string, CandidateSkill>
): RelatedSkillMatch | null {
  let best: RelatedSkillMatch | null = null
  for (const candidateSkill of candidateSkills) {
    const path = findSkillPath([candidateSkill], jobSkill, 2)
    if (!path) continue
    const depth = path.length
    const source = candidateSkillByName.get(normalizeSkill(candidateSkill))
    const pathWeight = path.reduce((score, step) => score * step.weight, 1)
    const score = Math.round((DEPTH_BASE_SCORE[depth] ?? 0) * pathWeight * skillEvidenceMultiplier(source) * 100)
    if (!best || score > best.score) {
      best = {
        candidateSkill: displaySkill(normalizeSkill(candidateSkill)),
        jobSkill: displaySkill(normalizeSkill(jobSkill)),
        depth,
        score: clampScore(score),
        relationshipPath: path,
      }
    }
  }
  return best && best.score > 0 ? best : null
}

function recommendNextSkills(requiredMissing: string[], niceMissing: string[]): string[] {
  const recommendations: string[] = []
  for (const skill of requiredMissing) {
    for (const prerequisite of getPrerequisites(skill)) recommendations.push(displaySkill(prerequisite))
    recommendations.push(displaySkill(skill))
  }
  for (const skill of niceMissing.slice(0, 2)) recommendations.push(displaySkill(skill))
  return unique(recommendations).slice(0, 5)
}

function skillEvidenceMultiplier(skill?: CandidateSkill): number {
  if (!skill) return 0.75
  const confidence = clamp01(skill.confidence ?? 0.75)
  const proficiency = clamp01(skill.proficiency ?? 0.65)
  return Math.max(0.35, confidence * 0.55 + proficiency * 0.45)
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}