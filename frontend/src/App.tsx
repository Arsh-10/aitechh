import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import EmotionalSupport from './pages/EmotionalSupport'
import Insights from './pages/Insights'
import DecisionAssistant from './pages/DecisionAssistant'
import StudyCompanion from './pages/StudyCompanion'
import ContractExplainer from './pages/ContractExplainer'
import MeetingToAction from './pages/MeetingToAction'
import Preview from './pages/Preview' // TEMP: visual QA route, remove before ship

// Private overlay routes — resolve to nothing unless the overlay is checked out.
const privateRouteModules = import.meta.glob<{
  routes?: { path: string; element: ReactNode }[]
}>('./private/registry.tsx', { eager: true })
const privateRoutes = Object.values(privateRouteModules).flatMap((m) => m?.routes ?? [])

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/preview" element={<Preview />} /> {/* TEMP: remove before ship */}
      <Route
        path="/app/emotional-support"
        element={
          <Protected>
            <EmotionalSupport />
          </Protected>
        }
      />
      <Route
        path="/app/emotional-support/insights"
        element={
          <Protected>
            <Insights />
          </Protected>
        }
      />
      <Route
        path="/app/decision"
        element={
          <Protected>
            <DecisionAssistant />
          </Protected>
        }
      />
      <Route
        path="/app/study"
        element={
          <Protected>
            <StudyCompanion />
          </Protected>
        }
      />
      <Route
        path="/app/contract"
        element={
          <Protected>
            <ContractExplainer />
          </Protected>
        }
      />
      <Route
        path="/app/meeting-to-action"
        element={
          <Protected>
            <MeetingToAction />
          </Protected>
        }
      />
      {privateRoutes.map((r) => (
        <Route key={r.path} path={r.path} element={<Protected>{r.element}</Protected>} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
