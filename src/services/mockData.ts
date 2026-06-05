import { v4 as uuidv4 } from 'uuid'
import type {
  CandidateProfile, CompanyProfile, TalentGraph,
  SkillNode, GraphEdge, SuperNode, MatchResult
} from '../types'

const now = Date.now()

export const demoCandidateProfile: CandidateProfile = {
  name: 'Alex Chen',
  careerGoal: 'Backend / AI Application Engineer',
  targetRoles: ['Backend Engineer', 'AI Software Engineer', 'Full Stack Engineer'],
  claimedSkills: [
    { skillName: 'Java', claimedLevel: 'advanced', context: 'backend', rawUserText: 'I am very good at Java', confidence: 0.85 },
    { skillName: 'Python', claimedLevel: 'intermediate', context: 'scripting and AI', rawUserText: 'I use Python for AI projects', confidence: 0.72 },
    { skillName: 'React Native', claimedLevel: 'intermediate', context: 'mobile app', rawUserText: 'Built mobile app with React Native', confidence: 0.68 },
    { skillName: 'OpenCV', claimedLevel: 'intermediate', context: 'computer vision', rawUserText: 'Used OpenCV for image processing', confidence: 0.65 },
  ],
  verifiedSkills: [],
  projects: [
    {
      name: 'Proof of Delivery System',
      description: 'Mobile app for courier delivery verification using GPS, photo evidence, and EXIF data',
      technologies: ['React Native', 'Supabase', 'GPS', 'EXIF', 'OpenCV', 'Python'],
      role: 'Lead Developer',
      outcome: 'Won FYP competition, deployed with real couriers for field testing',
      hasDeployment: true,
      hasUserTesting: true,
      hasCompetitionResult: true,
    }
  ],
  experiences: [
    {
      title: 'Final Year Project Lead',
      organization: 'University',
      duration: '1 year',
      description: 'Led development of Proof of Delivery system end-to-end',
      skills: ['React Native', 'Supabase', 'Python', 'OpenCV', 'System Design']
    }
  ],
  preferences: { workStyle: 'hybrid', teamSize: 'small', roleType: 'backend+AI' },
  missingInfo: ['Docker/deployment experience', 'LLM orchestration', 'Production scale experience'],
  confidence: 0.78,
}

export const demoCompanyProfile: CompanyProfile = {
  companyName: 'TechStartup AI',
  roleTitle: 'AI Software Engineer Intern',
  roleDescription: 'Build a local AI video analysis application that processes video footage and generates reports using LLMs.',
  painPoints: [
    'Need someone who can work under ambiguity',
    'Must deliver a working prototype quickly',
    'Previous interns struggled with connecting AI models to backend systems',
  ],
  mustHaveSkills: ['Python', 'LLM application development', 'Video analysis', 'Backend orchestration'],
  niceToHaveSkills: ['Docker', 'FastAPI', 'OpenCV', 'React'],
  teamContext: ['Small team of 4', 'Fast-moving startup', 'Direct access to CTO'],
  successCriteria: [
    'Working prototype within 3 months',
    'Can independently research and implement new AI tools',
    'Clear documentation of architecture decisions',
  ],
  cultureSignals: ['High autonomy', 'Fast iteration', 'Low bureaucracy'],
  confidence: 0.88,
}

