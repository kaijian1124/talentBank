import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Briefcase, Building2, CheckCircle2, Loader2, LogOut, MessageCircle, Network, Search, Send, X } from 'lucide-react'
import type { AccountUser, CandidateCapabilityGraph, JobPosting, MessageThread, ThreadMessage } from '../types'
import type { MatchResult as HybridMatchResult } from '../lib/matching'
import { candidateProfileFromAccount, jobProfileFromPosting, matchCandidateToJob } from '../lib/matching'
import { applyToJob, getCandidateJobs, notifyCompanyOfRecommendedCandidate } from '../services/jobService'
import { getThreadMessages, getThreadsForUser, sendThreadMessage, subscribeToThreadMessages } from '../services/messageService'
import { buildCompanyRoleGraphFromJob } from '../services/companyGraph'
import { CapabilityGraphView } from './GraphPage'

export default function CandidateDashboard({
  user,
  onStartIntake,
  onLogout,
}: {
  user: AccountUser
  onStartIntake: () => void
  onLogout: () => void
}) {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [jobMatches, setJobMatches] = useState<Record<string, HybridMatchResult>>({})
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [activeThread, setActiveThread] = useState<MessageThread | null>(null)
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [activeGraph, setActiveGraph] = useState<{ graph: CandidateCapabilityGraph; title: string } | null>(null)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    Promise.all([getCandidateJobs(keyword), getThreadsForUser(user)])
      .then(async ([jobResult, threadResult]) => {
        const candidateProfile = candidateProfileFromAccount(user)
        const matchPairs = await Promise.all(jobResult.map(async (job) => {
          const match = await matchCandidateToJob(candidateProfile, jobProfileFromPosting(job))
          return [job.id, match] as const
        }))
        if (ignore) return
        const matchMap = Object.fromEntries(matchPairs)
        const scoredJobs = jobResult
          .map((job) => ({ ...job, fitScore: matchMap[job.id]?.finalScore ?? job.fitScore }))
          .sort((a, b) => b.fitScore - a.fitScore)
        setJobMatches(matchMap)
        setJobs(scoredJobs)
        setThreads(threadResult)
        void Promise.all(
          scoredJobs
            .filter((job) => (matchMap[job.id]?.finalScore ?? 0) >= 80)
            .map((job) => notifyCompanyOfRecommendedCandidate(job, user, matchMap[job.id]))
        ).catch((error) => console.error('Failed to create company recommendation notification', error))
      })
      .catch((error) => {
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load dashboard.')
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [keyword, user])

  useEffect(() => {
    if (!activeThread) return undefined
    let ignore = false
    getThreadMessages(activeThread.id)
      .then((messages) => {
        if (!ignore) setThreadMessages(messages)
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load messages.'))

    const unsubscribe = subscribeToThreadMessages(activeThread.id, (newMessage) => {
      setThreadMessages((current) => current.some((item) => item.id === newMessage.id) ? current : [...current, newMessage])
      setThreads((current) => current.map((thread) => thread.id === activeThread.id ? { ...thread, lastMessage: newMessage.body, updatedAt: newMessage.createdAt } : thread))
    })

    return () => {
      ignore = true
      unsubscribe()
    }
  }, [activeThread])

  const totalJobs = useMemo(() => jobs.length, [jobs])

  const handleApply = async (job: JobPosting) => {
    setMessage('')
    try {
      await applyToJob(job, user.id)
      setAppliedJobIds((current) => new Set(current).add(job.id))
      const updatedThreads = await getThreadsForUser(user)
      setThreads(updatedThreads)
      setMessage(`Application sent to ${job.companyName}. You can message them when they reply.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to submit application.')
    }
  }

  const handleSendMessage = async () => {
    if (!activeThread || !reply.trim()) return
    setIsSending(true)
    try {
      const sent = await sendThreadMessage(activeThread.id, user.id, 'candidate', reply)
      setThreadMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent])
      setThreads((current) => current.map((thread) => thread.id === activeThread.id ? { ...thread, lastMessage: sent.body, updatedAt: sent.createdAt } : thread))
      setReply('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send message.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-57px)] bg-gray-950">
      <section className="border-b border-gray-800 px-5 py-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Candidate Dashboard</p>
            <h1 className="text-2xl font-bold text-white">Welcome{user.displayName ? `, ${user.displayName}` : ''}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onStartIntake}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              Start AI Intake
              <ArrowRight size={15} />
            </button>
            <button
              onClick={onLogout}
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-6">
        {!user.intakeCompleted && (
          <div className="bg-violet-950 border border-violet-800 rounded-lg p-4 mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-white font-semibold mb-1">Complete your Career OS intake</p>
              <p className="text-violet-200 text-sm leading-relaxed">
                Answering the chatbox questions helps us match you to companies more accurately.
              </p>
            </div>
            <button
              onClick={onStartIntake}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              Continue intake
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          <SummaryCard icon={<Briefcase size={16} />} label="Open roles" value={String(totalJobs)} />
          <SummaryCard icon={<CheckCircle2 size={16} />} label="Hybrid matching" value={user.candidateGraph ? 'Active' : 'Limited'} />
          <SummaryCard icon={<Building2 size={16} />} label="Application status" value={`${appliedJobIds.size} sent`} />
          <SummaryCard icon={<MessageCircle size={16} />} label="Messages" value={String(threads.length)} />
        </div>

        {message && (
          <p className="border border-gray-800 bg-gray-900 text-gray-300 text-sm rounded-lg px-4 py-3 mb-4">{message}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4">
          <section>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-white font-semibold">Recommended jobs</h2>
                <p className="text-gray-500 text-sm">Sorted by hybrid vector + skill graph score.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search size={15} className="absolute left-3 top-3 text-gray-500" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Search jobs or keywords"
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600"
                />
              </div>
            </div>

            {isLoading ? (
              <p className="text-gray-500 text-sm">Loading jobs...</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isApplied={appliedJobIds.has(job.id)}
                    match={jobMatches[job.id]}
                    onApply={() => handleApply(job)}
                    onViewGraph={() => setActiveGraph({ graph: buildCompanyRoleGraphFromJob(job), title: job.title })}
                  />
                ))}
                {jobs.length === 0 && (
                  <div className="border border-gray-800 bg-gray-900 rounded-lg p-8 text-center">
                    <p className="text-white font-semibold mb-1">No jobs found</p>
                    <p className="text-gray-500 text-sm">Try another keyword.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-white font-semibold mb-3">Messages</h2>
            <div className="grid grid-cols-1 gap-3">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => {
                    setActiveThread(thread)
                    setReply('')
                  }}
                  className="text-left bg-gray-900 border border-gray-800 hover:border-violet-700 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-semibold">{thread.companyName}</p>
                      <p className="text-violet-300 text-sm">{thread.jobTitle ?? 'Private message'}</p>
                    </div>
                    <MessageCircle size={16} className="text-violet-400" />
                  </div>
                  <p className="text-gray-500 text-sm mt-2 line-clamp-2">{thread.lastMessage ?? 'No messages yet.'}</p>
                </button>
              ))}
              {threads.length === 0 && (
                <div className="border border-gray-800 bg-gray-900 rounded-lg p-6 text-center">
                  <p className="text-white font-semibold mb-1">No messages yet</p>
                  <p className="text-gray-500 text-sm">After you apply, company chats will appear here.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
      {activeGraph && (
        <RoleGraphModal
          graph={activeGraph.graph}
          title={activeGraph.title}
          onClose={() => setActiveGraph(null)}
        />
      )}
      {activeThread && (
        <MessageModal
          user={user}
          thread={activeThread}
          messages={threadMessages}
          reply={reply}
          isSending={isSending}
          onReplyChange={setReply}
          onSend={handleSendMessage}
          onClose={() => setActiveThread(null)}
        />
      )}
    </main>
  )
}

function RoleGraphModal({
  graph,
  title,
  onClose,
}: {
  graph: CandidateCapabilityGraph
  title: string
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-6xl bg-gray-950 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
        <CapabilityGraphView
          graph={graph}
          title="Role Requirement Graph"
          ownerLabel="Company Role"
          domain="Hiring"
          target={title}
          backLabel="Back to Jobs"
          footerText="Generated from this job posting"
          heightClass="h-[82vh]"
          onBack={onClose}
        />
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 text-violet-400 mb-2">{icon}<span className="text-gray-500 text-xs uppercase tracking-widest">{label}</span></div>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  )
}

function MessageModal({
  user,
  thread,
  messages,
  reply,
  isSending,
  onReplyChange,
  onSend,
  onClose,
}: {
  user: AccountUser
  thread: MessageThread
  messages: ThreadMessage[]
  reply: string
  isSending: boolean
  onReplyChange: (value: string) => void
  onSend: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="border-b border-gray-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">{thread.companyName}</h2>
            <p className="text-gray-500 text-sm">{thread.jobTitle ?? 'Private message'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="h-80 overflow-y-auto px-5 py-4 space-y-3 bg-gray-950">
          {messages.map((item) => {
            const mine = item.senderId === user.id
            return (
              <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`${mine ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-100'} max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed`}>
                  {item.body}
                </div>
              </div>
            )
          })}
          {messages.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-16">No messages yet.</p>
          )}
        </div>
        <div className="border-t border-gray-800 p-4 flex gap-2">
          <input
            value={reply}
            onChange={(event) => onReplyChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onSend()
            }}
            placeholder="Type a message"
            className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600"
          />
          <button
            onClick={onSend}
            disabled={isSending || !reply.trim()}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition-colors"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function MatchInsight({ match }: { match: HybridMatchResult }) {
  const missing = match.missingRequiredSkills.slice(0, 3)
  const recommended = match.recommendedNextSkills.filter((skill) => !missing.includes(skill)).slice(0, 3)
  const related = match.relatedSkillMatches.slice(0, 2).map((item) => `${item.candidateSkill} -> ${item.jobSkill}`)

  let message = 'Strong skill match. Add more project evidence to make your profile stronger.'
  let tone = 'text-emerald-200'

  if (missing.length > 0) {
    message = `Need to learn ${missing.join(', ')}`
    tone = 'text-amber-200'
  } else if (recommended.length > 0) {
    message = `Recommended next skills: ${recommended.join(', ')}`
    tone = 'text-amber-200'
  } else if (related.length > 0) {
    message = `Related skill path: ${related.join('; ')}`
    tone = 'text-sky-200'
  }

  return (
    <div className="mb-3 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
      <p className={`text-xs leading-relaxed ${tone}`}>{message}</p>
      {match.explanation.length > 0 && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sanitizeDashboardText(match.explanation[0])}</p>
      )}
    </div>
  )
}

