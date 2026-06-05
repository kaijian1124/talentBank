import { useState, useEffect } from 'react'
import { useSessionStore } from './store/sessionStore'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import GraphPage from './pages/GraphPage'
import MatchPage from './pages/MatchPage'
import UniversityPage from './pages/UniversityPage'

type Page = 'landing' | 'chat' | 'graph' | 'match' | 'university'

function App() {
  const { session, progress } = useSessionStore()
  const [forcePage, setForcePage] = useState<Page | null>(null)

  useEffect(() => {
    document.title = 'Talentbank — AI Talent Graph'
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as Page
      setForcePage(detail)
    }
    window.addEventListener('goto', handler)
    return () => window.removeEventListener('goto', handler)
  }, [])

  const getPage = (): Page => {
    if (forcePage) return forcePage
    if (!session) return 'landing'
    if (progress.matchReady) return 'match'
    if (progress.graphGenerated) return 'graph'
    return 'chat'
  }

  const page = getPage()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-sm">T</div>
          <span className="font-semibold text-white">Talentbank</span>
          <span className="text-gray-500 text-xs ml-1">Career OS</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {session && (
            <button
              onClick={() => { useSessionStore.getState().resetSession(); setForcePage(null) }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              New Session
            </button>
          )}
          <button
            onClick={() => setForcePage(forcePage === 'university' ? null : 'university')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {forcePage === 'university' ? '← Back' : 'University Demo'}
          </button>
        </div>
      </nav>

      {/* Pages */}
      {page === 'university' && <UniversityPage onBack={() => setForcePage(null)} />}
      {page === 'landing' && <LandingPage />}
      {page === 'chat' && <ChatPage />}
      {page === 'graph' && <GraphPage />}
      {page === 'match' && <MatchPage />}
    </div>
  )
}

export default App