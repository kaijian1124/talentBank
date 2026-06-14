import type { UserType, CandidateProfile, CompanyProfile, JobPosting, SkillNode } from '../types'
import { demoCandidateProfile, demoCompanyProfile } from './mockData'

// ??? Role Classifier ???????????????????????????????????????????????
export function classifyUserType(text: string): UserType {
  const t = text.toLowerCase()
  if (t.match(/job|hire me|candidate|looking for work|apply|intern|graduate|student|skill|cv|resume|career/)) return 'candidate'
  if (t.match(/hiring|company|recruit|role|position|team|employer|we need|looking for someone/)) return 'company'
  if (t.match(/university|department|curriculum|student outcome|faculty|professor|education|course/)) return 'university'
  return 'unknown'
}

// ??? Intake question banks ?????????????????????????????????????????
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
  "What position are you hiring for?",
  "In plain language, what should this person do or solve in the first 3 months?",
  "What skills or experience are truly must-have? Separate must-have from nice-to-have if you can.",
  "Where is the job based, what employment type is it, and is there a salary range?",
  "What should candidates know about your company, team, product, or working style?",
  "Anything else the LLM should include so the job post is accurate and attractive?",
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

// ??? Skill extractor ???????????????????????????????????????????????
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

// ??? Verification questions ????????????????????????????????????????
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

// ??? Verification evaluator ????????????????????????????????????????
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
    feedback = "No problem ??I've noted this as self-claimed. We can revisit it later."
    evidenceText = 'Candidate was uncertain when asked a verification question.'
  } else if (wordCount >= 5 && wordCount < 20) {
    confidence = 0.55
    feedback = "Good basic answer. I've marked this as conversation-supported."
    evidenceText = `Candidate gave a basic correct answer about ${skillName}.`
  } else if (lower.match(/because|example|when|project|used|implemented|worked/)) {
    confidence = 0.72
    feedback = "Great ??you gave a practical answer with context. I've marked this as conversation-verified."
    evidenceText = `Candidate explained ${skillName} with practical context and project reference.`
  } else {
    confidence = 0.62
    feedback = "Solid answer. I've marked this as conversation-supported."
    evidenceText = `Candidate provided a reasonable answer about ${skillName}.`
  }

  return { confidence, feedback, evidenceText }
}

// ??? Skill node generator ??????????????????????????????????????????
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

// ??? Profile extractor (mock) ??????????????????????????????????????
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

export function extractCompanyJobPosting(
  messages: string[],
  fallbackCompanyName = 'Company'
): Omit<JobPosting, 'id' | 'companyId' | 'fitScore' | 'status' | 'createdAt'> {
  const answers = messages.map(cleanShortText).filter(Boolean)
  const allText = answers.join(' ')
  const companyName = inferCompanyName(allText) ?? fallbackCompanyName
  const title = inferRoleTitle(answers[0] ?? '', allText)
  const { salaryMin, salaryMax, salaryCurrency } = inferSalary(allText)
  const location = inferLocation(allText)
  const employmentType = inferEmploymentType(allText)
  const skills = inferSkillLists(allText)
  const companyIntro = buildCompanyIntro(companyName, answers[4] ?? answers[5] ?? '')
  const description = buildExpandedJobDescription({
    title,
    problem: answers[1] ?? '',
    mustHaveSkills: skills.mustHave,
    niceToHaveSkills: skills.niceToHave,
    companyContext: answers[4] ?? '',
    extraContext: answers[5] ?? '',
  })

  return {
    companyName,
    title,
    description,
    salaryMin,
    salaryMax,
    salaryCurrency,
    companyIntro,
    location,
    employmentType,
  }
}
export function extractCompanyProfile(messages: string[]): CompanyProfile {
  const [
    maybeCompanyOrRole = '',
    problem = '',
    mustHave = '',
    niceToHave = '',
    team = '',
    workMode = '',
    success = '',
  ] = messages

  const allText = messages.join(' ')
  const roleTitle = inferRoleTitle(maybeCompanyOrRole, allText)
  const companyName = inferCompanyName(allText)

  return {
    companyName,
    roleTitle,
    roleDescription: problem || `${roleTitle} role`,
    painPoints: splitList(problem),
    mustHaveSkills: splitList(mustHave),
    niceToHaveSkills: splitList(niceToHave),
    teamContext: splitList([team, workMode].filter(Boolean).join(', ')),
    successCriteria: splitList(success),
    cultureSignals: splitList(team),
    confidence: 0.72,
  }
}


type ExpandedJobInput = {
  title: string
  problem: string
  mustHaveSkills: string[]
  niceToHaveSkills: string[]
  companyContext: string
  extraContext: string
}

