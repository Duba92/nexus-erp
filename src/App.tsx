/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/useAuthStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Employees from './pages/Employees';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import Loans from './pages/Loans';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Register from './pages/Register';
import Users from './pages/Users';
import DashboardLayout from './components/layout/DashboardLayout';
import { db } from './lib/db';
import { PWAUpdater } from './components/PWAUpdater';

function ProtectedRoute({ 
  children, 
  roles, 
  permission 
}: { 
  children: React.ReactNode; 
  roles?: string[]; 
  permission?: string;
}) {
  const { isAuthenticated, currentUser } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (currentUser) {
    // Role check
    if (roles && !roles.includes(currentUser.role)) {
      return <Navigate to="/" replace />;
    }

    // Permission check for employees/managers
    if (permission && 
        currentUser.role !== 'SUPER_ADMIN' && 
        currentUser.role !== 'COMPANY_ADMIN' && 
        !currentUser.permissions?.includes(permission)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

import { ThemeProvider } from './components/ThemeProvider';
import { useSync } from './hooks/useSync';

export default function App() {
  const { isAuthenticated } = useAuthStore();
  
  // Enable real-time Firestore -> Dexie sync
  useSync();

  return (
    <ThemeProvider>
      <Router>
        <PWAUpdater />
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/" replace />} />
          
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<ProtectedRoute roles={['SUPER_ADMIN']}><Companies /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['SUPER_ADMIN']}><Users /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute permission="inventory"><Inventory /></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute permission="pos"><POS /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute permission="hr"><Employees /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute permission="sales"><Reports /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </Router>
    </ThemeProvider>
  );
}
