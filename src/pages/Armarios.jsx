import React from 'react';

const Armarios = () => {
  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Controle de Armários</h2>
        <button className="btn-primary">Adicionar Armário</button>
      </div>
      <div className="mt-4">
        <p className="text-muted">Nenhum armário cadastrado no momento.</p>
      </div>
    </div>
  );
};

export default Armarios;