const skillNodes: SkillNode[] = [
  {
    id: 'java_backend',
    label: 'Java Backend Development',
    type: 'technical_skill',
    confidence: 0.82,
    evidenceLevel: 'conversation_verified',
    evidence: [{ type: 'answer', text: 'Correctly explained Controller-Service-Repository pattern and exception handling', strength: 0.8 }],
    sourceMessages: [],
    relatedProjects: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'python_scripting',
    label: 'Python Scripting & AI',
    type: 'technical_skill',
    confidence: 0.72,
    evidenceLevel: 'project_supported',
    evidence: [{ type: 'project', text: 'Used Python for image processing in Proof of Delivery', strength: 0.72 }],
    sourceMessages: [],
    relatedProjects: ['Proof of Delivery System'],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'system_design',
    label: 'System Design Thinking',
    type: 'technical_skill',
    confidence: 0.78,
    evidenceLevel: 'project_supported',
    evidence: [{ type: 'project', text: 'Designed multi-component system integrating mobile, backend, and cloud storage', strength: 0.78 }],
    sourceMessages: [],
    relatedProjects: ['Proof of Delivery System'],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'computer_vision',
    label: 'Computer Vision Exposure',
    type: 'domain_knowledge',
    confidence: 0.65,
    evidenceLevel: 'project_supported',
    evidence: [{ type: 'project', text: 'Used OpenCV for EXIF and image verification in delivery app', strength: 0.65 }],
    sourceMessages: [],
    relatedProjects: ['Proof of Delivery System'],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'self_learning',
    label: 'Self-Learning Ability',
    type: 'behavioral_trait',
    confidence: 0.84,
    evidenceLevel: 'conversation_verified',
    evidence: [{ type: 'conversation', text: 'Independently learned React Native, Supabase, and OpenCV for FYP project', strength: 0.84 }],
    sourceMessages: [],
    relatedProjects: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'prototype_building',
    label: 'Prototype Building',
    type: 'execution_skill',
    confidence: 0.86,
    evidenceLevel: 'project_supported',
    evidence: [{ type: 'project', text: 'Built full working app used by real couriers in field testing', strength: 0.86 }],
    sourceMessages: [],
    relatedProjects: ['Proof of Delivery System'],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'field_testing',
    label: 'Field Testing Experience',
    type: 'execution_skill',
    confidence: 0.80,
    evidenceLevel: 'project_supported',
    evidence: [{ type: 'project', text: 'Conducted real-world testing with courier workflow', strength: 0.80 }],
    sourceMessages: [],
    relatedProjects: ['Proof of Delivery System'],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'iteration',
    label: 'Iterative Improvement',
    type: 'behavioral_trait',
    confidence: 0.79,
    evidenceLevel: 'conversation_supported',
    evidence: [{ type: 'conversation', text: 'Iterated on delivery app based on courier feedback during field testing', strength: 0.79 }],
    sourceMessages: [],
    relatedProjects: [],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'end_to_end_delivery',
    label: 'End-to-End Product Delivery',
    type: 'execution_skill',
    confidence: 0.83,
    evidenceLevel: 'project_supported',
    evidence: [{ type: 'project', text: 'Delivered complete product from idea to field deployment and competition win', strength: 0.83 }],
    sourceMessages: [],
    relatedProjects: ['Proof of Delivery System'],
    createdAt: now, updatedAt: now,
  },
  {
    id: 'backend_ai_goal',
    label: 'Backend / AI Engineer Goal',
    type: 'career_preference',
    confidence: 0.90,
    evidenceLevel: 'conversation_supported',
    evidence: [{ type: 'conversation', text: 'Explicitly stated goal to work as Backend or AI Application Engineer', strength: 0.90 }],
    sourceMessages: [],
    relatedProjects: [],
    createdAt: now, updatedAt: now,
  },
]

