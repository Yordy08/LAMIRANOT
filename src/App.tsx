import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage/HomePage'
import GeneradorVideoPage from './pages/GeneradorVideo/GeneradorVideoPage'
import GeneradorVideoHorizontalPage from './pages/GeneradorVideoHorizontal/GeneradorVideoHorizontalPage'
import { GeneratorProvider } from './features/generators/state/GeneratorProvider'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import LoginPage from './pages/LoginPage/LoginPage'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) return <LoginPage />

  return (
    <GeneratorProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/generador/video" element={<GeneradorVideoPage />} />
        <Route path="/generador/video-horizontal" element={<GeneradorVideoHorizontalPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </GeneratorProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

