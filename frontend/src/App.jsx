import { Routes, Route, Navigate } from 'react-router-dom';
import GuestRecordPage from './pages/GuestRecordPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import AdminEventDetailPage from './pages/AdminEventDetailPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/r/:slug" element={<GuestRecordPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/events/:id" element={<AdminEventDetailPage />} />
      <Route path="*" element={<p className="page-center">Page not found.</p>} />
    </Routes>
  );
}
