import test from "node:test";
import assert from "node:assert/strict";
import { asoAtrasado, asoRecebido, grupoDaAdmissao, hojeISO } from "./grupoDaAdmissao.mjs";

const aso = (status) => ({ document_type: "ASO admissional", status });

test("sem data de exame, a Candidatura esta so juntando documento", () => {
  assert.equal(grupoDaAdmissao({ aso_scheduled_at: null, documents: [] }), "Coleta de documentação");
});

test("com data e sem o documento, o exame esta marcado", () => {
  assert.equal(
    grupoDaAdmissao({ aso_scheduled_at: "2026-09-30", documents: [{ document_type: "CPF", status: "entregue" }] }),
    "ASO marcado",
  );
});

test("documento entregue ganha da data, e nao o contrario", () => {
  assert.equal(grupoDaAdmissao({ aso_scheduled_at: "2026-09-30", documents: [aso("entregue")] }), "ASO recebido");
});

test("ASO que chegou sem ninguem ter marcado data ainda assim chegou", () => {
  assert.equal(grupoDaAdmissao({ aso_scheduled_at: null, documents: [aso("entregue")] }), "ASO recebido");
});

test("documento de outro tipo nao conta como ASO", () => {
  assert.equal(asoRecebido([{ document_type: "Foto 3x4", status: "entregue" }]), false);
});

test("linha de ASO sem arquivo entregue nao conta", () => {
  assert.equal(asoRecebido([aso("pendente")]), false);
});

test("lista ausente nao quebra", () => {
  assert.equal(grupoDaAdmissao({}), "Coleta de documentação");
  assert.equal(asoRecebido(null), false);
});

test("exame com data passada e sem documento esta atrasado", () => {
  assert.equal(asoAtrasado({ aso_scheduled_at: "2026-09-20", documents: [] }, "2026-09-21"), true);
});

test("exame marcado para hoje nao esta atrasado", () => {
  assert.equal(asoAtrasado({ aso_scheduled_at: "2026-09-21", documents: [] }, "2026-09-21"), false);
});

test("exame passado com documento na mao nao e cobranca", () => {
  assert.equal(asoAtrasado({ aso_scheduled_at: "2026-09-01", documents: [aso("entregue")] }, "2026-09-21"), false);
});

test("sem data nao ha atraso", () => {
  assert.equal(asoAtrasado({ aso_scheduled_at: null, documents: [] }, "2026-09-21"), false);
});

test("hoje sai no relogio local, nao em UTC", () => {
  // 21/09 as 22h no fuso de Brasilia ja e 22/09 em UTC. O dia tem de continuar 21.
  const noite = new Date(2026, 8, 21, 22, 30);
  assert.equal(hojeISO(noite), "2026-09-21");
});
