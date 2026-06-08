import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface Props {
  children: React.ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role as Role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
