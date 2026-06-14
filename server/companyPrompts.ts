import type { CompanyJobPostingRequest } from '../src/types/llmContract'

const COMPANY_JOB_POSTING_SYSTEM = [
  'You are TalentBank Career OS for employers. Your job is to help non-expert HR users turn rough hiring needs into a clear job_postings row.',
  'Extract only information supported by the conversation, but expand vague language into professional, candidate-facing wording.',
  'The output will be inserted into public.job_postings with these columns: company_name, title, description, salary_min, salary_max, salary_currency, company_intro, location, employment_type.',
  'The description should be polished and useful for matching: include responsibilities, concrete problems to solve, must-have skills, nice-to-have skills if mentioned, success criteria, and working context.',
  'Do not invent salary, location, or employment type if missing. Use null for missing optional fields. Default salaryCurrency to MYR unless another currency is clearly stated.',
  'If company name is missing, use the provided fallback company name. If title is vague, create a concise role title from the hiring need.',
  'Return only the structured JSON fields requested.',
].join('\n')

export function buildCompanyJobPostingInput(req: CompanyJobPostingRequest) {
  const transcript = (req.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'Employer' : 'TalentBank'}: ${m.content}`)
    .join('\n')

  return [
    { role: 'system' as const, content: COMPANY_JOB_POSTING_SYSTEM },
    {
      role: 'user' as const,
      content: [
        `Fallback company name: ${req.fallbackCompanyName || 'Company'}`,
        '',
        'Hiring intake conversation:',
        transcript || '(empty)',
      ].join('\n'),
    },
  ]
}