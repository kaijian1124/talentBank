import type { CompanyNotification, CompanyProfile, JobApplication, JobPosting } from '../types'
import { getOrCreateThread } from './messageService'
import { isSupabaseConfigured, supabase } from './supabaseClient'

export const MOCK_FIT_SCORE = 80

const mockJobs: JobPosting[] = [
  {
    id: 'job_frontend_intern',
    companyId: 'company_nova',
    companyName: 'Nova Digital',
    title: 'Frontend Developer Intern',
    description: 'Build React interfaces for customer dashboards and internal workflow tools.',
    salaryMin: 1200,
    salaryMax: 1800,
    salaryCurrency: 'MYR',
    companyIntro: 'Nova Digital builds SaaS products for small and medium businesses.',
    location: 'Kuala Lumpur',
    employmentType: 'Internship',
    status: 'open',
    fitScore: MOCK_FIT_SCORE,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'job_backend_junior',
    companyId: 'company_orbit',
    companyName: 'Orbit Systems',
    title: 'Junior Backend Engineer',
    description: 'Work on APIs, SQL data models, authentication, and cloud deployment pipelines.',
    salaryMin: 3200,
    salaryMax: 4500,
    salaryCurrency: 'MYR',
    companyIntro: 'Orbit Systems helps logistics teams automate routing and operations.',
    location: 'Petaling Jaya',
    employmentType: 'Full-time',
    status: 'open',
    fitScore: MOCK_FIT_SCORE,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'job_ai_assistant',
    companyId: 'company_helix',
    companyName: 'Helix AI Lab',
    title: 'AI Application Developer',
    description: 'Prototype LLM-powered workflows, evaluate prompts, and connect AI features to web apps.',
    salaryMin: 4000,
    salaryMax: 6500,
    salaryCurrency: 'MYR',
    companyIntro: 'Helix AI Lab builds practical AI tools for education and hiring.',
    location: 'Remote',
    employmentType: 'Full-time',
    status: 'open',
    fitScore: MOCK_FIT_SCORE,
    createdAt: new Date().toISOString(),
  },
]

