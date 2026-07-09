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
import ControleRGS from './pages/ControleRGS';
import Custos from './pages/Custos';
import Vagas from './pages/Vagas';
import PublicJobRequest from './pages/PublicJobRequest';
import MPContratacao from './pages/mp/MPContratacao';
import MPAlteracao from './pages/mp/MPAlteracao';
import Configuracoes from './pages/Configuracoes';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/solicitar-vaga" element={<PublicJobRequest />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="colaboradores" element={<ProtectedRoute module="colaboradores"><Colaboradores /></ProtectedRoute>} />
          <Route path="arquivo-morto" element={<ProtectedRoute module="arquivo_morto"><ArquivoMorto /></ProtectedRoute>} />
          <Route path="armarios" element={<ProtectedRoute module="armarios"><Armarios /></ProtectedRoute>} />
          <Route path="uniformes" element={<ProtectedRoute module="uniformes"><Uniformes /></ProtectedRoute>} />
          <Route path="ilhas" element={<ProtectedRoute module="ilhas"><Ilhas /></ProtectedRoute>} />
          <Route path="aniversarios" element={<Aniversarios />} />
          <Route path="ponto" element={<ProtectedRoute module="ponto"><ControlePonto /></ProtectedRoute>} />
          <Route path="rgs" element={<ProtectedRoute module="rgs"><ControleRGS /></ProtectedRoute>} />
          <Route path="custos" element={<ProtectedRoute module="custos"><Custos /></ProtectedRoute>} />
          <Route path="vagas" element={<ProtectedRoute module="vagas"><Vagas /></ProtectedRoute>} />
          <Route path="mp/contratacao" element={<ProtectedRoute module="mp"><MPContratacao /></ProtectedRoute>} />
          <Route path="mp/alteracao" element={<ProtectedRoute module="mp"><MPAlteracao /></ProtectedRoute>} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
