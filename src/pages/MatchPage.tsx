import { useSessionStore } from '../store/sessionStore'
import { demoMatchResult } from '../services/mockData'
import {
  CheckCircle2, AlertTriangle, XCircle,
  HelpCircle, Lightbulb, Building2, ArrowLeft, Trophy
} from 'lucide-react'

export default function MatchPage() {
  const { session, initSession } = useSessionStore()
  const result = session?.matchResult ?? demoMatchResult

  const fitColor =
    result.fitLevel === 'exceptional_match' ? 'text-yellow-400' :
    result.fitLevel === 'strong_match' ? 'text-emerald-400' :
    result.fitLevel === 'moderate_match' ? 'text-amber-400' : 'text-red-400'

  const fitBg =
    result.fitLevel === 'exceptional_match' ? 'bg-yellow-950 border-yellow-700' :
    result.fitLevel === 'strong_match' ? 'bg-emerald-950 border-emerald-700' :
    result.fitLevel === 'moderate_match' ? 'bg-amber-950 border-amber-700' : 'bg-red-950 border-red-700'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => useSessionStore.getState().updateProgress('matchReady', false)}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Graph
        </button>
        <button
          onClick={initSession}
          className="text-violet-400 hover:text-violet-300 text-sm transition-colors"
        >
          New Session
        </button>
      </div>

      {/* Fit score hero */}
      <div className={`border rounded-2xl p-8 mb-6 text-center ${fitBg}`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy size={20} className={fitColor} />
          <span className={`text-sm font-semibold uppercase tracking-widest ${fitColor}`}>
            {result.fitLevel.replace(/_/g, ' ')}
          </span>
        </div>
        <div className={`text-7xl font-bold mb-2 ${fitColor}`}>{result.fitScore}</div>
        <p className="text-gray-400 text-sm">out of 100</p>

        {/* Score bar */}
        <div className="w-full max-w-sm mx-auto h-2 bg-gray-800 rounded-full mt-4">
          <div
            className={`h-2 rounded-full transition-all ${
              result.fitScore >= 85 ? 'bg-yellow-400' :
              result.fitScore >= 70 ? 'bg-emerald-400' :
              result.fitScore >= 50 ? 'bg-amber-400' : 'bg-red-400'
            }`}
            style={{ width: `${result.fitScore}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Matched reasons */}
        <Section
          icon={<CheckCircle2 size={15} className="text-emerald-400" />}
          title="Why this candidate matches"
          color="emerald"
        >
          {result.matchedReasons.map((r, i) => (
            <ListItem key={i} text={r} color="emerald" />
          ))}
        </Section>

        {/* Risks */}
        <Section
          icon={<AlertTriangle size={15} className="text-amber-400" />}
          title="Risks"
          color="amber"
        >
          {result.risks.map((r, i) => (
            <ListItem key={i} text={r} color="amber" />
          ))}
        </Section>

        {/* Missing evidence */}
        <Section
          icon={<XCircle size={15} className="text-red-400" />}
          title="Missing Evidence"
          color="red"
        >
          {result.missingEvidence.length > 0
            ? result.missingEvidence.map((r, i) => <ListItem key={i} text={r} color="red" />)
            : <p className="text-gray-500 text-sm">No critical gaps identified.</p>
          }
        </Section>

        {/* Recommended questions */}
        <Section
          icon={<HelpCircle size={15} className="text-blue-400" />}
          title="Suggested Interview Questions"
          color="blue"
        >
          {result.recommendedQuestions.map((r, i) => (
            <ListItem key={i} text={r} color="blue" />
          ))}
        </Section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Candidate advice */}
        <Section
          icon={<Lightbulb size={15} className="text-violet-400" />}
          title="Candidate Next Steps"
          color="violet"
        >
          {result.candidateAdvice.map((r, i) => (
            <ListItem key={i} text={r} color="violet" />
          ))}
        </Section>

        {/* Company advice */}
        <Section
          icon={<Building2 size={15} className="text-gray-400" />}
          title="Company Advice"
          color="gray"
        >
          {result.companyAdvice.map((r, i) => (
            <ListItem key={i} text={r} color="gray" />
          ))}
        </Section>
      </div>
    </div>
  )
}

function Section({
  icon, title, color, children
}: {
  icon: React.ReactNode
  title: string
  color: string
  children: React.ReactNode
}) {
  const borders: Record<string, string> = {
    emerald: 'border-emerald-900',
    amber: 'border-amber-900',
    red: 'border-red-900',
    blue: 'border-blue-900',
    violet: 'border-violet-900',
    gray: 'border-gray-700',
  }
  return (
    <div className={`bg-gray-900 border ${borders[color] ?? 'border-gray-700'} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-white text-sm font-semibold">{title}</h3>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function ListItem({ text, color }: { text: string; color: string }) {
  const dots: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    gray: 'bg-gray-500',
  }
  return (
    <div className="flex items-start gap-2">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dots[color] ?? 'bg-gray-500'}`} />
      <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
    </div>
  )
}