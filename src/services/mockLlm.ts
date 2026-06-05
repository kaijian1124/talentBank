import type { UserType, CandidateProfile, CompanyProfile, SkillNode } from '../types'
import { demoCandidateProfile, demoCompanyProfile } from './mockData'

// ─── Role Classifier ───────────────────────────────────────────────
export function classifyUserType(text: string): UserType {
  const t = text.toLowerCase()
  if (t.match(/job|hire me|candidate|looking for work|apply|intern|graduate|student|skill|cv|resume|career/)) return 'candidate'
  if (t.match(/hiring|company|recruit|role|position|team|employer|we need|looking for someone/)) return 'company'
  if (t.match(/university|department|curriculum|student outcome|faculty|professor|education|course/)) return 'university'
  return 'unknown'
}

// ─── Intake question banks ─────────────────────────────────────────
const candidateQuestions = [
  "What is your current career goal? (e.g. backend engineer, AI developer, data scientist)",
  "What roles are you targeting right now?",
  "What technical skills do you have? List as many as you like.",
  "Tell me about your strongest project or experience. What did you build?",
  "What did YOU personally build or own in that project?",
  "What technologies or tools did you use?",
  "Was there any real deployment, user testing, competition result, or industry exposure?",
  "Which skill would you like me to verify first?",
]

const companyQuestions = [
  "What role are you hiring for?",
  "What real problem should this person solve in the first 3 months?",
  "What skills are must-have for this role?",
  "What skills are nice-to-have?",
  "What type of team environment is this? (size, pace, structure)",
  "Is this role more about execution, research, production, or fast prototyping?",
  "What would make a candidate truly successful in this role?",
]

const universityQuestions = [
  "Which department or office are you from?",
  "What student outcome do you care most about improving?",
  "What skill gaps are you trying to understand?",
  "What industries or roles are your students targeting?",
  "What curriculum areas do you currently emphasise?",
  "What internship or employment outcomes do you want to improve?",
]

export function getIntakeQuestion(userType: UserType, step: number): string {
  const banks: Record<string, string[]> = {
    candidate: candidateQuestions,
    company: companyQuestions,
    university: universityQuestions,
  }
  const bank = banks[userType] ?? []
  return bank[step] ?? ''
}

export function getIntakeLength(userType: UserType): number {
  if (userType === 'candidate') return candidateQuestions.length
  if (userType === 'company') return companyQuestions.length
  if (userType === 'university') return universityQuestions.length
  return 0
}

// ─── Skill extractor ───────────────────────────────────────────────
export function extractSkillsFromText(text: string): string[] {
  const known = [
    'java', 'python', 'javascript', 'typescript', 'react', 'react native',
    'node', 'express', 'fastapi', 'spring boot', 'sql', 'supabase',
    'firebase', 'opencv', 'machine learning', 'deep learning', 'llm',
    'docker', 'git', 'system design', 'rest api', 'graphql', 'c++', 'kotlin',
  ]
  const lower = text.toLowerCase()
  return known.filter(s => lower.includes(s))
}

// ─── Verification questions ────────────────────────────────────────
const verificationQuestions: Record<string, string[]> = {
  java: [
    "In a Java backend project, what is the purpose of separating Controller, Service, and Repository layers?",
    "How would you handle exceptions globally in a Spring Boot application?",
    "What is the difference between an interface and an abstract class in Java?",
  ],
  python: [
    "How do you manage dependencies in a Python project?",
    "What is the difference between a list and a tuple in Python?",
    "How would you handle async operations in Python?",
  ],
  'react native': [
    "How does the React Native bridge work between JavaScript and native code?",
    "How would you handle navigation between screens in a React Native app?",
  ],
  system_design: [
    "How would you design a system that needs to handle 10,000 concurrent users?",
    "What is the difference between horizontal and vertical scaling?",
  ],
  python_default: [
    "Walk me through how you used Python in your projects.",
    "What Python libraries have you used and for what purpose?",
  ],
}

export function getVerificationQuestion(skillName: string): string {
  const key = skillName.toLowerCase()
  const questions = verificationQuestions[key] ?? verificationQuestions['python_default']
  return questions[Math.floor(Math.random() * questions.length)]
}

