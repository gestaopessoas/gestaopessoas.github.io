import React from 'react';

const Uniformes = () => {
  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Gestão de Uniformes</h2>
        <button className="btn-primary">Registrar Entrega</button>
      </div>
      <div className="mt-4">
        <p className="text-muted">Nenhum registro de uniforme no momento.</p>
      </div>
    </div>
  );
};

export default Uniformes;
