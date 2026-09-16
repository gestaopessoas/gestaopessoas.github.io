// Foto de celular chega com 3 a 12 MB e 4000 px de largura. O RH abre essa foto numa tela,
// nunca imprime em banner — guardar o original é pagar armazenamento por pixel que ninguém vê.
// Redimensionar e recomprimir no navegador, antes do upload, corta tipicamente 90% do peso.

export const MAX_DIMENSION = 1600;
export const JPEG_QUALITY = 0.82;
export const WEBP_QUALITY = 0.8;

// Cabe a imagem dentro de um quadrado de `max` sem distorcer. Imagem menor que o teto
// passa intacta: ampliar só inventaria pixel e aumentaria o arquivo.
export function fitDimensions(width, height, max = MAX_DIMENSION) {
  const maior = Math.max(width, height);
  if (maior <= max) return { width, height };
  const fator = max / maior;
  return { width: Math.round(width * fator), height: Math.round(height * fator) };
}

// Escolhe a menor versão, com o original servindo de piso: foto já pequena e bem comprimida
// pode sair MAIOR depois do reencode, e aí a melhor versão que existe é a que chegou.
export function chooseSmallest(candidatos, original) {
  return candidatos
    .filter(Boolean)
    .reduce((menor, atual) => (atual.blob.size < menor.blob.size ? atual : menor), original);
}

// `toBlob` não promete atender o tipo pedido: navegador sem encoder de WebP cai para PNG em
// silêncio (Safari antes do 16.4). PNG de foto é enorme, então o tipo que vale é o do blob
// que voltou, nunca o que foi pedido.
async function encode(canvas, contentType, quality) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, contentType, quality));
  return blob ? { blob, contentType: blob.type || contentType } : null;
}

/**
 * Devolve `{ blob, contentType }` pronto para o upload.
 *
 * ponytail: se o navegador não souber decodificar o arquivo, devolve o original em vez de
 * falhar. O caso real é HEIC do iPhone, que só o Safari decodifica — recusar a foto seria
 * pior que guardá-la grande. Se isso virar volume, o passo seguinte é heic2any sob demanda.
 */
export async function compressImage(file, { maxDimension = MAX_DIMENSION } = {}) {
  const original = { blob: file, contentType: file.type || "image/jpeg" };
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitDimensions(bitmap.width, bitmap.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // WebP costuma sair ~30% menor que JPEG na mesma qualidade percebida. Gerar os dois e
    // ficar com o menor é uma passada de CPU a mais numa foto só, e resolve de uma vez o
    // navegador sem WebP e o caso raro em que o JPEG ganha.
    const candidatos = await Promise.all([
      encode(canvas, "image/webp", WEBP_QUALITY),
      encode(canvas, "image/jpeg", JPEG_QUALITY),
    ]);
    return chooseSmallest(candidatos, original);
  } catch {
    return original;
  }
}
