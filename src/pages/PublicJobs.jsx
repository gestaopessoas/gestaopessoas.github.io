import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Search, MapPin, Briefcase, ChevronRight, Building, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const PublicJobs = () => {
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('job_openings')
      .select('*, job_profiles(title, profile_code), departments(name)')
      .eq('status', 'Aberta')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOpenings(data);
      const depts = [...new Set(data.map(item => item.departments?.name).filter(Boolean))];
      setDepartments(depts);
    }
    setLoading(false);
  };

  const filtered = openings.filter(o => {
    const titleMatch = !search || o.job_profiles?.title?.toLowerCase().includes(search.toLowerCase());
    const deptMatch = !selectedDept || o.departments?.name === selectedDept;
    return titleMatch && deptMatch;
  });

  return (
    <main style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      {/* Hero Section */}
      <section style={{ background: 'linear-gradient(135deg, var(--color-primary), #d97706)', padding: '4rem 1rem', textAlign: 'center', color: '#fff' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <img src="/images/logo.png" alt="Logo" style={{ height: '60px', marginBottom: '2rem', filter: 'brightness(0) invert(1)' }} />
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.03em' }}>
            Faça parte do nosso time
          </h1>
          <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
            Buscamos talentos apaixonados por desafios e inovação. Confira nossas vagas abertas e venha crescer com a gente!
          </p>
          
          {/* Busca */}
          <div style={{ display: 'flex', gap: '0.5rem', background: '#fff', padding: '0.5rem', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={20} color="#6b7280" style={{ position: 'absolute', left: '1rem' }} />
              <input 
                type="text" 
                placeholder="Qual cargo você procura?" 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', border: 'none', background: 'transparent', fontSize: '1rem', color: '#1f2937', outline: 'none' }}
              />
            </div>
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value)}
              style={{ border: 'none', borderLeft: '1px solid #e5e7eb', padding: '0 1rem', background: 'transparent', fontSize: '0.95rem', color: '#4b5563', outline: 'none', cursor: 'pointer' }}>
              <option value="">Todos os setores</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Vagas List */}
      <section style={{ maxWidth: '900px', margin: '-2rem auto 4rem', padding: '0 1rem', position: 'relative', zIndex: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--color-surface)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p style={{ color: 'var(--color-text-muted)' }}>Buscando oportunidades...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--color-surface)', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
            <Briefcase size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3 style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>Nenhuma vaga encontrada</h3>
            <p style={{ color: 'var(--color-text-muted)' }}>Tente ajustar os filtros ou volte novamente mais tarde.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filtered.map(job => (
              <Link to={`/carreiras/${job.id}/candidatar`} key={job.id} style={{ textDecoration: 'none' }}>
                <div style={{ 
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', 
                  padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: 'all 0.2s', cursor: 'pointer'
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                >
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem', color: 'var(--color-text)', fontSize: '1.25rem', fontWeight: 700 }}>
                      {job.job_profiles?.title || 'Vaga'}
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Building size={16} /> {job.departments?.name || 'Geral'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MapPin size={16} /> {job.unit || 'A combinar'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Clock size={16} /> {job.contract_type}</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(245,174,56,0.1)', color: 'var(--color-primary)', padding: '0.75rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={24} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default PublicJobs;
