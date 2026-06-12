import { useState } from 'react'
import { ArrowRight, Briefcase, Loader2, Lock, Mail, UserPlus } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'
import { ensureProfile } from '../services/accountService'

export default function AuthPage({ onDemoLogin: _onDemoLogin }: { onDemoLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const isRegister = mode === 'register'

  const handleSubmit = async () => {
    setMessage('')
    if (!email.trim() || !password.trim()) {
      setMessage('Email and password are required.')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setMessage('Supabase is not configured. Check .env.local and restart npm run dev.')
      return
    }

    setIsLoading(true)
    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split('@')[0],
            },
          },
        })
        if (error) throw error
        if (data.user && data.session) {
          await ensureProfile({
            id: data.user.id,
            email: data.user.email ?? email,
            user_metadata: data.user.user_metadata,
          })
        }
        setMessage('Account created. Log in to start your Career OS intake.')
        setMode('login')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-57px)] grid grid-cols-1 lg:grid-cols-[1fr_420px]">
      <section className="px-6 py-10 lg:px-12 flex items-center">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-violet-300 bg-violet-950 border border-violet-800 rounded-full px-3 py-1 text-sm mb-5">
            <Briefcase size={14} />
            Candidate Career OS
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Build your talent graph, then find roles that fit.
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Register as a candidate, complete your AI intake, and review job matches ranked by fit.
          </p>
        </div>
      </section>

      <section className="border-l border-gray-800 bg-gray-950 px-6 py-10 flex items-center">
        <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              {isRegister ? <UserPlus size={16} /> : <Lock size={16} />}
            </div>
            <div>
              <h2 className="text-white font-semibold">{isRegister ? 'Create candidate account' : 'Candidate login'}</h2>
              <p className="text-gray-500 text-xs">Company and university accounts come later.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 bg-gray-950 border border-gray-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => setMode('login')}
              className={`text-sm px-3 py-2 rounded-md transition-colors ${!isRegister ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`text-sm px-3 py-2 rounded-md transition-colors ${isRegister ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Register
            </button>
          </div>

          {isRegister && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600 mb-3"
            />
          )}

          <div className="relative mb-3">
            <Mail size={15} className="absolute left-3 top-3.5 text-gray-500" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600"
            />
          </div>

          <div className="relative mb-4">
            <Lock size={15} className="absolute left-3 top-3.5 text-gray-500" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-9 pr-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-600"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {isRegister ? 'Create account' : 'Login'}
          </button>

          {message && (
            <p className="text-gray-400 text-sm leading-relaxed mt-4">{message}</p>
          )}
        </div>
      </section>
    </main>
  )
}
