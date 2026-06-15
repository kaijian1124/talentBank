export type ExperienceLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'unknown'

export interface CandidateSkill {
  name: string
  confidence?: number
  proficiency?: number
  evidence?: string
}

export interface CandidateProject {
  name: string
  description: string
  skills?: string[]
}

export interface CandidateProfile {
  id: string
  name: string
  summary?: string
  skills: CandidateSkill[]
  projects: CandidateProject[]
  preferredRoles?: string[]
  preferredLocation?: string
  expectedSalary?: number
  experienceLevel?: ExperienceLevel
}

export interface JobProfile {
  id: string
  title: string
  company: string
  description: string
  requiredSkills: string[]
  niceToHaveSkills?: string[]
  location?: string
  salaryMin?: number
  salaryMax?: number
  experienceLevel?: ExperienceLevel
}

export type SkillRelationshipType =
  | 'related_to'
  | 'prerequisite_of'
  | 'used_for'
  | 'alternative_to'
  | 'belongs_to'

export interface SkillGraphEdge {
  from: string
  to: string
  type: SkillRelationshipType
  weight: number
}

export interface SkillPathStep {
  from: string
  to: string
  relationship: SkillRelationshipType
  weight: number
}

export interface RelatedSkillMatch {
  candidateSkill: string
  jobSkill: string
  depth: number
  score: number
  relationshipPath: SkillPathStep[]
}

export interface GraphMatchResult {
  graphScore: number
  exactSkillMatches: string[]
  relatedSkillMatches: RelatedSkillMatch[]
  missingRequiredSkills: string[]
  missingNiceToHaveSkills: string[]
  recommendedNextSkills: string[]
}

export interface MatchResult {
  candidateId: string
  jobId: string
  finalScore: number
  vectorScore: number
  graphScore: number
  exactSkillMatches: string[]
  relatedSkillMatches: RelatedSkillMatch[]
  missingRequiredSkills: string[]
  missingNiceToHaveSkills: string[]
  recommendedNextSkills: string[]
  explanation: string[]
}

export interface HybridMatchOptions {
  embeddingProvider?: import('./embeddingMatcher').EmbeddingProvider
  graphWeight?: number
  vectorWeight?: number
  preferenceWeight?: number
}