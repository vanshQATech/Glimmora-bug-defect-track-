import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import BugDetail from './pages/BugDetail';
import TaskDetail from './pages/TaskDetail';
import MyWork from './pages/MyWork';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import Workspace from './pages/Workspace';
import Activity from './pages/Activity';
import Profile from './pages/Profile';
import DatabasePage from './pages/Database';
import TestCases from './pages/TestCases';
import TestCaseProject from './pages/TestCaseProject';
import TestCaseDetail from './pages/TestCaseDetail';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return user ? children : <Navigate to="/login" state={{ from: location.pathname }} />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="bugs/:bugId" element={<BugDetail />} />
        <Route path="tasks/:taskId" element={<TaskDetail />} />
        <Route path="test-cases" element={<TestCases />} />
        <Route path="test-cases/case/:caseId" element={<TestCaseDetail />} />
        <Route path="test-cases/:projectId" element={<TestCaseProject />} />
        <Route path="my-work" element={<MyWork />} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="activity" element={<Activity />} />
        <Route path="profile" element={<Profile />} />
        <Route path="database" element={<DatabasePage />} />
        <Route path="users" element={<Users />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}