const graphEdges: GraphEdge[] = [
  { id: uuidv4(), from: 'self_learning', to: 'prototype_building', edgeType: 'empowers', weight: 0.86, condition: 'early-stage ambiguous AI product task', reason: 'Candidate learns new tools quickly and builds working prototypes', companyContext: 'AI video analysis intern role' },
  { id: uuidv4(), from: 'system_design', to: 'end_to_end_delivery', edgeType: 'supports', weight: 0.72, condition: 'AI app requires frontend-backend-model orchestration', reason: 'System design thinking helps connect multiple components', companyContext: 'AI video analysis intern role' },
  { id: uuidv4(), from: 'computer_vision', to: 'prototype_building', edgeType: 'supports', weight: 0.69, condition: 'role involves visual/video AI processing', reason: 'Prior OpenCV/image-based project experience is directly relevant', companyContext: 'AI video analysis intern role' },
  { id: uuidv4(), from: 'prototype_building', to: 'field_testing', edgeType: 'empowers', weight: 0.83, condition: 'product needs real-world validation', reason: 'Builder mindset leads naturally to testing with real users', },
  { id: uuidv4(), from: 'field_testing', to: 'iteration', edgeType: 'empowers', weight: 0.79, condition: 'iterative product development', reason: 'Field testing generates feedback that drives iteration', },
  { id: uuidv4(), from: 'iteration', to: 'self_learning', edgeType: 'empowers', weight: 0.81, condition: 'skill gaps discovered during iteration', reason: 'Each iteration cycle reveals new skills to learn', },
  { id: uuidv4(), from: 'java_backend', to: 'system_design', edgeType: 'supports', weight: 0.74, condition: 'backend architecture task', reason: 'Java backend experience informs system design decisions', },
  { id: uuidv4(), from: 'python_scripting', to: 'computer_vision', edgeType: 'supports', weight: 0.70, condition: 'AI/CV pipeline development', reason: 'Python is the primary language for OpenCV and AI tooling', },
]

const superNodes: SuperNode[] = [
  {
    id: 'high_agency_builder',
    label: 'High-Agency Builder',
    contains: ['self_learning', 'prototype_building', 'field_testing', 'iteration'],
    meaning: 'Candidate can independently learn, build, test, and improve a product under uncertainty.',
    confidence: 0.83,
    evidence: [
      { type: 'project', text: 'Full cycle demonstrated in Proof of Delivery: learned tools → built prototype → field tested → iterated → won competition', strength: 0.83 }
    ],
  },
]

export const demoTalentGraph: TalentGraph = {
  id: 'demo-graph-001',
  ownerType: 'candidate',
  ownerId: 'demo-candidate-001',
  nodes: skillNodes,
  edges: graphEdges,
  superNodes,
  confidence: 0.79,
  generatedAt: now,
}

export const demoMatchResult: MatchResult = {
  candidateId: 'demo-candidate-001',
  companyId: 'demo-company-001',
  fitScore: 82,
  fitLevel: 'strong_match',
  matchedReasons: [
    'High-Agency Builder loop matches the ambiguous fast-prototype requirement',
    'Computer Vision exposure directly supports video analysis task',
    'System design thinking supports AI app orchestration need',
    'Self-learning ability reduces onboarding risk for new AI tools',
    'End-to-end delivery evidence shows candidate can own a project independently',
  ],
  risks: [
    'No confirmed LLM orchestration experience (LangChain, LlamaIndex, etc.)',
    'Docker and containerised deployment not evidenced yet',
    'No production-scale backend experience confirmed',
    'Video analysis at scale (large files, latency) untested',
  ],
  missingEvidence: [
    'GitHub repo or code artifact to verify Java/Python quality',
    'Any LLM API integration example',
    'Deployment pipeline or CI/CD exposure',
  ],
  recommendedQuestions: [
    'Design a local AI video analysis pipeline: how would you connect ingestion, model inference, and report generation?',
    'How would you handle model inference latency for large video files?',
    'Walk me through how you would integrate an LLM API into a Python backend.',
    'What would your folder structure look like for this project?',
    'How did you handle errors and edge cases in your Proof of Delivery app?',
  ],
  candidateAdvice: [
    'Build a small LLM API integration demo (even a simple Q&A over a document)',
    'Dockerise your Proof of Delivery project to add deployment evidence',
    'Study LangChain or LlamaIndex basics before the interview',
    'Prepare to explain your system design decisions clearly',
  ],
  companyAdvice: [
    'Give candidate a small take-home: build a Python script that calls an LLM API on a video transcript',
    'Assess learning speed, not just current knowledge — this candidate learns fast',
    'Pair with a senior for first 2 weeks to bridge LLM production gap',
  ],
  graphHighlights: [
    'high_agency_builder',
    'self_learning',
    'computer_vision',
    'system_design',
  ],
  calculatedAt: now,
}