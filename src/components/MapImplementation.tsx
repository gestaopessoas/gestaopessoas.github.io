'use client';

import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import empreendimentos from '@/data/empreendimentos.json';
import type { MapPoint } from '@/app/dashboard/mapa/people';

// Conserto padrão para ícones do Leaflet no Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Função para criar o ícone com a logo flutuante
const createLogoIcon = (logoUrl: string | null, customBgColor?: string) => {
  const bgColor = customBgColor || '#efe9e1'; // Bege/Areia elegante como fallback
  const content = logoUrl 
    ? `<img src="${logoUrl}" style="width: 48px !important; height: 34px !important; object-fit: contain; display: block; margin: 0; padding: 0;" />`
    : `<div style="width: 48px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; color: #4b5563;">ACPO</div>`;

  return L.divIcon({
    className: 'custom-logo-marker bg-transparent border-0',
    html: `
      <div style="
        background-color: ${bgColor}; 
        border-radius: 8px; 
        padding: 4px; 
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
        width: 56px;
        height: 42px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        ${content}
        <div style="
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 5px solid ${bgColor};
        "></div>
      </div>
    `,
    iconSize: [56, 42],
    iconAnchor: [28, 47], // Ancorado na ponta do triângulo
    popupAnchor: [0, -47] // O popup abre acima da logo
  });
};

// Função de cor do status
const getStatusColor = (status: string) => {
  const s = status.toUpperCase();
  if (s.includes('ENTREGUE')) return 'bg-[#61b846]'; // Verde ACPO
  if (s.includes('CONSTRU')) return 'bg-[#29548f]'; // Azul ACPO
  if (s.includes('LANÇAMENTO') || s.includes('LANCAMENTO')) return 'bg-[#ed8121]'; // Laranja
  return 'bg-gray-600';
};

// Mapa de cores das obras pelo nome do banco
// Retorna uma string CSS de background (permite cores sólidas ou gradientes)
const getWorkplaceBackground = (workplaceName?: string | null) => {
  if (!workplaceName) return '#9ca3af'; // cinza se não tiver
  const wpUpper = workplaceName.toUpperCase();
  
  if (wpUpper.includes('SEDE')) return '#facc15'; // Amarelo Sede
  // Joy II (metade roxo, metade amarelo)
  if (wpUpper.includes('JOY II') || wpUpper.includes('JOY 2')) {
    return 'linear-gradient(135deg, #7c3aed 50%, #facc15 50%)'; 
  }
  // Joy I (metade vermelho, metade amarelo)
  if (wpUpper.includes('JOY')) {
    return 'linear-gradient(135deg, #ef4444 50%, #facc15 50%)'; 
  }
  
  // Cores da MARCA (Logo) para os demais
  if (wpUpper.includes('MOOV')) return '#ed8121'; // Laranja Moov
  if (wpUpper.includes('CONNECT')) return '#4c1d95'; // Roxo Connect
  if (wpUpper.includes('LIFE') || wpUpper.includes('SIMÕES')) return '#61b846'; // Verde Life
  if (wpUpper.includes('RESERVA')) return '#0369a1'; // Azul Escuro Reserva
  if (wpUpper.includes('SOLANAS')) return '#06b6d4'; // Azul Claro Solanas
  if (wpUpper.includes('RIVIERA')) return '#059669'; // Verde Riviera
  if (wpUpper.includes('DIRECT')) return '#ea580c'; // Laranja Escuro
  
  // Fallback para cor do background se não cair em nenhuma regra
  const match = empreendimentos.find(e => {
    const eUpper = e.name.toUpperCase();
    return eUpper.includes(wpUpper) || wpUpper.includes(eUpper);
  });
  if (match && match.logo_bg_color) return match.logo_bg_color;
  
  return '#3b82f6'; // Azul genérico
};

