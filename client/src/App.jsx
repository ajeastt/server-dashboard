import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Containers from './pages/Containers.jsx'
import ContainerDetail from './pages/ContainerDetail.jsx'
import Images from './pages/Images.jsx'
import Volumes from './pages/Volumes.jsx'
import Networks from './pages/Networks.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/containers" element={<Containers />} />
        <Route path="/containers/:id" element={<ContainerDetail />} />
        <Route path="/images" element={<Images />} />
        <Route path="/volumes" element={<Volumes />} />
        <Route path="/networks" element={<Networks />} />
        <Route path="/stacks" element={<Navigate to="/containers" replace />} />
      </Route>
    </Routes>
  )
}
