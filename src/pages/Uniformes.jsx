import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2, Plus, Minus, Package, Users } from 'lucide-react';

const Uniformes = () => {
  const [activeTab, setActiveTab] = useState('historico'); // 'historico' | 'estoque'
  const [uniforms, setUniforms] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state - Estoque
  const [newPieceType, setNewPieceType] = useState('');
  const [newPieceSize, setNewPieceSize] = useState('');
  const [newPieceQuantity, setNewPieceQuantity] = useState('');

  // Form state - Entrega
  const [employeeId, setEmployeeId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  // items to deliver will be an array of objects { inventory_id, qty }
  const [deliveryItems, setDeliveryItems] = useState([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'historico') {
      // Fetch employees for dropdown
      const { data: emps } = await supabase.from('employees').select('id, name').order('name');
      if (emps) setEmployees(emps);

      // Fetch uniforms with employee relation
      const { data: unis } = await supabase
        .from('uniforms')
        .select(`
          *,
          employees (name)
        `)
        .order('delivery_date', { ascending: false });
      if (unis) setUniforms(unis);
      
      // Fetch inventory to populate the dropdown in the delivery form
      const { data: inv } = await supabase.from('uniform_inventory').select('*').order('piece_type');
      if (inv) setInventory(inv);
    } else {
      // Fetch inventory for estoque tab
      const { data: inv } = await supabase.from('uniform_inventory').select('*').order('piece_type').order('size');
      if (inv) setInventory(inv);
    }
    setLoading(false);
  };

  // ----- INVENTORY METHODS -----

  const handleAddInventory = async (e) => {
    e.preventDefault();
    if (!newPieceType || !newPieceSize || newPieceQuantity === '' || newPieceQuantity < 0) return;

    // Check if it already exists
    const existing = inventory.find(i => i.piece_type === newPieceType && i.size === newPieceSize);
    if (existing) {
      const { error } = await supabase.from('uniform_inventory')
        .update({ quantity: existing.quantity + parseInt(newPieceQuantity), updated_at: new Date() })
        .eq('id', existing.id);
      if (error) alert("Erro: " + error.message);
    } else {
      const { error } = await supabase.from('uniform_inventory')
        .insert([{ 
          piece_type: newPieceType, 
          size: newPieceSize, 
          quantity: parseInt(newPieceQuantity)
        }]);
      if (error) alert("Erro: " + error.message);
    }

    setNewPieceType('');
    setNewPieceSize('');
    setNewPieceQuantity('');
    fetchData();
  };

  const handleUpdateQuantity = async (id, currentQty, amount) => {
    const newQty = currentQty + amount;
    if (newQty < 0) return;
    const { error } = await supabase.from('uniform_inventory')
      .update({ quantity: newQty, updated_at: new Date() })
      .eq('id', id);
    if (error) alert("Erro ao atualizar: " + error.message);
    else fetchData();
  };

  const handleDeleteInventory = async (id) => {
    if(window.confirm('Excluir este item do estoque?')) {
      await supabase.from('uniform_inventory').delete().eq('id', id);
      fetchData();
    }
  };

  // ----- DELIVERY METHODS -----

  const handleAddDeliveryItem = () => {
    setDeliveryItems([...deliveryItems, { inventory_id: '', qty: 1 }]);
  };

  const handleRemoveDeliveryItem = (index) => {
    const newItems = [...deliveryItems];
    newItems.splice(index, 1);
    setDeliveryItems(newItems);
  };

  const handleDeliveryItemChange = (index, field, value) => {
    const newItems = [...deliveryItems];
    newItems[index][field] = value;
    setDeliveryItems(newItems);
  };

  const handleSubmitDelivery = async (e) => {
    e.preventDefault();
    if (!employeeId || !deliveryDate) {
      alert("Preencha colaborador e data.");
      return;
    }
    
    // Filter out items without inventory_id or qty <= 0
    const validItems = deliveryItems.filter(item => item.inventory_id && item.qty > 0);
    if (validItems.length === 0) {
      alert("Adicione pelo menos um item válido.");
      return;
    }

    const p_items = validItems.map(item => ({
      inventory_id: item.inventory_id,
      qty: parseInt(item.qty)
    }));

    const { error } = await supabase.rpc('distribute_uniforms', {
      p_employee_id: employeeId,
      p_delivery_date: deliveryDate,
      p_items: p_items
    });

    if (!error) {
      setEmployeeId('');
      setDeliveryDate('');
      setDeliveryItems([]);
      setShowForm(false);
      fetchData();
    } else {
      alert("Erro ao salvar entrega: " + error.message);
    }
  };

  const handleDeleteDelivery = async (id) => {
    if(window.confirm('Excluir este registro de entrega?')) {
      await supabase.from('uniforms').delete().eq('id', id);
      fetchData();
    }
  };

  return (
    <div className="glass-panel p-4 fade-in">
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <h2>Gestão de Uniformes</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem' }}>
        <button 
          onClick={() => { setActiveTab('historico'); setShowForm(false); }}
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none',
            borderBottom: activeTab === 'historico' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'historico' ? 'var(--color-text)' : 'var(--color-text-muted)',
            fontWeight: activeTab === 'historico' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Users size={18} /> Histórico de Entregas
        </button>
        <button 
          onClick={() => setActiveTab('estoque')}
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none',
            borderBottom: activeTab === 'estoque' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'estoque' ? 'var(--color-text)' : 'var(--color-text-muted)',
            fontWeight: activeTab === 'estoque' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Package size={18} /> Controle de Estoque
        </button>
      </div>

      {/* TAB: HISTÓRICO */}
      {activeTab === 'historico' && (
        <>
          <div className="flex-between mb-4">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '500' }}>Entregas Realizadas</h3>
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancelar' : 'Registrar Entrega'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmitDelivery} className="mt-4 p-4" style={{ backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
              <div className="grid-cols-2" style={{ marginBottom: '1rem', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Colaborador *</label>
                  <select 
                    value={employeeId} 
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                  >
                    <option value="">Selecione...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Data da Entrega *</label>
                  <input 
                    type="date" 
                    value={deliveryDate} 
                    onChange={(e) => setDeliveryDate(e.target.value)} 
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Itens a Entregar</label>
                {deliveryItems.length === 0 && (
                  <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Nenhum item adicionado.</p>
                )}
                {deliveryItems.map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <select 
                      value={item.inventory_id} 
                      onChange={(e) => handleDeliveryItemChange(index, 'inventory_id', e.target.value)}
                      required
                      style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                    >
                      <option value="">Selecione a peça...</option>
                      {inventory.map(inv => (
                        <option key={inv.id} value={inv.id} disabled={inv.quantity === 0}>
                          {inv.piece_type} (Tam: {inv.size}) - Estoque: {inv.quantity}
                        </option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      min="1"
                      value={item.qty} 
                      onChange={(e) => handleDeliveryItemChange(index, 'qty', e.target.value)}
                      required
                      style={{ width: '100px', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                    />
                    <button 
                      type="button"
                      onClick={() => handleRemoveDeliveryItem(index)}
                      style={{ color: '#ef4444', padding: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button 
                  type="button" 
                  onClick={handleAddDeliveryItem}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '0.5rem', fontWeight: '500' }}
                >
                  <Plus size={16} /> Adicionar Item
                </button>
              </div>

              <button type="submit" className="btn-primary">Salvar Registro</button>
            </form>
          )}

          <div className="mt-4">
            {loading ? (
              <p className="text-muted">Carregando...</p>
            ) : uniforms.length === 0 ? (
              <p className="text-muted">Nenhum registro de uniforme no momento.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '0.75rem 0' }}>Data</th>
                    <th style={{ padding: '0.75rem 0' }}>Colaborador</th>
                    <th style={{ padding: '0.75rem 0' }}>Peças Entregues</th>
                    <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {uniforms.map(uni => {
                    const dateParts = uni.delivery_date ? uni.delivery_date.split('-') : null;
                    const formattedDate = dateParts ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : '-';

                    return (
                      <tr key={uni.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{formattedDate}</td>
                        <td style={{ padding: '0.75rem 0' }}>{uni.employees?.name}</td>
                        <td style={{ padding: '0.75rem 0', color: 'var(--color-text-muted)' }}>{uni.items || '-'}</td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleDeleteDelivery(uni.id)}
                            style={{ color: '#ef4444', padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* TAB: ESTOQUE */}
      {activeTab === 'estoque' && (
        <>
          <div style={{ backgroundColor: 'var(--color-bg)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: '600' }}>Registrar Novo Lote</h3>
            <form onSubmit={handleAddInventory} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 200px' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Peça (Ex: Camiseta Polo)</label>
                <input 
                  type="text" 
                  value={newPieceType} 
                  onChange={(e) => setNewPieceType(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Tamanho</label>
                <select 
                  value={newPieceSize} 
                  onChange={(e) => setNewPieceSize(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                >
                  <option value="">Sel...</option>
                  <option value="PP">PP</option>
                  <option value="P">P</option>
                  <option value="M">M</option>
                  <option value="G">G</option>
                  <option value="GG">GG</option>
                  <option value="EXG">EXG</option>
                  <option value="Único">Único</option>
                </select>
              </div>
              <div style={{ flex: '1 1 80px' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>Qtd</label>
                <input 
                  type="number" 
                  min="0"
                  value={newPieceQuantity} 
                  onChange={(e) => setNewPieceQuantity(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: '0.5rem 1.5rem', height: '38px' }}>Adicionar</button>
            </form>
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-muted">Carregando estoque...</p>
            ) : inventory.length === 0 ? (
              <p className="text-muted">Estoque vazio.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: '0.75rem 0' }}>Peça</th>
                    <th style={{ padding: '0.75rem 0' }}>Tamanho</th>
                    <th style={{ padding: '0.75rem 0', textAlign: 'center' }}>Quantidade</th>
                    <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.piece_type}</td>
                      <td style={{ padding: '0.75rem 0' }}>{item.size}</td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                          <button 
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                            disabled={item.quantity <= 0}
                            style={{ 
                              padding: '0.25rem', 
                              borderRadius: '4px', 
                              border: '1px solid var(--color-border)', 
                              background: 'var(--color-bg)', 
                              cursor: item.quantity <= 0 ? 'not-allowed' : 'pointer',
                              color: item.quantity <= 0 ? 'var(--color-text-muted)' : 'inherit'
                            }}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ fontWeight: '600', minWidth: '28px', textAlign: 'center' }}>{item.quantity}</span>
                          <button 
                            onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                            style={{ 
                              padding: '0.25rem', 
                              borderRadius: '4px', 
                              border: '1px solid var(--color-border)', 
                              background: 'var(--color-bg)', 
                              cursor: 'pointer' 
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDeleteInventory(item.id)}
                          style={{ color: '#ef4444', padding: '0.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
                          title="Excluir do Estoque"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

    </div>
  );
};

export default Uniformes;
