/*
npm install
npm run dev
*/

import type { IntakePhase, StructuredAnswer, StructuredQuestion } from './llmContract'

export type UserType = 'candidate' | 'company' | 'university' | 'unknown'

export type EvidenceLevel =
  | 'self_claimed'
  | 'conversation_supported'
  | 'conversation_verified'
  | 'project_supported'
  | 'artifact_supported'
  | 'externally_validated'

export type SkillNodeType =
  | 'technical_skill'
  | 'soft_skill'
  | 'execution_skill'
  | 'domain_knowledge'
  | 'project_evidence'
  | 'behavioral_trait'
  | 'career_preference'

export type EdgeType =
  | 'empowers'
  | 'supports'
  | 'depends_on'
  | 'indicates'
  | 'transfers_to'
  | 'weakens'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface EvidenceItem {
  type: 'conversation' | 'project' | 'answer' | 'artifact' | 'external'
  text: string
  strength: number
  source?: string
}

export interface SkillClaim {
  skillName: string //The name of the skill the user mentioned.
  claimedLevel: 'beginner' | 'intermediate' | 'advanced' | 'unknown' //The level the user claimed for the skill.
  context: string //The context in which the skill was mentioned.
  rawUserText: string //The raw text from the user.
  confidence: number //How confident the system is in this claim. Usually between 0 and 1.
}

export interface SkillNode {
  id: string
  label: string
  type: SkillNodeType
  confidence: number
  evidenceLevel: EvidenceLevel
  evidence: EvidenceItem[]
  sourceMessages: string[]
  relatedProjects: string[]
  createdAt: number
  updatedAt: number
}

/**
Example: 

const claim: SkillClaim = {
  skillName: "Python",
  claimedLevel: "intermediate",
  context: "AI projects",
  rawUserText: "I use Python for AI projects",
  confidence: 0.35
}

const node: SkillNode = {
  id: "python",
  label: "Python",
  type: "technical_skill",
  confidence: 0.72,
  evidenceLevel: "conversation_verified",
  evidence: [
    {
      type: "answer",
      text: "Candidate explained Python usage with practical project context.",
      strength: 0.72
    }
  ],
  sourceMessages: [],
  relatedProjects: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
}
 */

export interface GraphEdge {
  id: string
  from: string
  to: string
  edgeType: EdgeType
  weight: number
  condition: string
  reason: string
  companyContext?: string
}

export interface SuperNode {
  id: string
  label: string
  contains: string[]
  meaning: string
  confidence: number
  evidence: EvidenceItem[]
}

/**
  Node is a fact: 
  Candidate knows Python.
  Candidate built a Proof of Delivery app.
  Candidate has field testing experience.

  Edge is a relationship: 
  The Proof of Delivery app supports Python.
  Prototype building empowers field testing.
  Self-learning empowers prototype building.

  so instead of saying: 
  candidate skills = Python, React Native, OpenCV

  it say: 
  Candidate built a real project.
  That project used Python, React Native, and OpenCV.
  Because it involved real users, it also shows field testing.
  Because they learned tools independently, it suggests self-learning.
  Together, these suggest a higher-level pattern: High-Agency Builder.

  A SuperNode is a cluster or pattern detected across multiple nodes.
  example: High-Agency Builder
  contains: ["self_learning", "prototype_building", "field_testing"]
 */

export interface TalentGraph {
  id: string
  ownerType: UserType
  ownerId: string
  nodes: SkillNode[]
  edges: GraphEdge[]
  superNodes: SuperNode[]
  confidence: number
  generatedAt: number
}

export interface CandidateProfile {
  name?: string
  careerGoal?: string
  targetRoles: string[]
  claimedSkills: SkillClaim[]
  verifiedSkills: SkillNode[]
  projects: ProjectEvidence[]
  experiences: ExperienceEvidence[]
  preferences: Record<string, string>
  missingInfo: string[]
  confidence: number
  // Candidate capability graph backbone (Step 1) - optional, additive.
  domain?: CandidateDomain
  targetDirection?: string
  capabilityClaims?: CapabilityClaim[]
  meaningfulExperiences?: MeaningfulExperience[]
  interviewSummary?: string
}

export interface ProjectEvidence {
  name: string
  description: string
  technologies: string[]
  role: string
  outcome: string
  hasDeployment: boolean
  hasUserTesting: boolean
  hasCompetitionResult: boolean
}

export interface ExperienceEvidence {
  title: string
  organization: string
  duration: string
  description: string
  skills: string[]
}

export interface CompanyProfile {
  companyName?: string
  roleTitle: string
  roleDescription: string
  painPoints: string[]
  mustHaveSkills: string[]
  niceToHaveSkills: string[]
  teamContext: string[]
  successCriteria: string[]
  cultureSignals: string[]
  confidence: number
}

export interface UniversityProfile {
  institutionName?: string
  department: string
  targetStudents: string
  goals: string[]
  curriculumAreas: string[]
  industryExpectations: string[]
  readinessMetrics: Record<string, number>
  confidence: number
}

