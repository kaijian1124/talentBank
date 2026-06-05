import type { TalentGraph, CompanyProfile, MatchResult } from '../types'
import { v4 as uuidv4 } from 'uuid'

export function matchCandidateToCompany(
  graph: TalentGraph,
  company: CompanyProfile
): MatchResult {
  const now = Date.now()
  const nodeLabels = graph.nodes.map(n => n.label.toLowerCase())
  const mustHave = company.mustHaveSkills.map(s => s.toLowerCase())
  const niceToHave = company.niceToHaveSkills.map(s => s.toLowerCase())

  // 35% hard skill match
  const mustMatched = mustHave.filter(s => nodeLabels.some(n => n.includes(s) || s.includes(n)))
  const hardSkillScore = mustHave.length > 0 ? (mustMatched.length / mustHave.length) * 35 : 20

  // 25% evidence strength
  const avgConfidence = graph.nodes.reduce((sum, n) => sum + n.confidence, 0) / (graph.nodes.length || 1)
  const evidenceScore = avgConfidence * 25

  // 20% dynamic edge alignment
  const hasHighAgency = graph.superNodes.some(s => s.id === 'high_agency_builder')
  const edgeScore = hasHighAgency ? 18 : graph.edges.length > 3 ? 14 : 10

  // 10% culture fit
  const cultureKeywords = company.cultureSignals.map(s => s.toLowerCase()).join(' ')
  const hasFastPaced = cultureKeywords.includes('fast') || cultureKeywords.includes('autonomy')
  const cultureScore = hasFastPaced && hasHighAgency ? 9 : 6

  // 10% super node relevance
  const superNodeScore = graph.superNodes.length > 0 ? 9 : 5

  // Missing info penalty
  const mustMissed = mustHave.filter(s => !nodeLabels.some(n => n.includes(s) || s.includes(n)))
  const penalty = mustMissed.length * 3

  const raw = hardSkillScore + evidenceScore + edgeScore + cultureScore + superNodeScore - penalty
  const fitScore = Math.min(100, Math.max(0, Math.round(raw)))

  const fitLevel =
    fitScore >= 85 ? 'exceptional_match' :
    fitScore >= 70 ? 'strong_match' :
    fitScore >= 50 ? 'moderate_match' : 'weak_match'

  // Build matched reasons
  const matchedReasons: string[] = []
  if (hasHighAgency) matchedReasons.push('High-Agency Builder loop matches the fast-prototype requirement')
  mustMatched.forEach(s => matchedReasons.push(`Skill match: ${s} is a must-have for this role`))
  if (avgConfidence > 0.70) matchedReasons.push('Strong evidence quality across skill nodes')
  if (graph.nodes.some(n => n.type === 'project_evidence')) matchedReasons.push('Project evidence demonstrates real delivery capability')

  // Risks
  const risks: string[] = []
  mustMissed.forEach(s => risks.push(`Missing must-have skill: ${s}`))
  const niceMatched = niceToHave.filter(s => nodeLabels.some(n => n.includes(s) || s.includes(n)))
  const niceMissed = niceToHave.filter(s => !nodeLabels.some(n => n.includes(s) || s.includes(n)))
  niceMissed.forEach(s => risks.push(`Nice-to-have not evidenced: ${s}`))
  if (avgConfidence < 0.65) risks.push('Overall evidence confidence is moderate — more verification needed')

  // Missing evidence
  const missingEvidence: string[] = []
  graph.nodes.filter(n => n.evidenceLevel === 'self_claimed').forEach(n =>
    missingEvidence.push(`${n.label} is only self-claimed — no project or verification evidence yet`)
  )

  // Recommended questions
  const recommendedQuestions = [
    ...company.mustHaveSkills.map(s => `Ask the candidate to walk through a real example using ${s}`),
    'How would you design this system end-to-end from scratch?',
    'Tell me about a time you had to learn a new tool quickly to solve a problem.',
  ]

  // Advice
  const candidateAdvice = [
    ...mustMissed.map(s => `Build a small project or demo to show ${s} capability`),
    'Prepare to explain your system design decisions clearly',
    'Have a GitHub repo or code sample ready to show',
  ]

  const companyAdvice = [
    'Consider a take-home task focused on the core technical requirement',
    hasHighAgency ? 'This candidate shows strong independent drive — give them autonomy early' : 'Assess learning speed, not just current knowledge',
    ...niceMatched.map(s => `Candidate shows ${s} — leverage this in onboarding`),
  ]

  return {
    candidateId: uuidv4(),
    companyId: uuidv4(),
    fitScore,
    fitLevel,
    matchedReasons,
    risks,
    missingEvidence,
    recommendedQuestions,
    candidateAdvice,
    companyAdvice,
    graphHighlights: graph.superNodes.map(s => s.id),
    calculatedAt: now,
  }
}