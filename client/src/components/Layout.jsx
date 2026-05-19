import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.03),transparent_50%)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}