function buildExpandedJobDescription(input: ExpandedJobInput): string {
  const problem = cleanShortText(input.problem)
  const mustHave = input.mustHaveSkills.length ? input.mustHaveSkills.join(', ') : 'the core skills needed for this role'
  const niceToHave = input.niceToHaveSkills.length ? input.niceToHaveSkills.join(', ') : ''
  const context = cleanShortText([input.companyContext, input.extraContext].filter(Boolean).join(' '))

  return [
    `We are hiring a ${input.title} to help the team ${problem || 'deliver meaningful work for the business'}.`,
    'The person in this role will be expected to understand the problem, contribute hands-on, communicate progress clearly, and turn requirements into practical outcomes.',
    `Must-have requirements: ${mustHave}.`,
    niceToHave ? `Nice-to-have skills: ${niceToHave}.` : '',
    context ? `Team/company context: ${context}.` : '',
    'A strong candidate can show relevant experience, explain their decisions, and learn quickly when the work is ambiguous.',
  ].filter(Boolean).join('\n\n')
}

function buildCompanyIntro(companyName: string, rawContext: string): string | undefined {
  const context = cleanShortText(rawContext)
  if (context.length > 20) return context
  if (!companyName || companyName === 'Company') return undefined
  return `${companyName} is hiring through Talentbank Career OS.`
}

function inferSkillLists(allText: string): { mustHave: string[]; niceToHave: string[] } {
  const mustMatch = allText.match(/(?:must[- ]?have|required|need|needs|requirement[s]?)[:\s]+([^.;]+)/i)
  const niceMatch = allText.match(/(?:nice[- ]?to[- ]?have|bonus|preferred)[:\s]+([^.;]+)/i)
  const known = extractSkillsFromText(allText).map(titleCase)
  return {
    mustHave: splitList(mustMatch?.[1] ?? '').concat(known).filter(unique).slice(0, 10),
    niceToHave: splitList(niceMatch?.[1] ?? '').filter(unique).slice(0, 10),
  }
}

function inferSalary(allText: string): { salaryMin?: number; salaryMax?: number; salaryCurrency: string } {
  const currency = allText.match(/\b(usd|myr|rm|sgd)\b/i)?.[1]?.toUpperCase().replace('RM', 'MYR') ?? 'MYR'
  const range = allText.match(/(?:rm|myr|usd|sgd)?\s*(\d{3,6})\s*(?:-|to|–)\s*(?:rm|myr|usd|sgd)?\s*(\d{3,6})/i)
  if (range) return { salaryMin: Number(range[1]), salaryMax: Number(range[2]), salaryCurrency: currency }
  const single = allText.match(/(?:salary|pay|budget)[^\d]{0,20}(\d{3,6})/i)
  if (single) return { salaryMin: Number(single[1]), salaryCurrency: currency }
  return { salaryCurrency: currency }
}

function inferLocation(allText: string): string | undefined {
  if (/remote/i.test(allText)) return 'Remote'
  const match = allText.match(/(?:based in|location is|located in|at)\s+([^,.]+)/i)
  return match?.[1] ? cleanShortText(match[1]) : undefined
}

function inferEmploymentType(allText: string): string | undefined {
  if (/internship|intern/i.test(allText)) return 'Internship'
  if (/part[- ]time/i.test(allText)) return 'Part-time'
  if (/contract|freelance/i.test(allText)) return 'Contract'
  if (/full[- ]time/i.test(allText)) return 'Full-time'
  return 'Full-time'
}

function titleCase(text: string): string {
  return text.replace(/\b\w/g, (char) => char.toUpperCase())
}

function unique(value: string, index: number, arr: string[]) {
  return value.length > 0 && arr.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index
}
function inferRoleTitle(firstAnswer: string, allText: string): string {
  const roleMatch = allText.match(/(?:hiring for|hire|role is|position is|looking for)\s+([^,.]+)/i)
  if (roleMatch?.[1]) return cleanShortText(roleMatch[1])
  return cleanShortText(firstAnswer) || demoCompanyProfile.roleTitle
}

function inferCompanyName(allText: string): string | undefined {
  const companyMatch = allText.match(/(?:company is|company name is|we are|from)\s+([^,.]+)/i)
  return companyMatch?.[1] ? cleanShortText(companyMatch[1]) : undefined
}

function splitList(text: string): string[] {
  return text
    .split(/,|;|\n| and /i)
    .map(cleanShortText)
    .filter(Boolean)
    .slice(0, 8)
}

function cleanShortText(text: string): string {
  return text.trim().replace(/\\s+/g, ' ').replace(/[.?!,;:]+$/, '')
}

// ??? Confirmation summary ??????????????????????????????????????????
export function generateConfirmationSummary(profile: CandidateProfile): string {
  const skills = profile.claimedSkills.map(s => s.skillName).join(', ')
  const projects = profile.projects.map(p => p.name).join(', ')
  const missing = profile.missingInfo.join(', ')

  return `Here is what I understood about you:

?? **Target role:** ${profile.careerGoal ?? 'Not specified'}
?? **Skills mentioned:** ${skills || 'None detected yet'}
?? **Projects:** ${projects || 'None mentioned'}
?? **Missing evidence:** ${missing || 'None identified'}

Is this correct? You can confirm, correct anything, or add missing details.`
}

// ??? Chat response generator ???????????????????????????????????????
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

  if (!nextQ) {
    return `Thanks ??I have gathered enough information. Let me now build your Talent Graph. Click **"Generate Graph"** when you're ready.`
  }

  return nextQ
}
