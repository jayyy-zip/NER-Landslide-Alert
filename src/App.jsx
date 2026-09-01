import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import RoleSelect from './pages/RoleSelect'
import OfficerDashboard from './pages/OfficerDashboard'
import CitizenDashboard from './pages/CitizenDashboard'
import CitizenReport from './pages/CitizenReport'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/officer" element={<OfficerDashboard />} />
        <Route path="/citizen" element={<CitizenDashboard />} />
        <Route path="/report" element={<CitizenReport />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
