import React from 'react';

const Aniversarios = () => {
  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between">
        <h2>Calendário de Aniversários</h2>
        <button className="btn-primary">Adicionar Colaborador</button>
      </div>
      <div className="mt-4">
        <p className="text-muted">Nenhum colaborador registrado no momento.</p>
      </div>
    </div>
  );
};

export default Aniversarios;
