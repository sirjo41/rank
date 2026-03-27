import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/admin/AdminDashboard';
import JudgeDashboard from './components/judge/JudgeDashboard';
import AudienceDashboard from './components/audience/AudienceDashboard';
import RoleSelect from './components/RoleSelect';
import HeadRefereeDashboard from './components/referee/HeadRefereeDashboard';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/judge" element={<JudgeDashboard />} />
          <Route path="/referee" element={<HeadRefereeDashboard />} />
          <Route path="/audience" element={<AudienceDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
