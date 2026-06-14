import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { Send, Loader2, CheckCircle2, Circle, Zap, Network, SkipForward, Check, ListChecks } from 'lucide-react'
import {
  classifyUserType, getIntakeQuestion, getIntakeLength,
  extractCompanyJobPosting, extractCompanyProfile, generateChatResponse,
} from '../services/mockLlm'
import { buildTalentGraph } from '../services/graphService'
import { matchCandidateToCompany } from '../services/matchingService'
import { demoCompanyProfile } from '../services/mockData'
import { generateCompanyJobPosting } from '../services/companyAnalysis'
import {
  getNextQuestion, buildCapabilityGraph, mergeGraphDelta, preserveSelfClaimedSkills, toGraphSummary,
} from '../services/candidateAnalysis'
import type { CandidateProfile, ChatMessage, CompanyProfile, JobPosting, UserType } from '../types'
import type { StructuredAnswer, StructuredQuestion } from '../types/llmContract'

const MAX_CANDIDATE_INTAKE_ANSWERS = 5

export default function ChatPage({
  onSkip,
  onRoleSelected,
  onIntakeCompleted,
  onCompanyIntakeCompleted,
  companyName,
}: {
  onSkip?: () => void
  onRoleSelected?: (role: Exclude<UserType, 'unknown'>) => void | Promise<void>
  companyName?: string
  onIntakeCompleted?: (graph?: ReturnType<typeof mergeGraphDelta>) => void
  onCompanyIntakeCompleted?: (
    jobDraft: Omit<JobPosting, 'id' | 'companyId' | 'fitScore' | 'status' | 'createdAt'>,
    profile: CompanyProfile
  ) => void
}) {
  const {
    session, progress, isLoading, isVerifying, verifyingSkill,
    addMessage, setUserType, incrementStep, setLoading,
    setProfile, setMatchResult,
    setCapabilityGraph, setCandidateMeta,
    addStructuredAnswer, clearPendingQuestion,
  } = useSessionStore()

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!hasInitialized.current && session && session.messages.length === 0) {
        hasInitialized.current = true
        addMessage('assistant', "Welcome to Talentbank ??\n\nAre you here as a **Candidate**, **Company**, or **University**?\n\nFeel free to describe yourself naturally ??I'll figure it out.")
    }
  }, [session, addMessage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages])

  if (!session) return null

  // ??? Candidate path (real LLM via local API) ??????????????????????
  const handleCandidateTurn = async (text: string, priorMessages: ChatMessage[]) => {
    const s = useSessionStore.getState().session
    if (!s) return
    try {
      const res = await getNextQuestion({
        messages: priorMessages,
        latestUserMessage: text,
        structuredAnswers: s.structuredAnswers,
        phase: s.intakePhase,
        graphSummary: toGraphSummary(s.capabilityGraph),
        domain: s.candidateDomain ?? undefined,
        targetDirection: s.targetDirection ?? null,
      })
      const answerCount = countCandidateAnswers(priorMessages, text)
      const questionBudgetReached = answerCount >= MAX_CANDIDATE_INTAKE_ANSWERS
      const hasStructured = !!res.structuredQuestion
      const shouldOfferBuild =
        (res.readyToBuild || questionBudgetReached) && !s.capabilityGraph && !hasStructured
      addMessage(
        'assistant',
        !hasStructured && questionBudgetReached && !s.capabilityGraph
          ? [
              'We have enough for a first-pass capability graph within the 30-minute intake.',
              '',
              'Click **Build Capability Graph** in the sidebar now. After that, you can refine it by adding more skills, projects, or evidence.',
            ].join('\n')
          : shouldOfferBuild
          ? [
              'I have enough to draft an initial capability graph.',
              '',
              `You can answer one more question to make it stronger: ${res.nextQuestion}`,
              '',
              'Or click **Build Capability Graph** in the sidebar now and refine it later.',
            ].join('\n')
          : res.nextQuestion
      )
      setCandidateMeta({
        domain: res.detectedDomain,
        targetDirection: res.targetDirection,
        readyToBuild: (res.readyToBuild || questionBudgetReached) && !hasStructured,
        phase: res.phase,
        pendingQuestion: res.structuredQuestion,
      })
    } catch (e) {
      addMessage('assistant', `?? I couldn't reach the analysis service. ${(e as Error).message}\n\nMake sure the API server is running (\`npm run dev\`) and your key is set in \`.env.local\`.`)
    }
  }

  // Candidate submitted a structured (MCQ/checklist) answer; record + continue.
  const handleStructuredSubmit = async (optionIds: string[], manualEntries: string[]) => {
    const s = useSessionStore.getState().session
    if (!s || isLoading) return
    const q = s.pendingQuestion
    if (!q) return
    const selectedLabels = q.options.filter((o) => optionIds.includes(o.id)).map((o) => o.label)
    const picks = [...selectedLabels, ...manualEntries]
    if (picks.length === 0) return
    const answer: StructuredAnswer = {
      questionId: q.id,
      phase: q.phase,
      selectedOptionIds: optionIds,
      selectedLabels,
      manualEntries,
    }
    const selectedRole = resolveRoleSelection(q, answer)
    const priorMessages = s.messages
    const summaryText = picks.join(', ')
    addStructuredAnswer(answer)
    clearPendingQuestion()
    if (selectedRole) {
      setCandidateMeta({
        targetDirection: selectedRole,
        phase: 'anchor',
        pendingQuestion: null,
      })
    }
    addMessage('user', summaryText)
    setLoading(true)
    try {
      await handleCandidateTurn(summaryText, priorMessages)
    } finally {
      setLoading(false)
    }
  }

  const handleBuildGraph = async () => {
    const s = useSessionStore.getState().session
    if (!s || isLoading) return
    setLoading(true)
    try {
      const lastUser = [...s.messages].reverse().find(m => m.role === 'user')?.content
        ?? 'Build my capability graph from the conversation so far.'
      const delta = await buildCapabilityGraph({
        messages: s.messages,
        latestUserMessage: lastUser,
        structuredAnswers: s.structuredAnswers,
        phase: s.intakePhase,
        graphSummary: toGraphSummary(s.capabilityGraph),
        domain: s.candidateDomain ?? undefined,
        targetDirection: s.targetDirection ?? null,
      })
      const enrichedDelta = preserveSelfClaimedSkills(delta, s.messages)
      const merged = mergeGraphDelta(s.capabilityGraph, enrichedDelta)
      setCapabilityGraph(merged)
      await onIntakeCompleted?.(merged)
      addMessage('assistant', `??Capability graph updated ??**${merged.nodes.length} nodes**, **${merged.edges.length} edges**. Opening your graph...`)
      window.dispatchEvent(new CustomEvent('goto', { detail: 'graph' }))
    } catch (e) {
      addMessage('assistant', `?? Build failed. ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    const priorMessages = session.messages
    addMessage('user', text)
    if (session.pendingQuestion) clearPendingQuestion()
    setLoading(true)

    try {
      // Step 1: detect user type if unknown
      if (session.userType === 'unknown') {
        const detected = classifyUserType(text)
        if (detected === 'unknown') {
          addMessage('assistant', "I didn't quite catch that. Are you a **Candidate** looking for work, a **Company** hiring, or a **University** tracking student outcomes?")
          setLoading(false)
          return
        }
        setUserType(detected)
        await onRoleSelected?.(detected)

        if (detected === 'candidate') {
          addMessage('assistant', "Got it ??I'll set you up as a **Candidate**. I'll ask adaptive questions to turn your real experiences into evidence of capability.")
          await handleCandidateTurn(text, priorMessages)
          setLoading(false)
          return
        }

        const firstQ = getIntakeQuestion(detected, 0)
        const intro = detected === 'company'
          ? `Got it. I will use **${companyName || 'your account company name'}** as the company name and help you create a job post with AI.`
          : `Got it. I'll set you up as a **${capitalise(detected)}**.`
        addMessage('assistant', `${intro}\n\n${firstQ}`)
        setLoading(false)
        return
      }

      // Candidate turns are fully handled by the real LLM.
      if (session.userType === 'candidate') {
        await handleCandidateTurn(text, priorMessages)
        setLoading(false)
        return
      }

      // ===== Company / University intake flow =====
      await delay(400)

      const total = getIntakeLength(session.userType)
      const answeredCount = session.intakeStep + 1
      incrementStep()

      if (session.userType === 'company') {
        const rawCompanyMessages = [...session.messages.filter(m => m.role === 'user').map(m => m.content), text]
        const msgs = rawCompanyMessages.length > total ? rawCompanyMessages.slice(-total) : rawCompanyMessages
        if (answeredCount >= total) {
          const extractedProfile = extractCompanyProfile(msgs)
          const profile = { ...extractedProfile, companyName: companyName || extractedProfile.companyName }
          let jobDraft: Omit<JobPosting, 'id' | 'companyId' | 'fitScore' | 'status' | 'createdAt'>
          try {
            const companyMessages: ChatMessage[] = msgs.map((content, index) => ({
              id: `company_answer_${index}`,
              role: 'user',
              content,
              timestamp: Date.now() + index,
            }))
            jobDraft = await generateCompanyJobPosting(companyMessages, companyName || profile.companyName)
          } catch {
            jobDraft = extractCompanyJobPosting(msgs, companyName || profile.companyName)
          }
          setProfile(profile)
          addMessage(
            'assistant',
            [
              'Thanks. I have enough to create a polished job post from this intake.',
              '',
              `**Position:** ${jobDraft.title}`,
              `**Company:** ${companyName || jobDraft.companyName}`,
              jobDraft.location ? `**Location:** ${jobDraft.location}` : '',
              jobDraft.employmentType ? `**Employment type:** ${jobDraft.employmentType}` : '',
              '',
              'I am saving it to your company dashboard now.',
            ].filter(Boolean).join('\n')
          )
          await onCompanyIntakeCompleted?.(jobDraft, profile)
          setLoading(false)
          return
        }

        const nextQ = getIntakeQuestion('company', answeredCount)
        addMessage('assistant', nextQ)
        setLoading(false)
        return
      }

      const response = generateChatResponse(session.userType, answeredCount, text, false)
      addMessage('assistant', response)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const messages = session.messages

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 p-4 flex-col gap-4 hidden md:flex">
        {onSkip && (
          <button
            onClick={onSkip}
            className="border border-gray-700 hover:border-violet-600 text-gray-300 hover:text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <SkipForward size={14} />
            Skip for now
          </button>
        )}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Progress</p>
          <div className="flex flex-col gap-2">
            {[
              { key: 'roleDetected', label: 'Role Detected' },
              { key: 'profileExtracted', label: 'Profile Extracted' },
              { key: 'claimsVerified', label: 'Claims Verified' },
              { key: 'graphGenerated', label: 'Graph Generated' },
              { key: 'matchReady', label: 'Match Ready' },
            ].map(({ key, label }) => {
              const done = progress[key as keyof typeof progress]
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  {done
                    ? <CheckCircle2 size={14} className="text-violet-400" />
                    : <Circle size={14} className="text-gray-600" />
                  }
                  <span className={done ? 'text-gray-200' : 'text-gray-500'}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {session.userType !== 'unknown' && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Detected as</p>
            <p className="text-violet-400 font-semibold capitalize">{session.userType}</p>
          </div>
        )}

        {session.userType === 'candidate' && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col gap-2">
            <div>
              <p className="text-xs text-gray-500">Domain</p>
              <p className="text-gray-200 text-sm font-medium capitalize">{session.candidateDomain ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Target direction</p>
              <p className="text-gray-200 text-sm font-medium">{session.targetDirection ?? '-'}</p>
            </div>
            <button
              onClick={handleBuildGraph}
              disabled={isLoading}
              className="mt-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Network size={14} />
              {session.capabilityGraph ? 'Update Capability Graph' : 'Build Capability Graph'}
            </button>
            {session.readyToBuild && !session.capabilityGraph && (
              <p className="text-violet-400 text-[11px] text-center">Ready to build from this conversation.</p>
            )}
            {session.capabilityGraph && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('goto', { detail: 'graph' }))}
                className="text-violet-400 hover:text-violet-300 text-xs"
              >
                View graph &gt;
              </button>
            )}
          </div>
        )}

        {isVerifying && verifyingSkill && (
          <div className="bg-amber-950 border border-amber-800 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap size={12} className="text-amber-400" />
              <p className="text-xs text-amber-400 font-semibold">Verifying</p>
            </div>
            <p className="text-white text-sm font-medium">{verifyingSkill}</p>
          </div>
        )}

        {progress.graphGenerated && session.userType !== 'candidate' && (
          <button
            onClick={() => {
              const profile = session.structuredProfile as unknown as CandidateProfile
              const graph = session.graph ?? buildTalentGraph(profile, session.id)
              const result = matchCandidateToCompany(graph, demoCompanyProfile)
              setMatchResult(result)
            }}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            Run Match &gt;
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
          {messages.map(msg => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 size={14} className="animate-spin" />
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {session.pendingQuestion && (
          <StructuredAnswerPanel
            question={session.pendingQuestion}
            disabled={isLoading}
            onSubmit={handleStructuredSubmit}
          />
        )}

        {/* Input */}
        <div className="border-t border-gray-800 px-4 py-4">
          <div className="flex gap-3 items-end max-w-3xl mx-auto">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter to send)"
              rows={1}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-violet-600 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} max-w-3xl ${isUser ? 'ml-auto' : 'mr-auto'} w-full`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-violet-700 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 shrink-0">T</div>
      )}
      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[80%] ${
        isUser
          ? 'bg-violet-700 text-white rounded-tr-sm'
          : 'bg-gray-900 border border-gray-800 text-gray-100 rounded-tl-sm'
      }`}>
        <MarkdownText text={content} />
      </div>
    </div>
  )
}

