import assert from "node:assert/strict";
import test from "node:test";

export const filterHistory = (historyList, filters) => {
  return historyList.filter(entry => {
    if (filters.employee_id && entry.employee_id !== filters.employee_id) return false;
    if (filters.period_start && new Date(entry.created_at) < new Date(filters.period_start)) return false;
    if (filters.period_end && new Date(entry.created_at) > new Date(filters.period_end)) return false;
    return true;
  });
};

test("lista filtrada por colaborador mostra só as edições daquele colaborador", () => {
  const history = [
    { id: 1, employee_id: "emp-1", created_at: "2026-08-19T10:00:00Z" },
    { id: 2, employee_id: "emp-2", created_at: "2026-08-19T11:00:00Z" },
    { id: 3, employee_id: "emp-1", created_at: "2026-08-20T10:00:00Z" },
  ];

  const filtered = filterHistory(history, { employee_id: "emp-1" });
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, 1);
  assert.equal(filtered[1].id, 3);
});

test("período fora do filtro não aparece", () => {
  const history = [
    { id: 1, employee_id: "emp-1", created_at: "2026-08-01T10:00:00Z" },
    { id: 2, employee_id: "emp-1", created_at: "2026-08-19T10:00:00Z" },
    { id: 3, employee_id: "emp-1", created_at: "2026-08-20T10:00:00Z" },
  ];

  const filtered = filterHistory(history, { 
    period_start: "2026-08-15T00:00:00Z",
    period_end: "2026-08-19T23:59:59Z"
  });
  
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 2);
});
