import { useSessionStore } from '../store/sessionStore'
import { Sparkles, Users, Building2, GraduationCap, ArrowRight, GitBranch } from 'lucide-react'

export default function LandingPage() {
  const { initSession } = useSessionStore()

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] px-4 py-16">
      {/* Hero */}
      <div className="text-center max-w-2xl mb-12">
        <div className="inline-flex items-center gap-2 bg-violet-950 border border-violet-700 rounded-full px-4 py-1.5 text-violet-300 text-sm mb-6">
          <Sparkles size={14} />
          Conversation-first Talent Intelligence
        </div>
        <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
          Your Talent Graph,<br />
          <span className="text-violet-400">Built by AI</span>
        </h1>
        <p className="text-gray-400 text-lg mb-8 leading-relaxed">
          Talk to the AI. It understands who you are, verifies what you claim,
          builds your Talent Graph, and matches you to opportunities with
          explainable reasoning.
        </p>
        <button
          onClick={initSession}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors text-lg"
        >
          Start AI Intake
          <ArrowRight size={20} />
        </button>
      </div>

      {/* User type cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mb-16">
        <UserCard
          icon={<Users size={20} className="text-violet-400" />}
          title="Candidates"
          description="Build your living portfolio through conversation. Get your skills verified and matched to roles."
          color="violet"
        />
        <UserCard
          icon={<Building2 size={20} className="text-blue-400" />}
          title="Companies"
          description="Describe your role and team context. Get graph-powered candidate matching with explainable fit scores."
          color="blue"
        />
        <UserCard
          icon={<GraduationCap size={20} className="text-emerald-400" />}
          title="Universities"
          description="Understand aggregate skill gaps across your students and get curriculum gap recommendations."
          color="emerald"
        />
      </div>

      {/* How it works */}
      <div className="max-w-2xl w-full">
        <h2 className="text-center text-gray-400 text-sm font-semibold uppercase tracking-widest mb-6">How it works</h2>
        <div className="flex flex-col gap-3">
          {[
            { step: '01', label: 'Talk to the AI', desc: 'No forms. No uploads. Just conversation.' },
            { step: '02', label: 'Skills get verified', desc: 'Adaptive questions place your skills accurately.' },
            { step: '03', label: 'Talent Graph is built', desc: 'Nodes, edges, super-nodes, and confidence scores.' },
            { step: '04', label: 'Match with explanation', desc: 'Fit score, risks, gaps, and next steps.' },
          ].map(({ step, label, desc }) => (
            <div key={step} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl px-5 py-3.5">
              <span className="text-violet-500 font-mono text-sm font-bold w-6">{step}</span>
              <GitBranch size={14} className="text-gray-600" />
              <div>
                <span className="text-white font-medium text-sm">{label}</span>
                <span className="text-gray-500 text-sm ml-2">— {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UserCard({
  icon, title, description, color
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: 'violet' | 'blue' | 'emerald'
}) {
  const borders: Record<string, string> = {
    violet: 'border-violet-800 hover:border-violet-600',
    blue: 'border-blue-900 hover:border-blue-700',
    emerald: 'border-emerald-900 hover:border-emerald-700',
  }
  return (
    <div className={`bg-gray-900 border ${borders[color]} rounded-xl p-5 transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-semibold text-white text-sm">{title}</span>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  )
}