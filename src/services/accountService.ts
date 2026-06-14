import type { AccountUser, CandidateCapabilityGraph, CompanyProfile, UserSession, UserType } from '../types'
import { isSupabaseConfigured, supabase } from './supabaseClient'

type BaseProfileRow = {
  id: string
  email: string
  display_name: string | null
  role: 'candidate' | 'company' | 'university' | null
}

type CandidateProfileRow = {
  user_id: string
  intake_completed: boolean | null
  candidate_domain: string | null
  target_direction: string | null
  candidate_graph: CandidateCapabilityGraph | null
  intake_session: UserSession | null
}

type CompanyProfileRow = {
  user_id: string
  intake_completed: boolean | null
  company_profile: CompanyProfile | null
  intake_session: UserSession | null
}

type UniversityProfileRow = {
  user_id: string
  intake_completed: boolean | null
  university_profile: Record<string, unknown> | null
  intake_session: UserSession | null
}

type AuthUser = {
  id: string
  email?: string
  user_metadata: Record<string, unknown>
}

export async function getAccountUser(authUser: AuthUser | null): Promise<AccountUser | null> {
  if (!authUser) return null

  if (!isSupabaseConfigured || !supabase) {
    return {
      id: authUser.id,
      email: authUser.email ?? '',
      displayName: (authUser.user_metadata.display_name as string | undefined) ?? authUser.email?.split('@')[0],
      role: 'candidate',
      intakeCompleted: true,
      candidateGraph: null,
      companyProfile: null,
      intakeSession: null,
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('id', authUser.id)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const base = data ? toBaseProfile(data) : await ensureBaseProfile(authUser)
  return hydrateAccountUser(base)
}

export async function ensureProfile(authUser: AuthUser): Promise<AccountUser> {
  if (!supabase) {
    return {
      id: authUser.id,
      email: authUser.email ?? '',
      displayName: (authUser.user_metadata.display_name as string | undefined) ?? authUser.email?.split('@')[0],
      role: null,
      intakeCompleted: false,
      candidateGraph: null,
      companyProfile: null,
      intakeSession: null,
    }
  }

  const base = await ensureBaseProfile(authUser)
  return hydrateAccountUser(base)
}

export async function updateProfileRole(userId: string, role: Exclude<UserType, 'unknown'>): Promise<AccountUser | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, email, display_name, role')
    .single()

  if (error) throw new Error(error.message)
  await ensureRoleProfile(userId, role)
  return hydrateAccountUser(toBaseProfile(data))
}

export async function markIntakeCompleted(
  userId: string,
  graph?: CandidateCapabilityGraph | null,
  companyProfile?: CompanyProfile | null
): Promise<AccountUser | null> {
  if (!supabase) return null

  const base = await getBaseProfile(userId)
  if (!base) return null

  if (base.role === 'company') {
    const { error } = await supabase
      .from('company_profiles')
      .upsert({
        user_id: userId,
        intake_completed: true,
        intake_session: null,
        ...(companyProfile ? { company_profile: companyProfile } : {}),
      }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  } else if (base.role === 'university') {
    const { error } = await supabase
      .from('university_profiles')
      .upsert({
        user_id: userId,
        intake_completed: true,
        intake_session: null,
      }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('candidate_profiles')
      .upsert({
        user_id: userId,
        intake_completed: true,
        ...(graph ? { candidate_graph: graph } : {}),
        intake_session: null,
      }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  }

  return hydrateAccountUser(base)
}

export async function updateCandidateExpectedSalary(user: AccountUser, expectedSalary: number): Promise<AccountUser> {
  const currentSession = user.intakeSession ?? createCandidatePreferenceSession(user)
  const currentProfile = currentSession.structuredProfile && 'preferences' in currentSession.structuredProfile
    ? currentSession.structuredProfile
    : createEmptyCandidateProfile(user)
  const preferences = {
    ...currentProfile.preferences,
    expectedSalary: String(expectedSalary),
  }
  const updatedSession: UserSession = {
    ...currentSession,
    userType: 'candidate',
    structuredProfile: {
      ...currentProfile,
      preferences,
    },
    updatedAt: Date.now(),
  }

  if (!supabase) {
    return {
      ...user,
      intakeSession: updatedSession,
    }
  }

  const { error } = await supabase
    .from('candidate_profiles')
    .upsert({
      user_id: user.id,
      intake_session: updatedSession,
      ...(user.candidateGraph ? { candidate_graph: user.candidateGraph } : {}),
    }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
  const base = await getBaseProfile(user.id)
  return base ? hydrateAccountUser(base) : { ...user, intakeSession: updatedSession }
}
export async function saveIntakeSession(
  userId: string,
  session: UserSession | null,
  roleHint?: Exclude<UserType, 'unknown'> | null
): Promise<void> {
  if (!supabase) return

  const base = await getBaseProfile(userId)
  const role = base?.role ?? roleHint ?? (session?.userType !== 'unknown' ? session?.userType : null)
  if (!base && !role) return
  if (role === 'company') {
    const { error } = await supabase
      .from('company_profiles')
      .upsert({
        user_id: userId,
        intake_completed: false,
        intake_session: session,
      }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
    return
  }

  if (role === 'university') {
    const { error } = await supabase
      .from('university_profiles')
      .upsert({
        user_id: userId,
        intake_completed: false,
        intake_session: session,
      }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase
    .from('candidate_profiles')
    .upsert({
      user_id: userId,
      intake_completed: false,
      intake_session: session,
      candidate_domain: session?.candidateDomain ?? null,
      target_direction: session?.targetDirection ?? null,
      ...(session?.capabilityGraph ? { candidate_graph: session.capabilityGraph } : {}),
    }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
}

export async function saveCandidateGraph(
  userId: string,
  graph: CandidateCapabilityGraph | null,
  session: UserSession | null
): Promise<AccountUser | null> {
  if (!supabase) return null

  const { error } = await supabase
    .from('candidate_profiles')
    .upsert({
      user_id: userId,
      intake_completed: false,
      candidate_graph: graph,
      intake_session: session,
      candidate_domain: session?.candidateDomain ?? null,
      target_direction: session?.targetDirection ?? null,
    }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
  const base = await getBaseProfile(userId)
  return base ? hydrateAccountUser(base) : null
}

async function ensureBaseProfile(authUser: AuthUser): Promise<BaseProfileRow> {
  if (!supabase) throw new Error('Supabase is not configured.')

  const displayName = (authUser.user_metadata.display_name as string | undefined) ?? authUser.email?.split('@')[0] ?? null
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: authUser.id,
      email: authUser.email ?? '',
      display_name: displayName,
    }, { onConflict: 'id' })
    .select('id, email, display_name, role')
    .single()

  if (error) throw new Error(error.message)
  return toBaseProfile(data)
}

async function getBaseProfile(userId: string): Promise<BaseProfileRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toBaseProfile(data) : null
}

async function ensureRoleProfile(userId: string, role: Exclude<UserType, 'unknown'>): Promise<void> {
  if (!supabase) return
  if (role === 'candidate') {
    const { error } = await supabase
      .from('candidate_profiles')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  } else if (role === 'company') {
    const { error } = await supabase
      .from('company_profiles')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  } else if (role === 'university') {
    const { error } = await supabase
      .from('university_profiles')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  }
}

async function hydrateAccountUser(base: BaseProfileRow): Promise<AccountUser> {
  const common = {
    id: base.id,
    email: base.email,
    displayName: base.display_name ?? base.email.split('@')[0],
    role: base.role,
  }

  if (!supabase) {
    return {
      ...common,
      intakeCompleted: false,
      candidateGraph: null,
      companyProfile: null,
      intakeSession: null,
    }
  }

  if (base.role === 'company') {
    const { data, error } = await supabase
      .from('company_profiles')
      .select('user_id, intake_completed, company_profile, intake_session')
      .eq('user_id', base.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const company = data as CompanyProfileRow | null
    return {
      ...common,
      intakeCompleted: Boolean(company?.intake_completed),
      candidateGraph: null,
      companyProfile: company?.company_profile ?? null,
      intakeSession: company?.intake_session ?? null,
    }
  }

  if (base.role === 'university') {
    const { data, error } = await supabase
      .from('university_profiles')
      .select('user_id, intake_completed, university_profile, intake_session')
      .eq('user_id', base.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const university = data as UniversityProfileRow | null
    return {
      ...common,
      intakeCompleted: Boolean(university?.intake_completed),
      candidateGraph: null,
      companyProfile: null,
      intakeSession: university?.intake_session ?? null,
    }
  }

  const { data, error } = await supabase
    .from('candidate_profiles')
    .select('user_id, intake_completed, candidate_domain, target_direction, candidate_graph, intake_session')
    .eq('user_id', base.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const candidate = data as CandidateProfileRow | null

  return {
    ...common,
    intakeCompleted: Boolean(candidate?.intake_completed),
    candidateGraph: candidate?.candidate_graph ?? null,
    companyProfile: null,
    intakeSession: candidate?.intake_session ?? null,
  }
}

function createCandidatePreferenceSession(user: AccountUser): UserSession {
  const now = Date.now()
  return {
    id: `salary_${user.id}`,
    userType: 'candidate',
    messages: [],
    structuredProfile: createEmptyCandidateProfile(user),
    graph: null,
    matchResult: null,
    intakeStep: 0,
    verificationQueue: [],
    createdAt: now,
    updatedAt: now,
    capabilityGraph: user.candidateGraph ?? null,
    candidateDomain: null,
    targetDirection: null,
    readyToBuild: Boolean(user.candidateGraph),
    intakePhase: 'ready',
    structuredAnswers: [],
    pendingQuestion: null,
  }
}

function createEmptyCandidateProfile(user: AccountUser) {
  return {
    name: user.displayName ?? user.email,
    careerGoal: undefined,
    targetRoles: [],
    claimedSkills: [],
    verifiedSkills: [],
    projects: [],
    experiences: [],
    preferences: {},
    missingInfo: [],
    confidence: 0,
  }
}
function toBaseProfile(row: BaseProfileRow): BaseProfileRow {
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
  }
}