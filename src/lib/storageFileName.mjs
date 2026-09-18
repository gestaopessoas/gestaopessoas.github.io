// Nome de arquivo no Storage. Regra única do sistema: o nome que veio do aparelho do usuário
// nunca entra no caminho do bucket. A parte variável sai sempre de dado do sistema — tipo do
// documento, competência, propósito da foto, nome do parceiro.
//
// Padrão: {o_que_e}_{identificador}_{dd}_{mm}_{aaaa}.{ext}
//   foto_perfil_17_09_2026.webp · rg_cnh_17_09_2026.pdf · holerite_09_2026.pdf · logo_unimed.webp

// Tira acento, caixa alta e qualquer caractere que não sobrevive bem a uma URL.
// Mantém `_` e `-` porque são os separadores do próprio padrão.
function safePart(part) {
  return String(part ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Slug com hífen, para nome livre digitado pelo RH (nome de parceiro, tipo de documento).
export function slug(text) {
  return safePart(String(text ?? "").replace(/_/g, "-"));
}

// dd_mm_aaaa da data informada. Sem argumento, a data de hoje.
export function dateParts(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}_${pad(date.getMonth() + 1)}_${date.getFullYear()}`;
}

// mm_aaaa — para competência (holerite), que não tem dia.
export function monthParts(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}_${date.getFullYear()}`;
}

// A extensão sai do contentType que vai ser gravado, não do arquivo de entrada: WebP salvo
// como .jpg confunde quem baixa o arquivo depois.
export function extFromContentType(contentType, fallback = "bin") {
  const sub = String(contentType || "").split("/")[1]?.split(";")[0];
  if (!sub) return fallback;
  return sub.replace("jpeg", "jpg").replace("svg+xml", "svg").replace(/[^a-z0-9]/gi, "") || fallback;
}

// Junta as partes com `_`. `attempt` maior que 1 vira sufixo — segundo envio do mesmo tipo no
// mesmo dia não sobrescreve o primeiro.
export function storageFileName(parts, ext, attempt = 1) {
  const base = parts.filter(Boolean).map(safePart).join("_");
  return attempt > 1 ? `${base}_${attempt}.${ext}` : `${base}.${ext}`;
}

// Extensão de um arquivo escolhido pelo usuário e enviado sem reprocessar (PDF, .doc).
// Vale o contentType; sem ele, o sufixo do nome original — só o sufixo, nunca o nome inteiro.
export function extForFile(file, fallback = "bin") {
  const doNome = String(file?.name || "").split(".").pop();
  return extFromContentType(file?.type, /^[a-z0-9]{1,5}$/i.test(doNome || "") ? doNome.toLowerCase() : fallback);
}

// Nome da foto de colaborador: foto_perfil_17_09_2026.webp
export function photoFileName(purpose, contentType, date = new Date(), attempt = 1) {
  return storageFileName(["foto", purpose, dateParts(date)], extFromContentType(contentType, "jpg"), attempt);
}

// O Storage recusa gravar por cima quando `upsert` é falso; é assim que a colisão aparece.
export function isDuplicateError(error) {
  const text = `${error?.message ?? ""} ${error?.error ?? ""}`.toLowerCase();
  return String(error?.statusCode) === "409" || text.includes("already exists") || text.includes("duplicate");
}

// Sobe sem upsert e, se o nome já existir, tenta o sufixo seguinte.
// Não consulta o bucket antes: entre um `list()` e o `upload()` cabe outro envio, e aí os dois
// escolheriam o mesmo nome. Deixar o próprio Storage recusar é o que realmente serializa.
// `bucket` é o retorno de `supabase.storage.from(...)`.
export async function uploadUnique(bucket, dir, parts, ext, body, options = {}, maxAttempts = 20) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const path = `${dir ? `${dir}/` : ""}${storageFileName(parts, ext, attempt)}`;
    const { error } = await bucket.upload(path, body, { ...options, upsert: false });
    if (!error) return { path, error: null };
    if (!isDuplicateError(error)) return { path: null, error };
  }
  return { path: null, error: { message: "Já existem arquivos demais com este nome. Tente novamente amanhã." } };
}
