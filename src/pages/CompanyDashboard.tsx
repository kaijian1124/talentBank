import { useEffect, useState } from 'react'
import { Bell, Briefcase, Loader2, LogOut, Mail, MessageCircle, Network, PlusCircle, Send, X } from 'lucide-react'
import type { AccountUser, CandidateCapabilityGraph, CompanyNotification, JobPosting, MessageThread, ThreadMessage } from '../types'
import { closeJobPosting, createJobPosting, getCompanyJobs, getCompanyNotifications } from '../services/jobService'
import { getOrCreateThread, getThreadMessages, sendThreadMessage, subscribeToThreadMessages } from '../services/messageService'
import { buildCompanyRoleGraphFromJob } from '../services/companyGraph'
import { CapabilityGraphView } from './GraphPage'

export default function CompanyDashboard({
  user,
  onStartIntake,
  onLogout,
}: {
  user: AccountUser
  onStartIntake: () => void
  onLogout: () => void
}) {
  const [jobs, setJobs] = useState<JobPosting[]>([])
  const [notifications, setNotifications] = useState<CompanyNotification[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isPostingOpen, setIsPostingOpen] = useState(false)
  const [activeThread, setActiveThread] = useState<MessageThread | null>(null)
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([])
  const [reply, setReply] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [activeGraph, setActiveGraph] = useState<{ graph: CandidateCapabilityGraph; title: string } | null>(null)
  const openJobs = jobs.filter((job) => job.status === 'open')

  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    Promise.all([
      getCompanyJobs(user.id),
      getCompanyNotifications(user.id),
    ])
      .then(([companyJobs, companyNotifications]) => {
        if (ignore) return
        setJobs(companyJobs)
        setNotifications(companyNotifications)
      })
      .catch((error) => {
        if (!ignore) setMessage(error instanceof Error ? error.message : 'Failed to load company dashboard.')
      })
      .finally(() => {
        if (!ignore) setIsLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [user.id])

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
    })

    return () => {
      ignore = true
      unsubscribe()
    }
  }, [activeThread])

  const openNotificationThread = async (notification: CompanyNotification) => {
    if (!notification.candidateId) {
      setMessage('This old notification has no candidate account linked. Ask the candidate to apply again after the latest schema is active.')
      return
    }

    const job = jobs.find((item) => item.id === notification.jobId)
    try {
      const thread = await getOrCreateThread({
        companyId: user.id,
        candidateId: notification.candidateId,
        jobId: notification.jobId,
        jobTitle: job?.title,
        companyName: user.companyProfile?.companyName ?? user.displayName ?? 'Company',
        candidateName: notification.candidateName,
        candidateEmail: notification.candidateEmail,
      })
      setActiveThread(thread)
      setReply('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to open private message.')
    }
  }

  const handleSendMessage = async () => {
    if (!activeThread || !reply.trim()) return
    setIsSending(true)
    try {
      const sent = await sendThreadMessage(activeThread.id, user.id, 'company', reply)
      setThreadMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent])
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
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Company Dashboard</p>
            <h1 className="text-2xl font-bold text-white">{user.companyProfile?.companyName ?? user.displayName ?? 'Company'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPostingOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <Briefcase size={15} />
              Job Posting
            </button>
            <button
              onClick={onStartIntake}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <PlusCircle size={15} />
              Create role with AI
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
              <p className="text-white font-semibold mb-1">Complete your hiring intake</p>
              <p className="text-violet-200 text-sm leading-relaxed">
                Answer the company chatbox so Career OS can create your first job posting.
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <SummaryCard icon={<Briefcase size={16} />} label="Open roles" value={String(openJobs.length)} />
          <SummaryCard icon={<Bell size={16} />} label="Notifications" value={String(notifications.length)} />
        </div>

        {message && (
          <p className="border border-gray-800 bg-gray-900 text-gray-300 text-sm rounded-lg px-4 py-3 mb-4">{message}</p>
        )}

        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading company dashboard...</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <section>
              <h2 className="text-white font-semibold mb-3">Your job postings</h2>
              <div className="grid grid-cols-1 gap-3">
                {jobs.map((job) => (
                  <article key={job.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-white font-semibold">{job.title}</h3>
                        <p className="text-violet-300 text-sm">{job.companyName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${job.status === 'open' ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-gray-800 border-gray-700 text-gray-400'} border text-xs font-semibold px-2 py-1 rounded-full`}>
                          {job.status === 'open' ? 'Open' : 'Closed'}
                        </span>
                        {job.status === 'open' && (
                          <button
                            onClick={async () => {
                              await closeJobPosting(job.id, user.id)
                              setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: 'closed' } : item))
                              setMessage(`Closed position: ${job.title}`)
                            }}
                            className="border border-red-900 bg-red-950/40 hover:bg-red-950 text-red-300 text-xs font-semibold px-2 py-1 rounded-full transition-colors"
                          >
                            Close position
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed mb-3">{job.description}</p>
                    <button
                      onClick={() => setActiveGraph({ graph: buildCompanyRoleGraphFromJob(job), title: job.title })}
                      className="inline-flex items-center gap-1.5 border border-gray-700 hover:border-violet-600 text-gray-300 hover:text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                    >
                      <Network size={14} />
                      View graph
                    </button>
                  </article>
                ))}
                {jobs.length === 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-white font-semibold mb-1">No roles yet</p>
                    <p className="text-gray-500 text-sm">Use the AI intake or Job Posting to create your first role.</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-white font-semibold mb-3">Notifications</h2>
              <div className="grid grid-cols-1 gap-3">
                {notifications.map((notification) => (
                  <article key={notification.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <p className="text-white text-sm font-semibold mb-1">{notification.title}</p>
                    <p className="text-gray-400 text-sm leading-relaxed">{notification.message}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {notification.candidateEmail && (
                        <a
                          href={`mailto:${notification.candidateEmail}`}
                          className="inline-flex items-center gap-1.5 text-violet-300 hover:text-violet-200 text-sm font-semibold"
                        >
                          <Mail size={14} />
                          {notification.candidateName ? `${notification.candidateName} - ` : ''}
                          {notification.candidateEmail}
                        </a>
                      )}
                      <button
                        onClick={() => openNotificationThread(notification)}
                        className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
                      >
                        <MessageCircle size={14} />
                        Message candidate
                      </button>
                    </div>
                  </article>
                ))}
                {notifications.length === 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
                    <p className="text-white font-semibold mb-1">No notifications yet</p>
                    <p className="text-gray-500 text-sm">Candidate applications will appear here.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
      {isPostingOpen && (
        <JobPostingModal
          user={user}
          onClose={() => setIsPostingOpen(false)}
          onCreated={(job) => {
            setJobs((current) => [job, ...current])
            setMessage(`Job posted: ${job.title}`)
            setIsPostingOpen(false)
          }}
        />
      )}
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
          backLabel="Back to Dashboard"
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
      <div className="flex items-center gap-2 text-violet-400 mb-2">
        {icon}
        <span className="text-gray-500 text-xs uppercase tracking-widest">{label}</span>
      </div>
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
            <h2 className="text-white font-semibold">{thread.candidateName ?? thread.candidateEmail ?? 'Candidate'}</h2>
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

function JobPostingModal({
  user,
  onClose,
  onCreated,
}: {
  user: AccountUser
  onClose: () => void
  onCreated: (job: JobPosting) => void
}) {
  const companyName = user.companyProfile?.companyName ?? user.displayName ?? 'Company'
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [salaryCurrency, setSalaryCurrency] = useState('MYR')
  const [companyIntro, setCompanyIntro] = useState('')
  const [location, setLocation] = useState('')
  const [employmentType, setEmploymentType] = useState('Full-time')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (!title.trim() || !description.trim()) {
      setError('Position and job description are required.')
      return
    }
    setIsSubmitting(true)
    try {
      const job = await createJobPosting({
        companyId: user.id,
        companyName,
        title: title.trim(),
        description: description.trim(),
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        salaryCurrency,
        companyIntro: companyIntro.trim() || undefined,
        location: location.trim() || undefined,
        employmentType,
      })
      onCreated(job)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to post job.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Post a job</h2>
            <p className="text-gray-500 text-sm">Create a role directly without the AI chatbox.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
            <p className="text-xs text-gray-500 mb-1">Company</p>
            <p className="text-sm text-white font-medium">{companyName}</p>
          </div>          <Field label="Position" value={title} onChange={setTitle} placeholder="e.g. Junior Backend Engineer" />
          <TextArea label="Job description" value={description} onChange={setDescription} placeholder="Responsibilities, requirements, and what the candidate will work on." />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Salary min" value={salaryMin} onChange={setSalaryMin} placeholder="3000" type="number" />
            <Field label="Salary max" value={salaryMax} onChange={setSalaryMax} placeholder="5000" type="number" />
            <Field label="Currency" value={salaryCurrency} onChange={setSalaryCurrency} placeholder="MYR" />
          </div>

          <TextArea label="Company intro (optional)" value={companyIntro} onChange={setCompanyIntro} placeholder="Short company intro candidates will see." />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Location" value={location} onChange={setLocation} placeholder="Kuala Lumpur / Remote" />
            <Field label="Employment type" value={employmentType} onChange={setEmploymentType} placeholder="Full-time" />
          </div>

          {error && <p className="text-red-300 bg-red-950 border border-red-900 rounded-lg px-3 py-2 text-sm">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              Publish job
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-gray-400 text-sm font-medium mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600"
      />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="block">
      <span className="text-gray-400 text-sm font-medium mb-1.5 block">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-violet-600"
      />
    </label>
  )
}
