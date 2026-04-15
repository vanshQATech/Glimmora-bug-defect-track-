import { Routes, Route, Navigate } from 'react-router-dom';
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

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
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
        <Route path="my-work" element={<MyWork />} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="users" element={<Users />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}
