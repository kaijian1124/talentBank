import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { Send, Loader2, CheckCircle2, Circle, Zap } from 'lucide-react'
import {
  classifyUserType, getIntakeQuestion, getIntakeLength,
  extractSkillsFromText, getVerificationQuestion,
  evaluateVerificationAnswer, generateSkillNode,
  extractCandidateProfile, extractCompanyProfile,
  generateConfirmationSummary, generateChatResponse,
} from '../services/mockLlm'
import { buildTalentGraph } from '../services/graphService'
import { matchCandidateToCompany } from '../services/matchingService'
import { demoCompanyProfile } from '../services/mockData'
import type { CandidateProfile } from '../types'

export default function ChatPage() {
  const {
    session, progress, isLoading, isVerifying, verifyingSkill,
    addMessage, setUserType, incrementStep, setLoading,
    startVerification, endVerification, setProfile, setGraph, setMatchResult,
    updateProgress,
  } = useSessionStore()

  const [input, setInput] = useState('')
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (!hasInitialized.current && session && session.messages.length === 0) {
        hasInitialized.current = true
        addMessage('assistant', "Welcome to Talentbank 👋\n\nAre you here as a **Candidate**, **Company**, or **University**?\n\nFeel free to describe yourself naturally — I'll figure it out.")
    }
  }, [session, addMessage])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session?.messages])

  if (!session) return null

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    addMessage('user', text)
    setLoading(true)

    await delay(600)

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
        const firstQ = getIntakeQuestion(detected, 0)
        addMessage('assistant', `Got it — I'll set you up as a **${capitalise(detected)}**.\n\n*(1/${getIntakeLength(detected)})* ${firstQ}`)
        setLoading(false)
        return
      }

      // Step 2: handle verification
      if (isVerifying && verifyingSkill) {
        const result = evaluateVerificationAnswer(verifyingSkill, text)
        const node = generateSkillNode(verifyingSkill, result.confidence, result.evidenceText)

        // Add verified node to profile
        const currentProfile = session.structuredProfile as CandidateProfile | null
        if (currentProfile && 'verifiedSkills' in currentProfile) {
          const updated: CandidateProfile = {
            ...currentProfile,
            verifiedSkills: [...currentProfile.verifiedSkills.filter(n => n.id !== node.id), node],
          }
          setProfile(updated)
        }

        endVerification()
        addMessage('assistant', `${result.feedback}\n\nLet's continue building your profile. What else would you like to add, or shall I generate your Talent Graph now?`)
        updateProgress('claimsVerified', true)
        setLoading(false)
        return
      }

      // Step 3: confirmation step
      if (awaitingConfirmation) {
        const lower = text.toLowerCase()
        if (lower.match(/yes|correct|looks good|confirm|ok|sure|right/)) {
          setAwaitingConfirmation(false)
          addMessage('assistant', "Great! Generating your **Talent Graph** now... 🔮")
          await delay(800)

          const profile = session.structuredProfile as CandidateProfile
          const graph = buildTalentGraph(profile, session.id)
          setGraph(graph)

          addMessage('assistant', `Your Talent Graph is ready! I found **${graph.nodes.length} skill nodes**, **${graph.edges.length} edges**, and **${graph.superNodes.length} super node(s)**.\n\nShall I match you against a demo company role now?`)
        } else {
          setAwaitingConfirmation(false)
          addMessage('assistant', "No problem — what would you like to correct or add?")
        }
        setLoading(false)
        return
      }

      // Step 4: check if user wants to generate graph or run match
      const lower = text.toLowerCase()
      if (lower.match(/generate graph|build graph|ready|show graph|yes.*graph/)) {
        const msgs = session.messages.filter(m => m.role === 'user').map(m => m.content)
        const profile = session.userType === 'candidate'
          ? extractCandidateProfile(msgs)
          : extractCompanyProfile(msgs)
        setProfile(profile)

        if (session.userType === 'candidate') {
          const summary = generateConfirmationSummary(profile as CandidateProfile)
          setAwaitingConfirmation(true)
          addMessage('assistant', summary)
        } else {
          const graph = buildTalentGraph(profile as CandidateProfile, session.id)
          setGraph(graph)
          addMessage('assistant', "Your context has been captured. Graph generated!")
        }
        setLoading(false)
        return
      }

      if (lower.match(/match|compare|fit score|yes.*match|run match/)) {
        const profile = session.structuredProfile as CandidateProfile
        const graph = session.graph ?? buildTalentGraph(profile, session.id)
        if (!session.graph) setGraph(graph)

        const result = matchCandidateToCompany(graph, demoCompanyProfile)
        setMatchResult(result)
        addMessage('assistant', `Match complete! Your fit score is **${result.fitScore}/100** (${result.fitLevel.replace('_', ' ')}). Navigating to your match result...`)
        setLoading(false)
        return
      }

      // Step 5: normal intake flow
      const step = session.intakeStep
      const total = getIntakeLength(session.userType)

      // Check for skill mentions to queue verification
      const skills = extractSkillsFromText(text)
      if (skills.length > 0 && session.userType === 'candidate' && step >= 2 && step < total - 1) {
        incrementStep()
        const skill = skills[0]
        const verifyQ = getVerificationQuestion(skill)
        startVerification(skill)
        addMessage('assistant', `I noticed you mentioned **${skill}**. Great — I'll ask a few practical questions to place this skill accurately in your Talent Graph.\n\n${verifyQ}`)
        setLoading(false)
        return
      }

      incrementStep()
      const newStep = session.intakeStep + 1
      const response = generateChatResponse(session.userType, newStep, text, false)
      addMessage('assistant', response)

      // Auto-extract profile near end of intake
      if (newStep >= total - 1) {
        const msgs = session.messages.filter(m => m.role === 'user').map(m => m.content)
        const profile = session.userType === 'candidate'
          ? extractCandidateProfile([...msgs, text])
          : extractCompanyProfile([...msgs, text])
        setProfile(profile)

        if (session.userType === 'candidate') {
          await delay(400)
          const summary = generateConfirmationSummary(profile as CandidateProfile)
          setAwaitingConfirmation(true)
          addMessage('assistant', summary)
        }
      }
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

        {isVerifying && verifyingSkill && (
          <div className="bg-amber-950 border border-amber-800 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap size={12} className="text-amber-400" />
              <p className="text-xs text-amber-400 font-semibold">Verifying</p>
            </div>
            <p className="text-white text-sm font-medium">{verifyingSkill}</p>
          </div>
        )}

        {progress.graphGenerated && (
          <button
            onClick={() => {
              const profile = session.structuredProfile as CandidateProfile
              const graph = session.graph ?? buildTalentGraph(profile, session.id)
              const result = matchCandidateToCompany(graph, demoCompanyProfile)
              setMatchResult(result)
            }}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            Run Match →
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

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}