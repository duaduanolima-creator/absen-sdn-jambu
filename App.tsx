import React, { useState, useEffect } from 'react';
import { LoginView } from './views/LoginView';
import { TeacherDashboard } from './views/TeacherDashboard';
import { PrincipalDashboard } from './views/PrincipalDashboard';
import { User, AuthState, UserRole } from './types';
import { initializeData } from './services/mockBackend';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    dashboardMode: 'teacher'
  });

  useEffect(() => {
    // Initialize mock data
    initializeData();
    
    // Check for existing session
    const storedUser = localStorage.getItem('sdn_jambu_session');
    const storedMode = localStorage.getItem('sdn_jambu_mode') as UserRole || 'teacher';
    
    if (storedUser) {
        setAuth({
            user: JSON.parse(storedUser),
            isAuthenticated: true,
            dashboardMode: storedMode
        });
    }
  }, []);

  const handleLogin = (user: User, mode: UserRole) => {
    localStorage.setItem('sdn_jambu_session', JSON.stringify(user));
    localStorage.setItem('sdn_jambu_mode', mode);
    setAuth({
      user,
      isAuthenticated: true,
      dashboardMode: mode
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('sdn_jambu_session');
    localStorage.removeItem('sdn_jambu_mode');
    setAuth({
      user: null,
      isAuthenticated: false,
      dashboardMode: 'teacher'
    });
  };

  if (!auth.isAuthenticated || !auth.user) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Routing Logic:
  // If the stored dashboardMode is 'principal', show Principal Dashboard.
  // Otherwise show Teacher Dashboard.
  // This allows a Principal User to access Teacher Dashboard if they logged in via Teacher Tab.
  return auth.dashboardMode === 'principal' ? (
    <PrincipalDashboard user={auth.user} onLogout={handleLogout} />
  ) : (
    <TeacherDashboard user={auth.user} onLogout={handleLogout} />
  );
};

export default App;