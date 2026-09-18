"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { cropStyle } from "@/lib/photoCrop.mjs";

// Componente único de avatar do colaborador. Recebe o CAMINHO no bucket (não a URL: o bucket
// é privado e a URL assinada expira) e resolve a URL na hora. Sem foto, cai nas iniciais.

const BUCKET = "employee-photos";
const TTL = 3600; // 1 h — o avatar fica na tela bem menos que isso.

// Uma assinatura por caminho, reaproveitada enquanto vale. A listagem de colaboradores põe
// dezenas de avatares na tela de uma vez; sem isto seria uma ida ao servidor por linha.
const cache = new Map<string, { url: string; expira: number }>();

// Os pedidos que caem no mesmo tick viram UMA chamada createSignedUrls. É o que transforma
// "uma requisição por linha da lista" em "uma requisição por página".
let fila: { path: string; ok: (url: string | null) => void }[] = [];
let agendado = false;

// Exportada porque a tela de reenquadrar precisa da MESMA foto que o avatar mostra.
export function signedPhotoUrl(path: string): Promise<string | null> {
  const emCache = cache.get(path);
  if (emCache && emCache.expira > Date.now()) return Promise.resolve(emCache.url);

  return new Promise((ok) => {
    fila.push({ path, ok });
    if (agendado) return;
    agendado = true;
    queueMicrotask(async () => {
      const lote = fila;
      fila = [];
      agendado = false;
      const caminhos = [...new Set(lote.map((p) => p.path))];
      const { data } = await createClient().storage.from(BUCKET).createSignedUrls(caminhos, TTL);
      const porCaminho = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
      const validade = Date.now() + (TTL - 60) * 1000;
      for (const pedido of lote) {
        const url = porCaminho.get(pedido.path) ?? null;
        if (url) cache.set(pedido.path, { url, expira: validade });
        pedido.ok(url);
      }
    });
  });
}

export function iniciais(nome?: string | null) {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function EmployeeAvatar({
  name,
  photoPath,
  photoCrop,
  className = "h-10 w-10",
  textClassName = "text-xs",
}: {
  name?: string | null;
  photoPath?: string | null;
  photoCrop?: unknown;
  className?: string;
  textClassName?: string;
}) {
  // Guardado junto com o caminho que originou: trocar de colaborador troca `photoPath`, e o
  // estado antigo deixa de valer sozinho, sem precisar de um setState de limpeza no efeito.
  const [resolvido, setResolvido] = useState<{ path: string; url: string | null } | null>(null);
  const [falhou, setFalhou] = useState<string | null>(null);
  const url = resolvido && resolvido.path === photoPath ? resolvido.url : null;

  useEffect(() => {
    if (!photoPath) return;
    let vivo = true;
    signedPhotoUrl(photoPath).then((assinada) => {
      if (vivo) setResolvido({ path: photoPath, url: assinada });
    });
    return () => {
      vivo = false;
    };
  }, [photoPath]);

  const base = `relative shrink-0 overflow-hidden rounded-full bg-muted ${className}`;

  // Sem foto, foto apagada do bucket ou assinatura recusada: as iniciais. É o estado normal
  // de quem ainda não enviou nada, não um erro para mostrar na tela.
  if (!photoPath || !url || falhou === photoPath) {
    return (
      <span
        className={`${base} grid place-items-center font-semibold text-muted-foreground ${textClassName}`}
        title={name ?? undefined}
      >
        {iniciais(name)}
      </span>
    );
  }

  return (
    <span className={base} title={name ?? undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária: o
          otimizador de imagem do Next não consegue trabalhar com ela. */}
      <img
        src={url}
        alt={name ? `Foto de ${name}` : "Foto do colaborador"}
        className="absolute max-w-none"
        style={cropStyle(photoCrop) as React.CSSProperties}
        onError={() => setFalhou(photoPath)}
      />
    </span>
  );
}