function sanitizeDashboardText(text: string): string {
  return text
    .replace(/\?{2,}/g, '')
    .replace(/[\u0080-\u009f]/g, '')
    .replace(/[\ue000-\uf8ff]/g, '')
    .trim()
}

function JobCard({
  job,
  match,
  isApplied,
  onApply,
  onViewGraph,
}: {
  job: JobPosting
  match?: HybridMatchResult
  isApplied: boolean
  onApply: () => void
  onViewGraph: () => void
}) {
  const salary = job.salaryMin && job.salaryMax
    ? `${job.salaryCurrency} ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()}`
    : 'Salary not disclosed'

  return (
    <article className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-white font-semibold text-lg">{job.title}</h3>
            <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-semibold px-2 py-1 rounded-full">
              {job.fitScore}% fit
            </span>
          </div>
          <p className="text-violet-300 text-sm font-medium mb-2">{job.companyName}</p>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">{job.description}</p>
          {match && <MatchInsight match={match} />}
          {job.companyIntro && (
            <p className="text-gray-500 text-sm leading-relaxed mb-3">{job.companyIntro}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-gray-400">
            <span className="bg-gray-950 border border-gray-800 rounded-full px-2 py-1">{salary}</span>
            {job.location && <span className="bg-gray-950 border border-gray-800 rounded-full px-2 py-1">{job.location}</span>}
            {job.employmentType && <span className="bg-gray-950 border border-gray-800 rounded-full px-2 py-1">{job.employmentType}</span>}
          </div>
        </div>
        <div className="lg:w-44 flex flex-col gap-2">
          <button
            onClick={onApply}
            disabled={isApplied}
            className="bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            {isApplied ? 'Applied' : 'Apply'}
          </button>
          <button
            onClick={onViewGraph}
            className="border border-gray-700 hover:border-violet-600 text-gray-300 hover:text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Network size={14} />
            View graph
          </button>
        </div>
      </div>
    </article>
  )
}