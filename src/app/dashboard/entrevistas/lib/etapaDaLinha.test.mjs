import test from "node:test";
import assert from "node:assert/strict";
import { etapaDaLinha, historicoPorCandidato } from "./etapaDaLinha.mjs";

// Caso real que originou a correção: candidato que percorreu o funil inteiro até Contratado.
// O histórico é gravado ~1s antes da entrevista correspondente.
const ETAPAS = [
  { candidate_id: "c1", stage: "Contratado", created_at: "2026-09-16T19:25:41Z" },
  { candidate_id: "c1", stage: "Entrevista Gestor", created_at: "2026-09-16T19:16:46Z" },
  { candidate_id: "c1", stage: "Entrevista RH", created_at: "2026-09-16T19:15:53Z" },
  { candidate_id: "c1", stage: "Triagem", created_at: "2026-09-16T19:14:45Z" },
];

const mapa = historicoPorCandidato(ETAPAS);

test("cada entrevista mostra a Etapa do seu momento, não a de hoje", () => {
  const primeira = { candidate_id: "c1", created_at: "2026-09-16T19:14:46Z" };
  const segunda = { candidate_id: "c1", created_at: "2026-09-16T19:15:54Z" };
  const terceira = { candidate_id: "c1", created_at: "2026-09-16T19:16:47Z" };

  assert.equal(etapaDaLinha(primeira, mapa), "Triagem");
  assert.equal(etapaDaLinha(segunda, mapa), "Entrevista RH");
  assert.equal(etapaDaLinha(terceira, mapa), "Entrevista Gestor");
});

test("entrevista posterior ao último avanço mostra a Etapa atual", () => {
  const depois = { candidate_id: "c1", created_at: "2026-09-17T08:00:00Z" };
  assert.equal(etapaDaLinha(depois, mapa), "Contratado");
});

test("entrevista anterior a todo o histórico cai no Destino gravado na época", () => {
  const antiga = { candidate_id: "c1", created_at: "2026-08-01T10:00:00Z", destination: "Descartado" };
  assert.equal(etapaDaLinha(antiga, mapa), "Descartado");
});

test("sem Destino e sem Etapa no momento, sobra a Etapa mais antiga conhecida", () => {
  const antiga = { candidate_id: "c1", created_at: "2026-08-01T10:00:00Z" };
  assert.equal(etapaDaLinha(antiga, mapa), "Triagem");
});

test("candidato sem histórico não inventa Etapa", () => {
  assert.equal(etapaDaLinha({ candidate_id: "c9", created_at: "2026-09-16T19:14:46Z" }, mapa), null);
  assert.equal(etapaDaLinha({ created_at: "2026-09-16T19:14:46Z" }, mapa), null);
});
