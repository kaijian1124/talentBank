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
  skillName: string
  claimedLevel: 'beginner' | 'intermediate' | 'advanced' | 'unknown'
  context: string
  rawUserText: string
  confidence: number
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
}

export type IntakeProgress = {
  roleDetected: boolean
  profileExtracted: boolean
  claimsVerified: boolean
  graphGenerated: boolean
  matchReady: boolean
}