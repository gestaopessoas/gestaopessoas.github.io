import type { Address } from "./people";

// Texto legível enviado ao Nominatim. Partes vazias ficam de fora; endereço com menos de
// 5 caracteres não é localizável e a pessoa não entra no mapa.
export function addressQuery(p: Address): string | null {
  const street = [p.address, p.address_number].filter((v) => v?.trim()).join(" ");
  if (street.trim().length < 5) return null;
  return [street, p.city, p.state, "Brasil"].filter((v) => v?.trim()).join(", ").replace(/\s+/g, " ").trim();
}

// Chave do cache `geocodes`: o mesmo texto, em maiúsculas.
export const addressKey = (query: string) => query.toUpperCase();

export const NOMINATIM_INTERVAL_MS = 1100;

// Retorna [lat, lng], null (Nominatim não achou) ou undefined (erro de rede: não grava).
export async function geocodeNominatim(query: string, signal: AbortSignal): Promise<[number, number] | null | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return undefined;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    return hit ? [Number(hit.lat), Number(hit.lon)] : null;
  } catch {
    return undefined;
  }
}
