import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    verificarSesion();
  }, []);

  async function verificarSesion() {
    try {
      const res = await axios.get('/auth/perfil');
      setUsuario(res.data.usuario);
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }

  async function login(correo, password) {
    const res = await axios.post('/auth/login', { correo, password });
    setUsuario(res.data.usuario);
    return res.data;
  }

  async function logout() {
    await axios.post('/auth/logout');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, verificarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}