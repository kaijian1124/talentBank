import { useEffect, useState } from 'react'
import { useSessionStore } from './store/sessionStore'
import type { AccountUser, CandidateCapabilityGraph, CompanyProfile, JobPosting, UserType } from './types'
import { getAccountUser, markIntakeCompleted, saveCandidateGraph, saveIntakeSession, updateProfileRole } from './services/accountService'
import { createJobPosting } from './services/jobService'
import { isSupabaseConfigured, supabase } from './services/supabaseClient'
import AuthPage from './pages/AuthPage'
import CandidateDashboard from './pages/CandidateDashboard'
import CompanyDashboard from './pages/CompanyDashboard'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import GraphPage from './pages/GraphPage'
import MatchPage from './pages/MatchPage'
import UniversityPage from './pages/UniversityPage'

type Page = 'auth' | 'dashboard' | 'landing' | 'chat' | 'graph' | 'match' | 'university'

function resumeOrStartIntake(user: AccountUser | null) {
  if (!user) return
  if (user.intakeSession) {
    useSessionStore.getState().restoreSession(user.intakeSession)
  } else if (!user.intakeCompleted) {
    useSessionStore.getState().initSession()
  }
}
function App() {
  const { session, progress, initSession, restoreSession } = useSessionStore()
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [forcePage, setForcePage] = useState<Page | null>(null)

  useEffect(() => {
    document.title = 'Talentbank Career OS'
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const user = await getAccountUser(data.session?.user ?? null)
      setAccountUser(user)
      resumeOrStartIntake(user)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, sessionData) => {
      const user = await getAccountUser(sessionData?.user ?? null)
      setAccountUser(user)
      setForcePage(null)
      useSessionStore.getState().resetSession()
      resumeOrStartIntake(user)
    })

    return () => listener.subscription.unsubscribe()
  }, [initSession, restoreSession])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Page
      setForcePage(detail)
    }
    window.addEventListener('goto', handler)
    return () => window.removeEventListener('goto', handler)
  }, [])


  useEffect(() => {
    if (!isSupabaseConfigured || !accountUser || !session) return
    const timeout = window.setTimeout(() => {
      saveIntakeSession(
        accountUser.id,
        session,
        accountUser.role ?? (session.userType !== 'unknown' ? session.userType : null)
      ).catch((error) => {
        console.error('Failed to save intake session:', error)
      })
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [accountUser, session])
  useEffect(() => {
    if (accountUser && !accountUser.role && !session) {
      initSession()
      setForcePage(null)
    }
  }, [accountUser, initSession, session])

  const getPage = (): Page => {
    if (!accountUser) return forcePage === 'university' ? 'university' : 'auth'
    if (!accountUser.role) return 'chat'
    if (forcePage) return forcePage
    if (!accountUser.intakeCompleted) return session ? 'chat' : 'dashboard'
    if (!session) return 'dashboard'
    if (progress.matchReady) return 'match'
    if (progress.graphGenerated) return 'graph'
    return 'chat'
  }

  const page = getPage()

  const handleDemoLogin = () => {
    setAccountUser({
      id: 'demo_candidate',
      email: 'candidate@example.com',
      displayName: 'Candidate',
      role: null,
      intakeCompleted: false,
    })
    initSession()
    setForcePage(null)
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    }
    useSessionStore.getState().resetSession()
    setAccountUser(null)
    setForcePage(null)
  }

  const handleStartIntake = () => {
    if (accountUser?.intakeSession && !accountUser.intakeCompleted) restoreSession(accountUser.intakeSession)
    else initSession()
    setForcePage(null)
  }

  const handleSkipIntake = async () => {
    if (!accountUser) return
    if (!accountUser.role) {
      initSession()
      setForcePage(null)
      return
    }
    const updated = isSupabaseConfigured
      ? await markIntakeCompleted(accountUser.id)
      : { ...accountUser, intakeCompleted: true }
    if (updated) setAccountUser(updated)
    useSessionStore.getState().resetSession()
    setForcePage('dashboard')
  }

  const handleRoleSelected = async (role: Exclude<UserType, 'unknown'>) => {
    if (!accountUser) return
    const updated = isSupabaseConfigured
      ? await updateProfileRole(accountUser.id, role)
      : { ...accountUser, role }
    if (updated) setAccountUser(updated)
  }

  const handleIntakeCompleted = async (graph?: CandidateCapabilityGraph) => {
    if (!accountUser) return
    const currentSession = useSessionStore.getState().session
    const candidateGraph = graph ?? currentSession?.capabilityGraph ?? null
    const sessionToSave = currentSession
      ? { ...currentSession, capabilityGraph: candidateGraph }
      : currentSession
    const updated = isSupabaseConfigured
      ? await saveCandidateGraph(accountUser.id, candidateGraph, sessionToSave)
      : { ...accountUser, candidateGraph, intakeSession: sessionToSave }
    if (updated) setAccountUser(updated)
  }

  const handleCompanyIntakeCompleted = async (
    jobDraft: Omit<JobPosting, 'id' | 'companyId' | 'fitScore' | 'status' | 'createdAt'>,
    profile: CompanyProfile
  ) => {
    if (!accountUser) return
    await createJobPosting({
      companyId: accountUser.id,
      companyName: accountUser.displayName || jobDraft.companyName || 'Company',
      title: jobDraft.title,
      description: jobDraft.description,
      salaryMin: jobDraft.salaryMin,
      salaryMax: jobDraft.salaryMax,
      salaryCurrency: jobDraft.salaryCurrency || 'MYR',
      companyIntro: jobDraft.companyIntro,
      location: jobDraft.location,
      employmentType: jobDraft.employmentType,
    })
    const updated = isSupabaseConfigured
      ? await markIntakeCompleted(accountUser.id, null, profile)
      : { ...accountUser, intakeCompleted: true, companyProfile: profile }
    if (updated) setAccountUser(updated)
    useSessionStore.getState().resetSession()
    setForcePage('dashboard')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">
        Loading Career OS...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm">T</div>
          <span className="font-semibold text-white">Talentbank</span>
          <span className="text-gray-500 text-xs ml-1">Career OS</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {accountUser?.role && (
            <button
              onClick={() => { useSessionStore.getState().resetSession(); setForcePage('dashboard') }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </button>
          )}
          {session && (
            <button
              onClick={() => { useSessionStore.getState().resetSession(); initSession(); setForcePage(null) }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              New Session
            </button>
          )}
          <button
            onClick={() => setForcePage(forcePage === 'university' ? null : 'university')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {forcePage === 'university' ? 'Back' : 'University Demo'}
          </button>
          {accountUser && (
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          )}
        </div>
      </nav>

      {page === 'auth' && <AuthPage onDemoLogin={handleDemoLogin} />}
      {page === 'dashboard' && accountUser?.role === 'candidate' && (
        <CandidateDashboard
          user={accountUser}
          onStartIntake={handleStartIntake}
          onLogout={handleLogout}
          onUserUpdated={setAccountUser}
        />
      )}
      {page === 'dashboard' && accountUser?.role === 'company' && (
        <CompanyDashboard
          user={accountUser}
          onStartIntake={handleStartIntake}
          onLogout={handleLogout}
        />
      )}
      {page === 'university' && <UniversityPage onBack={() => setForcePage(null)} />}
      {page === 'landing' && <LandingPage />}
      {page === 'chat' && (
        <ChatPage
          onSkip={handleSkipIntake}
          onRoleSelected={handleRoleSelected}
          companyName={accountUser?.displayName ?? undefined}
          onIntakeCompleted={handleIntakeCompleted}
          onCompanyIntakeCompleted={handleCompanyIntakeCompleted}
        />
      )}
      {page === 'graph' && <GraphPage />}
      {page === 'match' && <MatchPage />}
    </div>
  )
}

export default App
