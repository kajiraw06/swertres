import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PlaceBet from './pages/PlaceBet';
import MyBets from './pages/MyBets';
import Results from './pages/Results';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin';
import PaymentResult from './pages/PaymentResult';
import Profile from './pages/Profile';
import ForgotPassword from './pages/ForgotPassword';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';
  return (
    <>
      {user && <Navbar />}
      <div className="app-container" style={{ maxWidth: isAdmin ? 860 : 580, margin: '0 auto', padding: '18px 16px' }}>
        <Routes>
          <Route path="/login"          element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/register"       element={user ? <Navigate to="/" /> : <Register />} />
          <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/bet"     element={<PrivateRoute><PlaceBet /></PrivateRoute>} />
          <Route path="/my-bets" element={<PrivateRoute><MyBets /></PrivateRoute>} />
          <Route path="/results" element={<PrivateRoute><Results /></PrivateRoute>} />
          <Route path="/wallet"  element={<PrivateRoute><Wallet /></PrivateRoute>} />
          <Route path="/payment/success" element={<PrivateRoute><PaymentResult success /></PrivateRoute>} />
          <Route path="/payment/failed"  element={<PrivateRoute><PaymentResult /></PrivateRoute>} />
          <Route path="/admin"   element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
