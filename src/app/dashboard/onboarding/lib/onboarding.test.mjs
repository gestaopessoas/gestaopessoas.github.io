import test from "node:test";
import assert from "node:assert/strict";
import { diasDeCasa, marcoAtingido, progresso, tarefaAtrasada } from "./onboarding.mjs";

test("dias de casa conta da admissao ate hoje", () => {
  assert.equal(diasDeCasa("2026-09-01", "2026-09-22"), 21);
});

test("admitido hoje tem zero dias de casa, nao um", () => {
  assert.equal(diasDeCasa("2026-09-22", "2026-09-22"), 0);
});

test("sem data de admissao nao ha dias de casa", () => {
  assert.equal(diasDeCasa(null, "2026-09-22"), null);
});

test("o marco de 45 vale ate o de 90 chegar", () => {
  assert.equal(marcoAtingido(44), null);
  assert.equal(marcoAtingido(45), 45);
  assert.equal(marcoAtingido(89), 45);
  assert.equal(marcoAtingido(90), 90);
  assert.equal(marcoAtingido(200), 90);
});

test("sem dias de casa nao ha marco", () => {
  assert.equal(marcoAtingido(null), null);
});

test("tarefa vence no dia seguinte ao prazo, nao no proprio dia", () => {
  assert.equal(tarefaAtrasada({ due_date: "2026-09-22", completed: false }, "2026-09-22"), false);
  assert.equal(tarefaAtrasada({ due_date: "2026-09-21", completed: false }, "2026-09-22"), true);
});

test("tarefa concluida nunca esta atrasada, mesmo fora do prazo", () => {
  assert.equal(tarefaAtrasada({ due_date: "2026-01-01", completed: true }, "2026-09-22"), false);
});

test("tarefa sem prazo nao atrasa: nao houve combinado", () => {
  assert.equal(tarefaAtrasada({ due_date: null, completed: false }, "2026-09-22"), false);
});

test("progresso conta as concluidas", () => {
  assert.deepEqual(progresso([{ completed: true }, { completed: false }]), { feitas: 1, total: 2, pct: 50 });
});

test("sem tarefa nenhuma o progresso e zero, e nao NaN", () => {
  assert.deepEqual(progresso([]), { feitas: 0, total: 0, pct: 0 });
});
