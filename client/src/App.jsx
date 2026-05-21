import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthProvider'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Containers from './pages/Containers'
import ContainerDetail from './pages/ContainerDetail'
import StackDetail from './pages/StackDetail'
import Volumes from './pages/Volumes'
import Storage from './pages/Storage'
import Networks from './pages/Networks'
import Files from './pages/Files'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Smb from './pages/Smb'

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Dashboard />} />
          <Route path="/smb" element={<Smb />} />
          <Route path="/containers" element={<Containers />} />
          <Route path="/containers/:id" element={<ContainerDetail />} />
          <Route path="/stacks/:name" element={<StackDetail />} />
          <Route path="/volumes" element={<Volumes />} />
          <Route path="/networks" element={<Networks />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/files" element={<Files />} />
          <Route path="/stacks" element={<Navigate to="/containers" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
