import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage   from './pages/LandingPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import AboutPage     from './pages/AboutPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                   element={<LandingPage />} />
        <Route path="/dashboard/:ticker"  element={<DashboardPage />} />
        <Route path="/about"              element={<AboutPage />} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
