'use client';

import dynamic from 'next/dynamic';
import type { MapPoint } from '@/app/dashboard/mapa/people';

const MapImplementation = dynamic(() => import('./MapImplementation'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-lg border border-dashed">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-gray-500">Carregando mapa interativo...</span>
      </div>
    </div>
  )
});

export default function Map({ activeFilters = ['ENTREGUE', 'EM CONSTRUÇÃO', 'LANÇAMENTO', 'SEDE'], colaboradores = [], candidatos = [] }: { activeFilters?: string[]; colaboradores?: MapPoint[]; candidatos?: MapPoint[] }) {
  return <MapImplementation activeFilters={activeFilters} colaboradores={colaboradores} candidatos={candidatos} />;
}
