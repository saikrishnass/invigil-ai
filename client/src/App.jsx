import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { FacultyDashboard } from './pages/FacultyDashboard';
import { StudentJoin } from './pages/StudentJoin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<FacultyDashboard />} />
        <Route path="/join/:sessionId" element={<StudentJoin />} />
        <Route path="/join" element={<StudentJoin />} />
      </Routes>
    </BrowserRouter>
  );
}
