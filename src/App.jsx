import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Colaboradores from './pages/Colaboradores';
import Armarios from './pages/Armarios';
import Uniformes from './pages/Uniformes';
import Ilhas from './pages/Ilhas';
import Aniversarios from './pages/Aniversarios';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="colaboradores" element={<Colaboradores />} />
        <Route path="armarios" element={<Armarios />} />
        <Route path="uniformes" element={<Uniformes />} />
        <Route path="ilhas" element={<Ilhas />} />
        <Route path="aniversarios" element={<Aniversarios />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
