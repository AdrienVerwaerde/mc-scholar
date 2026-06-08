import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItem = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer';
const active = 'bg-indigo-700 text-white';
const inactive = 'text-indigo-100 hover:bg-indigo-700/60';

export function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-indigo-800 flex flex-col">
        <img src="/mcsolaar2.webp" alt="MC Scholar Logo" className="shadow-md" />
        <div className="px-4 py-5 border-b border-indigo-700">
          <h1 className="text-white font-bold text-lg">MC SCHOLAR</h1>
          <p className="text-indigo-300 text-xs mt-0.5">{user?.name}</p>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-indigo-600 text-indigo-100">
            {user?.role}
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLink to="/courses" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
            📚 Courses
          </NavLink>

          {isStudent && (
            <NavLink to="/enrollments" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
              🎓 My Enrollments
            </NavLink>
          )}

          {(isTeacher || isAdmin) && (
            <NavLink to="/grades" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
              📝 Grades
            </NavLink>
          )}

          {isStudent && (
            <NavLink to="/my-grades" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
              📝 My Grades
            </NavLink>
          )}

          {isAdmin && (
            <>
              <div className="pt-2 pb-1 px-3 text-indigo-400 text-xs uppercase tracking-wider">Admin</div>
              <NavLink to="/users" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
                👥 Users
              </NavLink>
              <NavLink to="/admin" className={({ isActive }) => `${navItem} ${isActive ? active : inactive}`}>
                📊 Dashboard
              </NavLink>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-indigo-700">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-sm text-indigo-200 hover:text-white hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
          >
            ↩ Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[url('/mcsolaar4.jpg')] bg-cover p-6">
        <Outlet />
      </main>
    </div>
  );
}
