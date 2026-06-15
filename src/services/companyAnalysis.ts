import type { ChatMessage, JobPosting } from '../types'
import type { CompanyJobPostingResponse } from '../types/llmContract'

type CompanyJobDraft = Omit<JobPosting, 'id' | 'companyId' | 'fitScore' | 'status' | 'createdAt'>

export async function generateCompanyJobPosting(
  messages: ChatMessage[],
  fallbackCompanyName?: string
): Promise<CompanyJobDraft> {
  const res = await fetch('/api/company/job-posting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, fallbackCompanyName }),
  })

  if (!res.ok) {
    const detail = await safeReadError(res)
    throw new Error(detail ?? `company job posting failed with status ${res.status}`)
  }

  const data = (await res.json()) as CompanyJobPostingResponse
  return {
    companyName: data.companyName,
    title: data.title,
    description: data.description,
    salaryMin: data.salaryMin ?? undefined,
    salaryMax: data.salaryMax ?? undefined,
    salaryCurrency: data.salaryCurrency || 'MYR',
    companyIntro: data.companyIntro ?? undefined,
    location: data.location ?? undefined,
    employmentType: data.employmentType ?? undefined,
  }
}

async function safeReadError(res: Response): Promise<string | null> {
  try {
    const json = (await res.json()) as { error?: string }
    return json.error ?? null
  } catch {
    return null
  }
}