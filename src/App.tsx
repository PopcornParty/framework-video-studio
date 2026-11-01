import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Home, Library, Clapperboard, Settings, Plus } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import CreateVideo from './pages/CreateVideo'
import MediaLibrary from './pages/MediaLibrary'
import StoryboardEditor from './pages/StoryboardEditor'
import Productions from './pages/Productions'
import SettingsPage from './pages/Settings'

function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-dark-bg flex flex-col">
        <header className="border-b border-dark-border px-4 py-3 flex items-center justify-between sticky top-0 bg-dark-bg/95 backdrop-blur z-10">
          <h1 className="text-lg font-semibold tracking-tight">FRAMEWORK</h1>
          <span className="text-xs text-gray-500">Video Studio</span>
        </header>

        <main className="flex-1 overflow-auto pb-20">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateVideo />} />
            <Route path="/library" element={<MediaLibrary />} />
            <Route path="/storyboard/:id?" element={<StoryboardEditor />} />
            <Route path="/productions" element={<Productions />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-dark-card border-t border-dark-border flex justify-around py-2 safe-area-inset-bottom">
          <NavLink to="/" className={({ isActive }) => `flex flex-col items-center px-3 py-1 text-xs ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
            <Home size={20} />
            <span>Home</span>
          </NavLink>
          <NavLink to="/create" className={({ isActive }) => `flex flex-col items-center px-3 py-1 text-xs ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
            <Plus size={20} />
            <span>Create</span>
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => `flex flex-col items-center px-3 py-1 text-xs ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
            <Library size={20} />
            <span>Library</span>
          </NavLink>
          <NavLink to="/productions" className={({ isActive }) => `flex flex-col items-center px-3 py-1 text-xs ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
            <Clapperboard size={20} />
            <span>Projects</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `flex flex-col items-center px-3 py-1 text-xs ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </HashRouter>
  )
}

export default App
