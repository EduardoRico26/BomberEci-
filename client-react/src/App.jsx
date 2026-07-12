import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';

import Login     from './pages/Login';
import Registro  from './pages/Registro';
import Inicio    from './pages/Inicio';
import Lobby     from './pages/Lobby';
import Recuperar from './pages/Recuperar';

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="font-game text-red-500 text-xs animate-pulse">Cargando...</p>
    </div>
  );
  return usuario ? children : <Navigate to="/login" />;
}

function RutaPublica({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  return !usuario ? children : <Navigate to="/inicio" />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/registro" />} />
        <Route path="/registro" element={<RutaPublica><Registro /></RutaPublica>} />
        <Route path="/login"    element={<RutaPublica><Login /></RutaPublica>} />
        <Route path="/recuperar" element={<RutaPublica><Recuperar /></RutaPublica>} />
        <Route path="/inicio"   element={<RutaProtegida><Inicio /></RutaProtegida>} />
        <Route path="/lobby"    element={<RutaProtegida><Lobby /></RutaProtegida>} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}