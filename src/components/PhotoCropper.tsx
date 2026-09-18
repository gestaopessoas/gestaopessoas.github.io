"use client";

import { useState } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

// Recorte redondo da foto de perfil: máscara circular, arrastar e ajustar o tamanho.
//
// Não sobe nada e não guarda nada — recebe a imagem e devolve as coordenadas em porcentagem.
// Quem salva é a tela. É por isso que este componente serve tanto a /enviar-foto (colaborador
// enquadrando no celular, antes de enviar) quanto à ficha (RH reenquadrando depois).
//
// Não é o LogoCropperModal: aquele carrega imagem de URL externa por um proxy e sobe para o
// bucket dentro do próprio componente. Aqui a imagem vem do disco do usuário ou de uma URL
// assinada que a tela já resolveu.

export type CropPercent = { x: number; y: number; width: number; height: number };

export function PhotoCropper({
  src,
  value,
  onChange,
}: {
  src: string;
  value: CropPercent | null;
  onChange: (crop: CropPercent) => void;
}) {
  // O ReactCrop precisa do formato dele (com `unit`); o resto do sistema só quer os números.
  const [crop, setCrop] = useState<Crop | undefined>(value ? { unit: "%", ...value } : undefined);

  const onImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (crop) return; // reenquadrando: respeita o recorte que já estava salvo
    const { width, height } = event.currentTarget;
    const inicial = centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, width, height), width, height);
    setCrop(inicial);
    onChange({ x: inicial.x, y: inicial.y, width: inicial.width, height: inicial.height });
  };

  return (
    <div className="grid place-items-center">
      <ReactCrop
        crop={crop}
        aspect={1}
        circularCrop
        keepSelection
        onChange={(_pixels, percent) => setCrop(percent)}
        // Só avisa a tela quando a pessoa solta: durante o arraste seriam dezenas de avisos
        // por segundo, e nenhum deles é o valor final.
        onComplete={(_pixels, percent) => {
          if (percent.width > 0 && percent.height > 0) {
            onChange({ x: percent.x, y: percent.y, width: percent.width, height: percent.height });
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem local (objectURL) ou
            URL assinada temporária; o otimizador do Next não trabalha com nenhuma das duas. */}
        <img src={src} alt="Foto a enquadrar" onLoad={onImageLoad} className="max-h-[50vh] w-auto" />
      </ReactCrop>
      <p className="mt-3 text-xs text-muted-foreground">Arraste e ajuste o círculo até o rosto ficar centralizado.</p>
    </div>
  );
}
