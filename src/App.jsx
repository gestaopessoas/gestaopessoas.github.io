import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Colaboradores from './pages/Colaboradores';
import Armarios from './pages/Armarios';
import Uniformes from './pages/Uniformes';
import Ilhas from './pages/Ilhas';
import Aniversarios from './pages/Aniversarios';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Rota pública */}
        <Route path="/login" element={<Login />} />

        {/* Rotas protegidas - exige login */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="colaboradores" element={<Colaboradores />} />
          <Route path="armarios" element={<Armarios />} />
          <Route path="uniformes" element={<Uniformes />} />
          <Route path="ilhas" element={<Ilhas />} />
          <Route path="aniversarios" element={<Aniversarios />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
