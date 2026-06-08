import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { GradesPage } from './pages/GradesPage';
import { MyGradesPage } from './pages/MyGradesPage';
import { EnrollmentsPage } from './pages/EnrollmentsPage';
import { UsersPage } from './pages/UsersPage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/courses" replace />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />

            <Route
              path="/enrollments"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <EnrollmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-grades"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <MyGradesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/grades"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <GradesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/users"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
