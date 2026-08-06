import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("carrega o código do perfil antes de editar o colaborador", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const selectedFields = source.match(/const fields = \[([\s\S]*?)\]\.join/)?.[1] ?? "";

  assert.match(selectedFields, /"profile_code"/);
});

test("carrega o tipo da unidade para sugerir a jornada", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(source, /from\("workplaces"\)\.select\("id, name, type"\)/);
});

test("não duplica a data do ASO em Documentos e arquivo", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const documentsSection = source.match(/<Section title="Documentos e arquivo">([\s\S]*?)<\/Section>/)?.[1] ?? "";

  assert.doesNotMatch(documentsSection, /Data do ASO/);
});

test("campo RG usa sanitização numérica de até 15 dígitos", async () => {
  const source = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  const rgField = source.match(/<Field label="RG">([\s\S]*?)<\/Field>/)?.[1] ?? "";

  assert.match(rgField, /sanitizeRgInput/);
  assert.match(rgField, /maxLength=\{15\}/);
  assert.doesNotMatch(source, /const maskRg/);
});
