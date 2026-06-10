import { Routes, Route, Link, useLocation } from 'react-router'
import Chat from './pages/Chat'
import Memories from './pages/Memories'
import Settings from './pages/Settings'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const isActive = location.pathname === to
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isActive
          ? 'bg-amber-900/30 text-amber-400 border border-amber-800/40'
          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
      }`}
    >
      {children}
    </Link>
  )
}

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-neutral-950">
      {/* 顶部导航 */}
      <header className="shrink-0 border-b border-neutral-800/60 bg-neutral-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-amber-500 font-bold text-lg tracking-tight">
              白桦工坊
            </Link>
            <span className="text-neutral-600 text-xs hidden sm:inline">v2.0</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/">工坊</NavLink>
            <NavLink to="/memories">白桦林</NavLink>
            <NavLink to="/settings">匠室</NavLink>
          </nav>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/memories" element={<Memories />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
