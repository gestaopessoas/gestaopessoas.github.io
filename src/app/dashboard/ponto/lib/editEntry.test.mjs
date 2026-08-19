import assert from "node:assert/strict";
import test from "node:test";
import { editPontoEntry } from "./editEntry.ts";

test("editar horário de entrada -> novo valor aplicado, histórico registra valor antigo e novo, recalcula banco", () => {
  const entryAtual = {
    id: "log-1",
    employee_id: "emp-1",
    log_date: "2026-08-19",
    entry_1: "08:00",
    exit_1: "12:00",
    entry_2: "13:00",
    exit_2: "17:00",
  }; // 8 horas = 480 min (0 diferença para expected=480)

  // Atraso de 30 min na entrada
  const result = editPontoEntry(
    entryAtual,
    "entry_1",
    "08:30",
    "Gestor Teste",
    "Ajuste manual",
    480
  );

  assert.equal(result.entryAtualizada.entry_1, "08:30");
  assert.equal(result.historicoEntry.old_value, "08:00");
  assert.equal(result.historicoEntry.new_value, "08:30");
  assert.equal(result.historicoEntry.field_changed, "entry_1");
  assert.equal(result.historicoEntry.reason, "Ajuste manual");

  // Recalculo do banco (450 min trabalhados vs 480 expected = 30 min deficit)
  assert.equal(result.hourBank.negativeMinutes, 30);
  assert.equal(result.hourBank.positiveMinutes, 0);
  assert.equal(result.timeRecords[0].code, "211");
});

test("editar sem alterar valor -> não gera entrada de histórico redundante", () => {
  const entryAtual = {
    id: "log-1",
    employee_id: "emp-1",
    log_date: "2026-08-19",
    entry_1: "08:00",
    exit_1: null,
    entry_2: null,
    exit_2: null,
  };

  const result = editPontoEntry(
    entryAtual,
    "entry_1",
    "08:00",
    "Gestor Teste",
    "Tentativa de ajuste",
    480
  );

  assert.equal(result.entryAtualizada.entry_1, "08:00");
  assert.equal(result.historicoEntry, null, "Não deve gerar histórico se o valor for igual");
});

test("múltiplas edições no mesmo registro (simulação em ordem cronológica)", () => {
  const entryAtual = {
    id: "log-1",
    employee_id: "emp-1",
    log_date: "2026-08-19",
    entry_1: "08:00",
    exit_1: "12:00",
    entry_2: "13:00",
    exit_2: "17:00",
  };

  // Edição 1
  const result1 = editPontoEntry(entryAtual, "entry_1", "07:30", "Autor 1", "Chegou mais cedo");
  
  // Edição 2
  const result2 = editPontoEntry(result1.entryAtualizada, "exit_2", "18:00", "Autor 2", "Ficou até mais tarde");

  // O histórico é apenas uma entrada por chamada, caberá ao banco acumular
  assert.equal(result2.entryAtualizada.entry_1, "07:30");
  assert.equal(result2.entryAtualizada.exit_2, "18:00");
  
  assert.equal(result2.historicoEntry.old_value, "17:00");
  assert.equal(result2.historicoEntry.new_value, "18:00");

  // 07:30 as 12:00 (4.5h) + 13:00 as 18:00 (5h) = 9.5h = 570 min
  // Expected = 480
  // Extra = 90 min
  assert.equal(result2.hourBank.positiveMinutes, 90);
  assert.equal(result2.hourBank.negativeMinutes, 0);
  assert.equal(result2.timeRecords[0].code, "150");
  assert.equal(result2.timeRecords[0].hours, 1);
  assert.equal(result2.timeRecords[0].minutes, 30);
});
