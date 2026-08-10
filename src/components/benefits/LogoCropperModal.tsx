"use client";

import React, { useState, useRef } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Upload, Check, Loader2, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface LogoCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCropped: (url: string) => void;
  initialImageUrl?: string;
}

// Inicializa o crop centralizado com proporção 1:1
function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export const LogoCropperModal: React.FC<LogoCropperModalProps> = ({ isOpen, onClose, onCropped, initialImageUrl }) => {
  const [imgSrc, setImgSrc] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  if (!isOpen) return null;

  const handleLoadFromUrl = async () => {
    if (!initialImageUrl) return;
    setErrorMsg(null);
    try {
      const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(initialImageUrl)}`;
      const res = await fetch(proxiedUrl);
      if (!res.ok) throw new Error("Failed to load image");
      const blob = await res.blob();
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImgSrc(reader.result?.toString() || "");
      });
      reader.readAsDataURL(blob);
    } catch (err) {
      setErrorMsg("Erro ao carregar a imagem do link. Talvez o link não permita acesso ou esteja quebrado.");
    }
  };

  // Lida com o upload do arquivo
  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // reseta crop state
      setErrorMsg(null);
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImgSrc(reader.result?.toString() || "");
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };

  // Extrai o Blob recortado usando o Canvas
  const getCroppedImg = async (image: HTMLImageElement, crop: Crop): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Tamanho alvo fixo p/ boa qualidade e padronização (ex: 400x400)
    const targetSize = 400; 
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("No 2d context");

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = targetSize * pixelRatio;
    canvas.height = targetSize * pixelRatio;
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = "high";

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropWidth = crop.width * scaleX;
    const cropHeight = crop.height * scaleY;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      targetSize,
      targetSize
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          resolve(blob);
        },
        "image/webp",
        0.9 // Qualidade do WebP
      );
    });
  };

  const handleConfirm = async () => {
    if (!imgRef.current || !crop || crop.width === 0 || crop.height === 0) {
      setErrorMsg("Selecione uma área para recortar a imagem.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      // 1. Extrai o Blob
      const croppedBlob = await getCroppedImg(imgRef.current, crop);

      // 2. Faz o Upload pro Supabase
      const fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;
      
      const { data, error } = await supabase.storage
        .from("partner_logos")
        .upload(fileName, croppedBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/webp"
        });

      if (error) {
        throw error;
      }

      // 3. Pega a URL pública
      const { data: publicData } = supabase.storage
        .from("partner_logos")
        .getPublicUrl(data.path);

      // 4. Retorna pro Form principal
      onCropped(publicData.publicUrl);
      
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao fazer upload da imagem. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setImgSrc("");
    setCrop(undefined);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 animate-in zoom-in-95 flex flex-col max-h-[90vh]"
      >
        <div className="relative flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Ajustar Logo do Parceiro
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!imgSrc ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center bg-zinc-50 dark:bg-zinc-900/50">
              <Upload className="h-10 w-10 text-zinc-400 mb-3" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Faça upload de uma imagem
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Formatos recomendados: JPG, PNG, WEBP (Quadrado)
              </p>
              <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                <label className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
                  Selecionar do Computador
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onSelectFile}
                    className="hidden"
                  />
                </label>
                
                {initialImageUrl && (
                  <>
                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-zinc-300 dark:border-zinc-700"></div>
                      <span className="flex-shrink-0 mx-4 text-zinc-400 text-xs font-medium">OU</span>
                      <div className="flex-grow border-t border-zinc-300 dark:border-zinc-700"></div>
                    </div>
                    
                    <button
                      onClick={handleLoadFromUrl}
                      className="rounded-lg bg-zinc-200 dark:bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Usar a URL preenchida
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-300 text-center">
                Arraste a linha pontilhada para recortar a parte principal da logo.
              </p>
              <div className="flex justify-center bg-black/5 dark:bg-white/5 rounded-xl overflow-hidden p-2">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  aspect={1} // Trava proporção em 1:1 (quadrado)
                  circularCrop={false}
                  className="max-h-[50vh]"
                >
                  <img
                    ref={imgRef}
                    alt="Upload"
                    src={imgSrc}
                    onLoad={onImageLoad}
                    className="max-h-[50vh] w-auto mx-auto object-contain"
                  />
                </ReactCrop>
              </div>
              <div className="flex justify-center">
                <label className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Trocar Imagem
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onSelectFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {errorMsg && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-4 text-center">{errorMsg}</p>
          )}
        </div>

        {imgSrc && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shrink-0">
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
              type="button"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isUploading || !crop}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Confirmar Recorte</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