function MarkdownText({ text }: { text: string }) {
  // Simple bold and newline rendering
  const parts = text.split('\n')
  return (
    <>
      {parts.map((line, i) => {
        const segments = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
            {segments.map((seg, j) =>
              seg.startsWith('**') && seg.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{seg.slice(2, -2)}</strong>
                : seg
            )}
          </p>
        )
      })}
    </>
  )
}

function StructuredAnswerPanel({
  question,
  disabled,
  onSubmit,
}: {
  question: StructuredQuestion
  disabled: boolean
  onSubmit: (optionIds: string[], manualEntries: string[]) => void
}) {
  const isMulti = question.format === 'multi_select'
  const [selected, setSelected] = useState<string[]>([])
  const [manual, setManual] = useState('')

  useEffect(() => {
    setSelected([])
    setManual('')
  }, [question.id])

  const toggle = (id: string) => {
    setSelected((prev) =>
      isMulti
        ? prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        : prev.includes(id) ? [] : [id]
    )
  }

  const groups = Array.from(new Set(question.options.map((o) => o.group ?? '')))
  const manualEntries = manual.split(',').map((str) => str.trim()).filter(Boolean)
  const canSubmit = !disabled && (selected.length > 0 || manualEntries.length > 0)

  return (
    <div className="border-t border-gray-800 px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs text-gray-500 mb-2">
          {isMulti ? 'Select all that apply' : 'Choose one'}
          {question.allowManualEntry ? ' - or add your own below' : ''}
        </p>
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group || 'default'}>
              {group && (
                <p className="text-[11px] uppercase tracking-wider text-gray-600 mb-1.5">{group}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {question.options
                  .filter((o) => (o.group ?? '') === group)
                  .map((o) => {
                    const active = selected.includes(o.id)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggle(o.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors disabled:opacity-50 ${
                          active
                            ? 'bg-violet-600 border-violet-500 text-white'
                            : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-violet-600'
                        }`}
                      >
                        {active && <Check size={13} />}
                        {o.label}
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        {question.allowManualEntry && (
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            disabled={disabled}
            placeholder="Add your own (comma-separated)..."
            className="mt-3 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600"
          />
        )}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onSubmit(selected, manualEntries)}
            disabled={!canSubmit}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <ListChecks size={14} />
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}

function countCandidateAnswers(priorMessages: ChatMessage[], latestUserMessage: string) {
  const priorUserMessages = priorMessages.filter(m => m.role === 'user' && m.content.trim().length > 0)
  return priorUserMessages.length + (latestUserMessage.trim() ? 1 : 0)
}

function resolveRoleSelection(question: StructuredQuestion, answer: StructuredAnswer): string | null {
  if (!question.id.startsWith('sq_role_')) return null
  if (answer.selectedLabels[0]) return answer.selectedLabels[0]
  return answer.manualEntries[0]?.trim() || null
}
