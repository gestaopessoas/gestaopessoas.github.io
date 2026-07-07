import React from 'react';

const Ilhas = () => {
  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Mapeamento de Ilhas e Setores</h2>
        <button className="btn-primary">Novo Setor</button>
      </div>
      <div className="mt-4">
        <p className="text-muted">Nenhum mapeamento registrado.</p>
      </div>
    </div>
  );
};

export default Ilhas;
