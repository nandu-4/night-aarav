import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './Layout';
import { Announce, AdminConsole, Leaderboard } from './pages/Admin';
import Analytics from './pages/Analytics';
import { Certificates, VerifyPage } from './pages/Certificates';
import Course from './pages/Course';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MyLearning from './pages/MyLearning';
import { People, Submissions } from './pages/People';

const TITLES = {
  '/': 'Dashboard', '/learning': 'My Learning', '/certificates': 'Certificates',
  '/leaderboard': 'Leaderboard', '/people': 'Employees', '/submissions': 'Project Reviews',
  '/analytics': 'Analytics', '/announce': 'Announcements',
};

function Shell({ user, onLogout }) {
  const loc = useLocation();
  const title = loc.pathname.startsWith('/course/') ? 'Course' : TITLES[loc.pathname] || 'SkillForge';
  const home = { employee: <Dashboard />, manager: <People />, lead: <Analytics />, admin: <AdminConsole /> }[user.role];
  const staff = user.role !== 'employee';

  return (
    <Layout user={user} title={title} onLogout={onLogout}>
      <Routes>
        <Route path="/" element={user.role === 'employee' ? <Dashboard /> : home} />
        {!staff && <Route path="/learning" element={<MyLearning />} />}
        {!staff && <Route path="/course/:id" element={<Course />} />}
        {!staff && <Route path="/certificates" element={<Certificates />} />}
        <Route path="/leaderboard" element={<Leaderboard />} />
        {staff && <Route path="/people" element={<People />} />}
        {staff && <Route path="/submissions" element={<Submissions user={user} />} />}
        {staff && <Route path="/analytics" element={<Analytics />} />}
        {(user.role === 'manager' || user.role === 'admin') && <Route path="/announce" element={<Announce user={user} />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_user')) || null; } catch { return null; }
  });

  const logout = () => {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/verify/:vid" element={<VerifyPage />} />
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={user ? <Shell user={user} onLogout={logout} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