export interface MatchResult {
  candidateId: string
  companyId: string
  fitScore: number
  fitLevel: 'weak_match' | 'moderate_match' | 'strong_match' | 'exceptional_match'
  matchedReasons: string[]
  risks: string[]
  missingEvidence: string[]
  recommendedQuestions: string[]
  candidateAdvice: string[]
  companyAdvice: string[]
  graphHighlights: string[]
  calculatedAt: number
}

export interface UserSession {
  id: string
  userType: UserType
  messages: ChatMessage[]
  structuredProfile: CandidateProfile | CompanyProfile | UniversityProfile | null
  graph: TalentGraph | null
  matchResult: MatchResult | null
  intakeStep: number
  verificationQueue: string[]
  createdAt: number
  updatedAt: number
  // Candidate capability graph backbone (Step 1 wiring).
  capabilityGraph: CandidateCapabilityGraph | null
  candidateDomain: CandidateDomain | null
  targetDirection: string | null
  readyToBuild: boolean
  // Phased structured intake state.
  intakePhase: IntakePhase
  structuredAnswers: StructuredAnswer[]
  pendingQuestion: StructuredQuestion | null
}

export type IntakeProgress = {
  roleDetected: boolean
  profileExtracted: boolean
  claimsVerified: boolean
  graphGenerated: boolean
  matchReady: boolean
}

// === Candidate Capability Graph backbone ===
// Cross-domain, candidate-only capability/experience model. Additive:
// existing skill/project types above remain valid for current pages.

export type CandidateDomain =
  | 'technology'
  | 'engineering'
  | 'healthcare'
  | 'finance'
  | 'business'
  | 'creative'
  | 'media_communications'
  | 'education'
  | 'research'
  | 'operations'
  | 'hospitality'
  | 'public_sector'
  | 'skilled_trades'
  | 'general'

export type MeaningfulExperienceKind =
  | 'internship'
  | 'capstone'
  | 'coursework'
  | 'competition'
  | 'placement'
  | 'portfolio'
  | 'assignment'
  | 'case_work'
  | 'customer_interaction'
  | 'leadership'
  | 'club_leadership'
  | 'part_time'
  | 'research'
  | 'volunteering'
  | 'other'

export interface CapabilityClaim {
  id: string
  label: string
  domain: CandidateDomain
  rawText: string
  confidence: number
  proficiency?: number | null
  evidenceLevel: EvidenceLevel
  sourceMessageIds: string[]
}

export interface MeaningfulExperience {
  id: string
  title: string
  kind: MeaningfulExperienceKind
  organization?: string
  description: string
  outcomes: string[]
  domain: CandidateDomain
  sourceMessageIds: string[]
}

export type CapabilityNodeType =
  | 'capability'
  | 'experience'
  | 'outcome'
  | 'context'
  | 'target_direction'
  | 'evidence_gap'
  | 'trait'
  | 'preference'
  | 'credential'

export interface CapabilityNode {
  id: string
  type: CapabilityNodeType
  label: string
  domain?: CandidateDomain
  confidence: number
  proficiency?: number | null
  evidenceLevel?: EvidenceLevel
  taxonomyId?: string | null
  description?: string
}

export type CapabilityEdgeType =
  | 'demonstrates'
  | 'supports'
  | 'transfers_to'
  | 'produced'
  | 'performed_in'
  | 'indicates'
  | 'needs_evidence'
  | 'requires'
  | 'part_of'
  | 'prefers'

export interface CapabilityEdge {
  id: string
  from: string // CapabilityNode.id
  to: string // CapabilityNode.id
  type: CapabilityEdgeType
  weight?: number
  reason?: string
}

export interface CandidateCapabilityGraph {
  nodes: CapabilityNode[]
  edges: CapabilityEdge[]
  confidence: number
  missingEvidence: string[]
  generatedAt: number
}

export interface AccountUser {
  id: string
  email: string
  role: 'candidate' | 'company' | 'university' | null
  displayName?: string
  intakeCompleted: boolean
  candidateGraph?: CandidateCapabilityGraph | null
  companyProfile?: CompanyProfile | null
  intakeSession?: UserSession | null
}

export interface JobPosting {
  id: string
  companyId: string
  companyName: string
  title: string
  description: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency: string
  companyIntro?: string
  location?: string
  employmentType?: string
  status: 'open' | 'closed'
  fitScore: number
  createdAt: string
}

export interface JobApplication {
  id: string
  jobId: string
  candidateId: string
  companyId: string
  status: 'submitted' | 'reviewing' | 'shortlisted' | 'rejected'
  fitScore: number
  candidateEmail?: string
  candidateName?: string
  createdAt: string
}

export interface CompanyNotification {
  id: string
  companyId: string
  candidateId?: string
  jobId?: string
  type: string
  title: string
  message: string
  candidateEmail?: string
  candidateName?: string
  isRead: boolean
  createdAt: string
}

export interface MessageThread {
  id: string
  companyId: string
  candidateId: string
  jobId?: string
  jobTitle?: string
  companyName: string
  candidateName?: string
  candidateEmail?: string
  lastMessage?: string
  createdAt: string
  updatedAt: string
}

export interface ThreadMessage {
  id: string
  threadId: string
  senderId: string
  senderRole: 'candidate' | 'company'
  body: string
  createdAt: string
}

