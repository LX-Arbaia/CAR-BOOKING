import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import CarList from './components/CarList'
import AdminDashboard from './components/AdminDashboard'
import Nav from './components/Nav'
import { useAuth } from './hooks/useAuth'

export default function App(){
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav user={user} />
      <main className="p-6">
        <Routes>
          <Route path="/" element={ user ? <CarList /> : <Login /> } />
          <Route path="/admin" element={ user && user.role === 'admin' ? <AdminDashboard /> : <div>Access denied</div>} />
        </Routes>
      </main>
    </div>
  )
}
