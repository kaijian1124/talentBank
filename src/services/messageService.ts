import type { AccountUser, MessageThread, ThreadMessage } from '../types'
import { isSupabaseConfigured, supabase } from './supabaseClient'

type ThreadRow = {
  id: string
  company_id: string
  candidate_id: string
  job_id: string | null
  job_title: string | null
  company_name: string
  candidate_name: string | null
  candidate_email: string | null
  last_message: string | null
  created_at: string
  updated_at: string
}

type MessageRow = {
  id: string
  thread_id: string
  sender_id: string
  sender_role: 'candidate' | 'company'
  body: string
  created_at: string
}

export type CreateThreadInput = {
  companyId: string
  candidateId: string
  jobId?: string
  jobTitle?: string
  companyName: string
  candidateName?: string
  candidateEmail?: string
}

export async function getOrCreateThread(input: CreateThreadInput): Promise<MessageThread> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: crypto.randomUUID(),
      companyId: input.companyId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      companyName: input.companyName,
      candidateName: input.candidateName,
      candidateEmail: input.candidateEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  let existingQuery = supabase
    .from('message_threads')
    .select('id, company_id, candidate_id, job_id, job_title, company_name, candidate_name, candidate_email, last_message, created_at, updated_at')
    .eq('company_id', input.companyId)
    .eq('candidate_id', input.candidateId)

  existingQuery = input.jobId ? existingQuery.eq('job_id', input.jobId) : existingQuery.is('job_id', null)

  const { data: existing, error: existingError } = await existingQuery.maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) return toThread(existing)

  const { data, error } = await supabase
    .from('message_threads')
    .insert({
      company_id: input.companyId,
      candidate_id: input.candidateId,
      job_id: input.jobId ?? null,
      job_title: input.jobTitle ?? null,
      company_name: input.companyName,
      candidate_name: input.candidateName ?? null,
      candidate_email: input.candidateEmail ?? null,
    })
    .select('id, company_id, candidate_id, job_id, job_title, company_name, candidate_name, candidate_email, last_message, created_at, updated_at')
    .single()

  if (error) throw new Error(error.message)
  return toThread(data)
}

export async function getThreadsForUser(user: AccountUser): Promise<MessageThread[]> {
  if (!isSupabaseConfigured || !supabase || !user.role) return []

  const column = user.role === 'company' ? 'company_id' : 'candidate_id'
  const { data, error } = await supabase
    .from('message_threads')
    .select('id, company_id, candidate_id, job_id, job_title, company_name, candidate_name, candidate_email, last_message, created_at, updated_at')
    .eq(column, user.id)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(toThread)
}

export async function getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
  if (!isSupabaseConfigured || !supabase) return []

  const { data, error } = await supabase
    .from('thread_messages')
    .select('id, thread_id, sender_id, sender_role, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(toMessage)
}

export async function sendThreadMessage(
  threadId: string,
  senderId: string,
  senderRole: 'candidate' | 'company',
  body: string
): Promise<ThreadMessage> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: crypto.randomUUID(),
      threadId,
      senderId,
      senderRole,
      body,
      createdAt: new Date().toISOString(),
    }
  }

  const trimmed = body.trim()
  const { data, error } = await supabase
    .from('thread_messages')
    .insert({
      thread_id: threadId,
      sender_id: senderId,
      sender_role: senderRole,
      body: trimmed,
    })
    .select('id, thread_id, sender_id, sender_role, body, created_at')
    .single()

  if (error) throw new Error(error.message)

  await supabase
    .from('message_threads')
    .update({ last_message: trimmed, updated_at: new Date().toISOString() })
    .eq('id', threadId)

  return toMessage(data)
}

export function subscribeToThreadMessages(
  threadId: string,
  onMessage: (message: ThreadMessage) => void
) {
  if (!isSupabaseConfigured || !supabase) return () => undefined

  const client = supabase
  const channel = client
    .channel(`thread_messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'thread_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => onMessage(toMessage(payload.new as MessageRow))
    )
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}

function toThread(row: ThreadRow): MessageThread {
  return {
    id: row.id,
    companyId: row.company_id,
    candidateId: row.candidate_id,
    jobId: row.job_id ?? undefined,
    jobTitle: row.job_title ?? undefined,
    companyName: row.company_name,
    candidateName: row.candidate_name ?? undefined,
    candidateEmail: row.candidate_email ?? undefined,
    lastMessage: row.last_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMessage(row: MessageRow): ThreadMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    createdAt: row.created_at,
  }
}