const createEmployeeDot = (bgString: string) => {
  return L.divIcon({
    className: 'bg-transparent border-0',
    html: `<div style="background: ${bgString}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
};

export default function MapImplementation({ activeFilters = [], colaboradores: rawColaboradores = [], candidatos: rawCandidatos = [] }: { activeFilters?: string[]; colaboradores?: MapPoint[]; candidatos?: MapPoint[] }) {
  
  // Filtrar empreendimentos
  const filteredData = empreendimentos.filter(emp => {
    return activeFilters.includes(emp.status.toUpperCase());
  });

  // Descobrir quais filtros de colab estão ativos (ex: 'colab:MOOV')
  const activeColabFilters = activeFilters.filter(f => f.startsWith('colab:'));
  
  // Filtrar colaboradores
  const colaboradores = rawColaboradores.filter(c => {
    if (activeFilters.includes('colab:ALL')) return true;
    if (activeColabFilters.length === 0) return false;
    
    const wpUpper = (c.workplace_name || '').toUpperCase();
    // Exata comparação para não confundir JOY com JOY II e MOOV com MOOV II
    return activeColabFilters.some(filter => {
      const keyword = filter.replace('colab:', '');
      return wpUpper === keyword;
    });
  });

  const candidatos = activeFilters.includes('candidatos') ? rawCandidatos : [];

  return (
    <>
      <style>{`
        .acpo-popup .leaflet-popup-content-wrapper {
          padding: 0;
          overflow: hidden;
          border-radius: 8px;
        }
        .acpo-popup .leaflet-popup-content {
          margin: 0;
          width: 220px !important;
        }
      `}</style>
      <MapContainer 
        center={[-31.7654, -52.3376]} 
        zoom={12} 
        minZoom={10}
        maxZoom={16}
        maxBounds={[
          [-32.40, -52.80], // Limite Sudoeste
          [-31.40, -51.90]  // Limite Nordeste
        ]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%', backgroundColor: '#0f172a' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        />
      {filteredData.map((emp) => (
        <Marker 
          key={emp.id} 
          position={[emp.coordinates.lat, emp.coordinates.lng]}
          icon={createLogoIcon(emp.logo_url || null, emp.logo_bg_color)}
        >
          <Popup className="acpo-popup">
            <div className="flex flex-col max-w-[220px] overflow-hidden rounded-md bg-white">
              {/* Container da Imagem com Status Sobreposto */}
              {emp.image_url ? (
                <div className="relative w-full h-28">
                  <img src={emp.image_url} alt={emp.name} className="w-full h-full object-cover rounded-t-md" />
                  <div className={`absolute top-2 left-2 ${getStatusColor(emp.status)} text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm`}>
                    {emp.status}
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-8 bg-gray-100 rounded-t-md">
                  <div className={`absolute top-2 left-2 ${getStatusColor(emp.status)} text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm`}>
                    {emp.status}
                  </div>
                </div>
              )}
              
              {/* Corpo de Texto */}
              <div className="flex flex-col gap-1 p-3">
                <p className="text-[10px] text-gray-500 m-0 leading-none">{emp.short_address}</p>
                <h3 className="font-bold text-sm text-[#2a3f54] m-0 leading-tight mt-1">{emp.name}</h3>
                
                {emp.link && (
                  <a href={emp.link} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-2 inline-block">
                    Ver detalhes do projeto
                  </a>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      
      {/* Pinos dos Colaboradores (Bolinhas Coloridas) */}
      {colaboradores.map((colab) => {
        const bgString = getWorkplaceBackground(colab.workplace_name);
        return (
          <Marker
            key={'colab-'+colab.id}
            position={[colab.lat, colab.lng]}
            icon={createEmployeeDot(bgString)}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div className="flex flex-col items-center">
                <span className="font-bold text-xs">{colab.name}</span>
                <span className="text-[10px] text-gray-500 font-semibold">{colab.workplace_name}</span>
                <span className="text-[9px] text-gray-400">🏢 Colaborador</span>
              </div>
            </Tooltip>
          </Marker>
        );
      })}

      {/* Pinos dos Candidatos (Bolinhas Menores e Neutras) */}
      {candidatos.map((cand) => (
        <CircleMarker
          key={'cand-'+cand.id}
          center={[cand.lat, cand.lng]}
          radius={4}
          pathOptions={{ 
            color: '#ef4444', // Borda vermelha
            weight: 1,
            fillColor: '#fee2e2', // Fundo vermelhinho claro
            fillOpacity: 0.8 
          }}
        >
          <Tooltip direction="top" offset={[0, -10]} opacity={1}>
            <div className="flex flex-col items-center">
              <span className="font-bold text-xs">{cand.name}</span>
              <span className="text-[9px] text-gray-500">{cand.city}</span>
              <span className="text-[9px] text-red-500 font-bold">🎯 Candidato</span>
            </div>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
    </>
  );
}
