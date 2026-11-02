import { HashRouter, Routes, Route, NavLink, useLocation, Link } from 'react-router-dom'
import { Home, Library, Clapperboard, Settings, Plus } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import CreateVideo from './pages/CreateVideo'
import MediaLibrary from './pages/MediaLibrary'
import StoryboardEditor from './pages/StoryboardEditor'
import Productions from './pages/Productions'
import SettingsPage from './pages/Settings'
import ResearchPage from './pages/Research'
import StoryStructurePage from './pages/StoryStructure'
import ImportDna from './pages/ImportDna'
import CapabilityCheck from './pages/CapabilityCheck'
import CloudRender from './pages/CloudRender'
import Studio from './pages/Studio'

function Shell() {
  const loc = useLocation()
  const studio = loc.pathname === '/' || loc.pathname === '/cloud'
  return (
    <div className="min-h-screen bg-[#0b0d12] flex flex-col">
      {!studio && (
        <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-amber-200">FRAMEWORK</Link>
          <span className="text-xs text-zinc-500">Tools</span>
        </header>
      )}
      <main className={studio ? '' : 'flex-1 overflow-auto pb-24'}>
        <Routes>
          <Route path="/" element={<Studio />} />
          <Route path="/cloud" element={<Studio />} />
          <Route path="/create" element={<CreateVideo />} />
          <Route path="/import" element={<ImportDna />} />
          <Route path="/research/:id?" element={<ResearchPage />} />
          <Route path="/structure/:id" element={<StoryStructurePage />} />
          <Route path="/library" element={<MediaLibrary />} />
          <Route path="/storyboard/:id?" element={<StoryboardEditor />} />
          <Route path="/productions" element={<Productions />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/capability" element={<CapabilityCheck />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
      {!studio && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 flex justify-around py-1">
          <NavLink to="/dashboard" className={({ isActive }) => `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 text-xs ${isActive ? 'text-amber-300' : 'text-zinc-500'}`}>
            <Home size={20} /><span>Home</span>
          </NavLink>
          <NavLink to="/create" className={({ isActive }) => `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 text-xs ${isActive ? 'text-amber-300' : 'text-zinc-500'}`}>
            <Plus size={20} /><span>Create</span>
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 text-xs ${isActive ? 'text-amber-300' : 'text-zinc-500'}`}>
            <Library size={20} /><span>Library</span>
          </NavLink>
          <NavLink to="/productions" className={({ isActive }) => `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 text-xs ${isActive ? 'text-amber-300' : 'text-zinc-500'}`}>
            <Clapperboard size={20} /><span>Projects</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-2 py-1 text-xs ${isActive ? 'text-amber-300' : 'text-zinc-500'}`}>
            <Settings size={20} /><span>Settings</span>
          </NavLink>
        </nav>
      )}
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
