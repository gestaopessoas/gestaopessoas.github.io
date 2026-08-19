import assert from "node:assert/strict";
import test from "node:test";

import { computeOvertimePay, computeHourBank } from "./hoursRules.ts";

test("hora extra em dia útil (50%, código 150)", () => {
  const registros = [{ code: "150", hours: 2, minutes: 0 }]; // 120 min

  const pay = computeOvertimePay(registros);
  assert.equal(pay.totalMinutes, 120);
  assert.equal(pay.payableMinutes, 60); // 50% de 120

  const bank = computeHourBank(registros);
  assert.equal(bank.positiveMinutes, 120); // banco credita 1:1, sem percentual
  assert.equal(bank.negativeMinutes, 0);
});

test("hora extra em domingo/feriado (100%, código 200)", () => {
  const registros = [{ code: "200", hours: 1, minutes: 30 }]; // 90 min

  const pay = computeOvertimePay(registros);
  assert.equal(pay.totalMinutes, 90);
  assert.equal(pay.payableMinutes, 90); // 100% de 90

  const bank = computeHourBank(registros);
  assert.equal(bank.positiveMinutes, 90); // mesmo valor, não dobrado
  assert.equal(bank.negativeMinutes, 0);
});

test("horas negativas (atraso/falta, código 211 ou 212)", () => {
  const registros = [
    { code: "211", hours: 0, minutes: 45 },
    { code: "212", hours: 1, minutes: 0 },
  ];

  const pay = computeOvertimePay(registros);
  assert.equal(pay.totalMinutes, 0);
  assert.equal(pay.payableMinutes, 0);

  const bank = computeHourBank(registros);
  assert.equal(bank.positiveMinutes, 0);
  assert.equal(bank.negativeMinutes, 105); // 45 + 60, débito 1:1 sem percentual
});

test("registro sem horas extras (código desconhecido / vazio)", () => {
  assert.deepEqual(computeOvertimePay([]), { totalMinutes: 0, payableMinutes: 0 });
  assert.deepEqual(computeHourBank([]), { positiveMinutes: 0, negativeMinutes: 0 });

  const registros = [{ code: "999", hours: 1, minutes: 0 }];
  assert.deepEqual(computeOvertimePay(registros), { totalMinutes: 0, payableMinutes: 0 });
  assert.deepEqual(computeHourBank(registros), { positiveMinutes: 0, negativeMinutes: 0 });
});
