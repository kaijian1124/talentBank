import type { AccountUser, CandidateCapabilityGraph, CompanyProfile, UserType } from '../types'
import { isSupabaseConfigured, supabase } from './supabaseClient'

type ProfileRow = {
  id: string
  email: string
  display_name: string | null
  role: 'candidate' | 'company' | 'university' | null
  intake_completed: boolean | null
  candidate_graph: CandidateCapabilityGraph | null
  company_profile: CompanyProfile | null
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
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, intake_completed, candidate_graph, company_profile')
    .eq('id', authUser.id)
    .maybeSingle()

  if (error) throw new Error(error.message)

  if (!data) {
    return ensureProfile(authUser)
  }

  return toAccountUser(data)
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
    }
  }

  const displayName = (authUser.user_metadata.display_name as string | undefined) ?? authUser.email?.split('@')[0] ?? null
  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: authUser.id,
      email: authUser.email ?? '',
      display_name: displayName,
      role: null,
      intake_completed: false,
      candidate_graph: null,
      company_profile: null,
    })
    .select('id, email, display_name, role, intake_completed, candidate_graph, company_profile')
    .single()

  if (error) throw new Error(error.message)
  return toAccountUser(data)
}

export async function updateProfileRole(userId: string, role: Exclude<UserType, 'unknown'>): Promise<AccountUser | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, email, display_name, role, intake_completed, candidate_graph, company_profile')
    .single()

  if (error) throw new Error(error.message)
  return toAccountUser(data)
}

export async function markIntakeCompleted(
  userId: string,
  graph?: CandidateCapabilityGraph | null,
  companyProfile?: CompanyProfile | null
): Promise<AccountUser | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .update({
      intake_completed: true,
      ...(graph ? { candidate_graph: graph } : {}),
      ...(companyProfile ? { company_profile: companyProfile } : {}),
    })
    .eq('id', userId)
    .select('id, email, display_name, role, intake_completed, candidate_graph, company_profile')
    .single()

  if (error) throw new Error(error.message)
  return toAccountUser(data)
}

function toAccountUser(row: ProfileRow): AccountUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? row.email.split('@')[0],
    role: row.role,
    intakeCompleted: Boolean(row.intake_completed),
    candidateGraph: row.candidate_graph,
    companyProfile: row.company_profile,
  }
}
