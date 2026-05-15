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
import Settings from './pages/Settings';
import DashboardLayout from './components/layout/DashboardLayout';
import { db } from './lib/db';
import { PWAUpdater } from './components/PWAUpdater';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, currentUser } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && currentUser && !roles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Initialize Super Admin if no users exist
    const initDB = async () => {
      const userCount = await db.users.count();
      if (userCount === 0) {
        await db.users.add({
          fullName: 'Super Admin',
          email: 'admin@nexus.erp',
          passwordHash: 'admin123', // In a real app, hash this
          role: 'SUPER_ADMIN',
          createdAt: new Date(),
        });
      }
    };
    initDB();
  }, []);

  return (
    <Router>
      <PWAUpdater />
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
        
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/companies" element={<ProtectedRoute roles={['SUPER_ADMIN']}><Companies /></ProtectedRoute>} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </Router>
  );
}
