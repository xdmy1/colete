import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import DriverHome from './pages/DriverHome'
import AddParcel from './pages/AddParcel'
import AdminDashboard from './pages/AdminDashboard'
import Archive from './pages/Archive'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
})

function AuthenticatedRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  // Admin vede AdminDashboard, driver vede DriverHome
  const isAdmin = profile?.role === 'admin'

  return (
    <Routes>
      <Route
        path="/"
        element={isAdmin ? <AdminDashboard /> : <DriverHome />}
      />
      <Route path="/add" element={<AddParcel />} />
      <Route path="/archive" element={<Archive />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthenticatedRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
