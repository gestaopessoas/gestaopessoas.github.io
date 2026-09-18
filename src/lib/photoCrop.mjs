// Recorte da foto de perfil guardado como coordenadas, não como segundo arquivo.
// {x, y, width, height} em PORCENTAGEM da imagem original — a mesma unidade que o
// react-image-crop devolve com `unit: "%"`.
//
// A ideia do estilo: a região recortada tem que preencher o quadro inteiro. Se ela ocupa
// `width`% da imagem, a imagem precisa ser ampliada 100/width vezes dentro do quadro, e
// deslocada para que o canto (x, y) do recorte caia no canto do quadro.

// Recorte válido é o que tem largura e altura positivas. Vindo do banco, `photo_crop` pode
// ser nulo (toda foto enviada até hoje), objeto pela metade ou até string de JSON.
export function parseCrop(raw) {
  const crop = typeof raw === "string" ? safeParse(raw) : raw;
  if (!crop) return null;
  const { x, y, width, height } = crop;
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  if (num(width) === null || num(height) === null || width <= 0 || height <= 0) return null;
  return { x: num(x) ?? 0, y: num(y) ?? 0, width, height };
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Estilo da <img> dentro do quadro redondo. Sem recorte, a foto só preenche o quadro pelo
// centro — que é o estado de toda foto já enviada, e não pode quebrar a tela.
export function cropStyle(raw) {
  const crop = parseCrop(raw);
  if (!crop) return { width: "100%", height: "100%", left: "0%", top: "0%", objectFit: "cover" };
  const pct = (v) => `${Math.round(v * 100) / 100}%`;
  return {
    width: pct(10000 / crop.width),
    height: pct(10000 / crop.height),
    left: pct((-crop.x * 100) / crop.width),
    top: pct((-crop.y * 100) / crop.height),
    objectFit: "cover",
  };
}
