import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Containers from './pages/Containers.jsx'
import Stacks from './pages/Stacks.jsx'
import ContainerDetail from './pages/ContainerDetail.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/containers" element={<Containers />} />
        <Route path="/containers/:id" element={<ContainerDetail />} />
        <Route path="/stacks" element={<Stacks />} />
      </Route>
    </Routes>
  )
}