// ─── Verification evaluator ────────────────────────────────────────
export function evaluateVerificationAnswer(
  skillName: string,
  answer: string
): { confidence: number; feedback: string; evidenceText: string } {
  const lower = answer.toLowerCase()
  const wordCount = answer.split(' ').length

  let confidence = 0.35
  let feedback = ''
  let evidenceText = ''

  if (wordCount < 5) {
    confidence = 0.30
    feedback = "That answer was quite brief. I've marked this skill as self-claimed for now."
    evidenceText = 'Very brief answer provided, insufficient to verify claim.'
  } else if (lower.match(/don't know|not sure|no idea|unsure/)) {
    confidence = 0.30
    feedback = "No problem — I've noted this as self-claimed. We can revisit it later."
    evidenceText = 'Candidate was uncertain when asked a verification question.'
  } else if (wordCount >= 5 && wordCount < 20) {
    confidence = 0.55
    feedback = "Good basic answer. I've marked this as conversation-supported."
    evidenceText = `Candidate gave a basic correct answer about ${skillName}.`
  } else if (lower.match(/because|example|when|project|used|implemented|worked/)) {
    confidence = 0.72
    feedback = "Great — you gave a practical answer with context. I've marked this as conversation-verified."
    evidenceText = `Candidate explained ${skillName} with practical context and project reference.`
  } else {
    confidence = 0.62
    feedback = "Solid answer. I've marked this as conversation-supported."
    evidenceText = `Candidate provided a reasonable answer about ${skillName}.`
  }

  return { confidence, feedback, evidenceText }
}

// ─── Skill node generator ──────────────────────────────────────────
export function generateSkillNode(
  skillName: string,
  confidence: number,
  evidenceText: string,
  fromProject?: string
): SkillNode {
  const now = Date.now()
  const evidenceLevel = confidence >= 0.70
    ? 'conversation_verified'
    : confidence >= 0.55
    ? 'conversation_supported'
    : 'self_claimed'

  return {
    id: skillName.toLowerCase().replace(/\s+/g, '_'),
    label: skillName,
    type: 'technical_skill',
    confidence,
    evidenceLevel,
    evidence: [{
      type: confidence >= 0.70 ? 'answer' : 'conversation',
      text: evidenceText,
      strength: confidence,
    }],
    sourceMessages: [],
    relatedProjects: fromProject ? [fromProject] : [],
    createdAt: now,
    updatedAt: now,
  }
}

// ─── Profile extractor (mock) ──────────────────────────────────────
export function extractCandidateProfile(messages: string[]): CandidateProfile {
  const fullText = messages.join(' ').toLowerCase()
  const skills = extractSkillsFromText(fullText)

  const profile = { ...demoCandidateProfile }

  if (fullText.includes('java')) profile.claimedSkills = profile.claimedSkills.filter(s => s.skillName !== 'Java').concat([
    { skillName: 'Java', claimedLevel: 'advanced', context: 'backend', rawUserText: 'mentioned java', confidence: 0.35 }
  ])

  profile.claimedSkills = skills.map(s => ({
    skillName: s.charAt(0).toUpperCase() + s.slice(1),
    claimedLevel: 'intermediate',
    context: 'mentioned in conversation',
    rawUserText: s,
    confidence: 0.35,
  }))

  return profile
}

export function extractCompanyProfile(_messages: string[]): CompanyProfile {
  return { ...demoCompanyProfile }
}

// ─── Confirmation summary ──────────────────────────────────────────
export function generateConfirmationSummary(profile: CandidateProfile): string {
  const skills = profile.claimedSkills.map(s => s.skillName).join(', ')
  const projects = profile.projects.map(p => p.name).join(', ')
  const missing = profile.missingInfo.join(', ')

  return `Here is what I understood about you:

📌 **Target role:** ${profile.careerGoal ?? 'Not specified'}
🛠 **Skills mentioned:** ${skills || 'None detected yet'}
📁 **Projects:** ${projects || 'None mentioned'}
⚠️ **Missing evidence:** ${missing || 'None identified'}

Is this correct? You can confirm, correct anything, or add missing details.`
}

// ─── Chat response generator ───────────────────────────────────────
export function generateChatResponse(
  userType: UserType,
  step: number,
  userMessage: string,
  isVerifying: boolean,
  verifyingSkill?: string
): string {
  if (isVerifying && verifyingSkill) {
    const result = evaluateVerificationAnswer(verifyingSkill, userMessage)
    return `${result.feedback}\n\nYour **${verifyingSkill}** confidence has been updated in your Talent Graph.`
  }

  const nextQ = getIntakeQuestion(userType, step)
  const total = getIntakeLength(userType)

  if (!nextQ) {
    return `Thanks — I have gathered enough information. Let me now build your Talent Graph. Click **"Generate Graph"** when you're ready.`
  }

  const stepLabel = `*(${step + 1}/${total})*`
  return `${stepLabel} ${nextQ}`
}