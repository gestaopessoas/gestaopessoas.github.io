import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Colaboradores from './pages/Colaboradores';
import ArquivoMorto from './pages/ArquivoMorto';
import Armarios from './pages/Armarios';
import Uniformes from './pages/Uniformes';
import Ilhas from './pages/Ilhas';
import Aniversarios from './pages/Aniversarios';
import ControlePonto from './pages/ControlePonto';
import MPContratacao from './pages/mp/MPContratacao';
import MPAlteracao from './pages/mp/MPAlteracao';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="colaboradores" element={<Colaboradores />} />
          <Route path="arquivo-morto" element={<ArquivoMorto />} />
          <Route path="armarios" element={<Armarios />} />
          <Route path="uniformes" element={<Uniformes />} />
          <Route path="ilhas" element={<Ilhas />} />
          <Route path="aniversarios" element={<Aniversarios />} />
          <Route path="ponto" element={<ControlePonto />} />
          <Route path="mp/contratacao" element={<MPContratacao />} />
          <Route path="mp/alteracao" element={<MPAlteracao />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