export async function getCandidateJobs(keyword: string): Promise<JobPosting[]> {
  if (!isSupabaseConfigured || !supabase) {
    return filterAndSortJobs(mockJobs, keyword)
  }

  const { data, error } = await supabase
    .from('job_postings')
    .select(`
      id,
      company_id,
      title,
      description,
      salary_min,
      salary_max,
      salary_currency,
      company_intro,
      company_name,
      location,
      employment_type,
      status,
      created_at
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const jobs = (data ?? []).map((job): JobPosting => ({
    id: job.id,
    companyId: job.company_id,
    companyName: job.company_name,
    title: job.title,
    description: job.description,
    salaryMin: job.salary_min ?? undefined,
    salaryMax: job.salary_max ?? undefined,
    salaryCurrency: job.salary_currency ?? 'MYR',
    companyIntro: job.company_intro ?? undefined,
    location: job.location ?? undefined,
    employmentType: job.employment_type ?? undefined,
    status: 'open',
    fitScore: MOCK_FIT_SCORE,
    createdAt: job.created_at,
  }))

  return filterAndSortJobs(jobs, keyword)
}

export async function applyToJob(job: JobPosting, candidateId: string): Promise<JobApplication> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: crypto.randomUUID(),
      jobId: job.id,
      candidateId,
      companyId: job.companyId,
      status: 'submitted',
      fitScore: job.fitScore,
      candidateEmail: undefined,
      candidateName: undefined,
      createdAt: new Date().toISOString(),
    }
  }

  const { data: candidateProfile } = await supabase
    .from('profiles')
    .select('email, display_name')
    .eq('id', candidateId)
    .maybeSingle()

  const candidateEmail = candidateProfile?.email ?? 'Unknown email'
  const candidateName = candidateProfile?.display_name ?? candidateEmail

  const { data: application, error: applicationError } = await supabase
    .from('job_applications')
    .insert({
      job_id: job.id,
      candidate_id: candidateId,
      company_id: job.companyId,
      status: 'submitted',
      fit_score: job.fitScore,
      candidate_email: candidateEmail,
      candidate_name: candidateName,
    })
    .select('id, job_id, candidate_id, company_id, status, fit_score, candidate_email, candidate_name, created_at')
    .single()

  if (applicationError) throw new Error(applicationError.message)

  const { error: notificationError } = await supabase
    .from('company_notifications')
    .insert({
      company_id: job.companyId,
      candidate_id: candidateId,
      job_id: job.id,
      type: 'job_application',
      title: 'New job application',
      message: `${candidateName} applied for ${job.title} with ${job.fitScore}% fit. Contact: ${candidateEmail}`,
      candidate_email: candidateEmail,
      candidate_name: candidateName,
      is_read: false,
    })

  if (notificationError) throw new Error(notificationError.message)

  await getOrCreateThread({
    companyId: job.companyId,
    candidateId,
    jobId: job.id,
    jobTitle: job.title,
    companyName: job.companyName,
    candidateName,
    candidateEmail,
  })

  return {
    id: application.id,
    jobId: application.job_id,
    candidateId: application.candidate_id,
    companyId: application.company_id,
    status: application.status,
    fitScore: application.fit_score,
    candidateEmail: application.candidate_email ?? undefined,
    candidateName: application.candidate_name ?? undefined,
    createdAt: application.created_at,
  }
}

export async function createJobFromCompanyProfile(
  companyId: string,
  profile: CompanyProfile
): Promise<JobPosting> {
  const job: Omit<JobPosting, 'id' | 'fitScore' | 'createdAt'> = {
    companyId,
    companyName: profile.companyName || 'Company',
    title: profile.roleTitle || 'Open Role',
    description: profile.roleDescription || [
      profile.painPoints.length ? `Problem to solve: ${profile.painPoints.join(', ')}.` : '',
      profile.mustHaveSkills.length ? `Must-have skills: ${profile.mustHaveSkills.join(', ')}.` : '',
      profile.successCriteria.length ? `Success criteria: ${profile.successCriteria.join(', ')}.` : '',
    ].filter(Boolean).join(' '),
    salaryCurrency: 'MYR',
    companyIntro: profile.teamContext.length ? profile.teamContext.join(' ') : undefined,
    employmentType: 'Full-time',
    status: 'open',
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      ...job,
      id: crypto.randomUUID(),
      fitScore: MOCK_FIT_SCORE,
      createdAt: new Date().toISOString(),
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('job_postings')
    .select(`
      id,
      company_id,
      title,
      description,
      salary_min,
      salary_max,
      salary_currency,
      company_intro,
      company_name,
      location,
      employment_type,
      status,
      created_at
    `)
    .eq('company_id', companyId)
    .ilike('title', job.title)
    .ilike('description', job.description)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) return toJobPosting(existing)

  const { data, error } = await supabase
    .from('job_postings')
    .insert({
      company_id: companyId,
      company_name: job.companyName,
      title: job.title,
      description: job.description,
      salary_currency: job.salaryCurrency,
      company_intro: job.companyIntro ?? null,
      employment_type: job.employmentType ?? null,
      status: 'open',
    })
    .select(`
      id,
      company_id,
      title,
      description,
      salary_min,
      salary_max,
      salary_currency,
      company_intro,
      company_name,
      location,
      employment_type,
      status,
      created_at
    `)
    .single()

  if (error) throw new Error(error.message)
  return toJobPosting(data)
}

export async function createJobPosting(input: {
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
}): Promise<JobPosting> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ...input,
      id: crypto.randomUUID(),
      status: 'open',
      fitScore: MOCK_FIT_SCORE,
      createdAt: new Date().toISOString(),
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('job_postings')
    .select(`
      id,
      company_id,
      title,
      description,
      salary_min,
      salary_max,
      salary_currency,
      company_intro,
      company_name,
      location,
      employment_type,
      status,
      created_at
    `)
    .eq('company_id', input.companyId)
    .ilike('title', input.title)
    .ilike('description', input.description)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) return toJobPosting(existing)

  const { data, error } = await supabase
    .from('job_postings')
    .insert({
      company_id: input.companyId,
      company_name: input.companyName,
      title: input.title,
      description: input.description,
      salary_min: input.salaryMin ?? null,
      salary_max: input.salaryMax ?? null,
      salary_currency: input.salaryCurrency,
      company_intro: input.companyIntro ?? null,
      location: input.location ?? null,
      employment_type: input.employmentType ?? null,
      status: 'open',
    })
    .select(`
      id,
      company_id,
      title,
      description,
      salary_min,
      salary_max,
      salary_currency,
      company_intro,
      company_name,
      location,
      employment_type,
      status,
      created_at
    `)
    .single()

  if (error) throw new Error(error.message)
  return toJobPosting(data)
}

export async function getCompanyJobs(companyId: string): Promise<JobPosting[]> {
  if (!isSupabaseConfigured || !supabase) return []

  const { data, error } = await supabase
    .from('job_postings')
    .select(`
      id,
      company_id,
      title,
      description,
      salary_min,
      salary_max,
      salary_currency,
      company_intro,
      company_name,
      location,
      employment_type,
      status,
      created_at
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(toJobPosting)
}

export async function closeJobPosting(jobId: string, companyId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return

  const { error } = await supabase
    .from('job_postings')
    .update({ status: 'closed' })
    .eq('id', jobId)
    .eq('company_id', companyId)

  if (error) throw new Error(error.message)
}

export async function getCompanyNotifications(companyId: string): Promise<CompanyNotification[]> {
  if (!isSupabaseConfigured || !supabase) return []

  const { data, error } = await supabase
    .from('company_notifications')
    .select('id, company_id, candidate_id, job_id, type, title, message, candidate_email, candidate_name, is_read, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((notification) => ({
    id: notification.id,
    companyId: notification.company_id,
    candidateId: notification.candidate_id ?? undefined,
    jobId: notification.job_id ?? undefined,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    candidateEmail: notification.candidate_email ?? undefined,
    candidateName: notification.candidate_name ?? undefined,
    isRead: notification.is_read,
    createdAt: notification.created_at,
  }))
}

function filterAndSortJobs(jobs: JobPosting[], keyword: string): JobPosting[] {
  const q = keyword.trim().toLowerCase()
  const filtered = q
    ? jobs.filter((job) =>
        [
          job.title,
          job.companyName,
          job.description,
          job.companyIntro ?? '',
          job.location ?? '',
          job.employmentType ?? '',
        ].some((value) => value.toLowerCase().includes(q))
      )
    : jobs

  return [...filtered].sort((a, b) => b.fitScore - a.fitScore)
}

function toJobPosting(job: {
  id: string
  company_id: string
  company_name: string
  title: string
  description: string
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  company_intro: string | null
  location: string | null
  employment_type: string | null
  status?: 'open' | 'closed' | null
  created_at: string
}): JobPosting {
  return {
    id: job.id,
    companyId: job.company_id,
    companyName: job.company_name,
    title: job.title,
    description: job.description,
    salaryMin: job.salary_min ?? undefined,
    salaryMax: job.salary_max ?? undefined,
    salaryCurrency: job.salary_currency ?? 'MYR',
    companyIntro: job.company_intro ?? undefined,
    location: job.location ?? undefined,
    employmentType: job.employment_type ?? undefined,
    status: job.status ?? 'open',
    fitScore: MOCK_FIT_SCORE,
    createdAt: job.created_at,
  }
}

