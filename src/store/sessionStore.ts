import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  UserSession, UserType, ChatMessage,
  CandidateProfile, CompanyProfile, TalentGraph, MatchResult,
  CandidateCapabilityGraph, CandidateDomain,
} from '../types'
import type { IntakeProgress } from '../types'
import type { IntakePhase, StructuredAnswer, StructuredQuestion } from '../types/llmContract'

interface SessionStore {
  session: UserSession | null
  progress: IntakeProgress
  isLoading: boolean
  isVerifying: boolean
  verifyingSkill: string | null

  // actions
  initSession: () => void
  restoreSession: (session: UserSession) => void
  setUserType: (type: UserType) => void
  addMessage: (role: 'user' | 'assistant', content: string) => void
  setProfile: (profile: CandidateProfile | CompanyProfile) => void
  setGraph: (graph: TalentGraph) => void
  setCapabilityGraph: (graph: CandidateCapabilityGraph) => void
  setCandidateMeta: (meta: {
    domain?: CandidateDomain | null
    targetDirection?: string | null
    readyToBuild?: boolean
    phase?: IntakePhase
    pendingQuestion?: StructuredQuestion | null
  }) => void
  addStructuredAnswer: (answer: StructuredAnswer) => void
  clearPendingQuestion: () => void
  setMatchResult: (result: MatchResult) => void
  incrementStep: () => void
  setLoading: (val: boolean) => void
  startVerification: (skillName: string) => void
  endVerification: () => void
  updateProgress: (key: keyof IntakeProgress, val: boolean) => void
  resetSession: () => void
}

const defaultProgress: IntakeProgress = {
  roleDetected: false,
  profileExtracted: false,
  claimsVerified: false,
  graphGenerated: false,
  matchReady: false,
}

function makeSession(): UserSession {
  const now = Date.now()
  return {
    id: uuidv4(),
    userType: 'unknown',
    messages: [],
    structuredProfile: null,
    graph: null,
    matchResult: null,
    intakeStep: 0,
    verificationQueue: [],
    createdAt: now,
    updatedAt: now,
    capabilityGraph: null,
    candidateDomain: null,
    targetDirection: null,
    readyToBuild: false,
    intakePhase: 'anchor',
    structuredAnswers: [],
    pendingQuestion: null,
  }
}

function progressFromSession(session: UserSession): IntakeProgress {
  return {
    roleDetected: session.userType !== 'unknown',
    profileExtracted: Boolean(session.structuredProfile || session.candidateDomain || session.targetDirection),
    claimsVerified: session.structuredAnswers.length > 0 || Boolean(session.capabilityGraph),
    graphGenerated: Boolean(session.graph || session.capabilityGraph),
    matchReady: Boolean(session.matchResult),
  }
}
export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  progress: { ...defaultProgress },
  isLoading: false,
  isVerifying: false,
  verifyingSkill: null,

  initSession: () => set({
    session: makeSession(),
    progress: { ...defaultProgress },
    isLoading: false,
    isVerifying: false,
    verifyingSkill: null,
  }),
  restoreSession: (restoredSession) => set({
    session: restoredSession,
    progress: progressFromSession(restoredSession),
    isLoading: false,
    isVerifying: false,
    verifyingSkill: null,
  }),

  setUserType: (type) => set(state => ({
    session: state.session ? { ...state.session, userType: type } : null,
    progress: { ...state.progress, roleDetected: type !== 'unknown' },
  })),

  addMessage: (role, content) => {
    const session = get().session
    if (!session) return
    const msg: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
    }
    set(state => ({
      session: state.session
        ? { ...state.session, messages: [...state.session.messages, msg], updatedAt: Date.now() }
        : null,
    }))
  },

  setProfile: (profile) => set(state => ({
    session: state.session ? { ...state.session, structuredProfile: profile } : null,
    progress: { ...state.progress, profileExtracted: true },
  })),

  setGraph: (graph) => set(state => ({
    session: state.session ? { ...state.session, graph } : null,
    progress: { ...state.progress, graphGenerated: true },
  })),

  setCapabilityGraph: (graph) => set(state => ({
    session: state.session ? { ...state.session, capabilityGraph: graph } : null,
    progress: { ...state.progress, graphGenerated: true },
  })),

  setCandidateMeta: (meta) => set(state => ({
    session: state.session
      ? {
          ...state.session,
          candidateDomain: meta.domain !== undefined ? meta.domain : state.session.candidateDomain,
          targetDirection: meta.targetDirection !== undefined ? meta.targetDirection : state.session.targetDirection,
          readyToBuild: meta.readyToBuild !== undefined ? meta.readyToBuild : state.session.readyToBuild,
          intakePhase: meta.phase !== undefined ? meta.phase : state.session.intakePhase,
          pendingQuestion: meta.pendingQuestion !== undefined ? meta.pendingQuestion : state.session.pendingQuestion,
        }
      : null,
  })),

  addStructuredAnswer: (answer) => set(state => ({
    session: state.session
      ? {
          ...state.session,
          structuredAnswers: [...state.session.structuredAnswers, answer],
          updatedAt: Date.now(),
        }
      : null,
  })),

  clearPendingQuestion: () => set(state => ({
    session: state.session ? { ...state.session, pendingQuestion: null } : null,
  })),

  setMatchResult: (result) => set(state => ({
    session: state.session ? { ...state.session, matchResult: result } : null,
    progress: { ...state.progress, matchReady: true },
  })),

  incrementStep: () => set(state => ({
    session: state.session
      ? { ...state.session, intakeStep: state.session.intakeStep + 1 }
      : null,
  })),

  setLoading: (val) => set({ isLoading: val }),

  startVerification: (skillName) => set({
    isVerifying: true,
    verifyingSkill: skillName,
    progress: { ...get().progress, claimsVerified: false },
  }),

  endVerification: () => set({
    isVerifying: false,
    verifyingSkill: null,
    progress: { ...get().progress, claimsVerified: true },
  }),

  updateProgress: (key, val) => set(state => ({
    progress: { ...state.progress, [key]: val },
  })),

  resetSession: () => set({
    session: null,
    progress: { ...defaultProgress },
    isLoading: false,
    isVerifying: false,
    verifyingSkill: null,
  }),
}))