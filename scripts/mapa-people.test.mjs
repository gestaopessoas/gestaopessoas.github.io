// Regra de quem aparece no mapa (/dashboard/mapa). Sem banco: node --test scripts/mapa-people.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapPeople } from '../src/app/dashboard/mapa/people.ts';

const end = { address: 'RUA A', address_number: '10', city: 'PELOTAS', state: 'RS' };
const cand = (id, full_name, cpf, extra = {}) => ({ id, full_name, cpf, ...end, ...extra });
const emp = (id, name, cpf, extra = {}) => ({ id, name, cpf, workplace_name: 'JOY', address: null, ...extra });

test('contratado sai de candidato; não contratado fica', () => {
  const r = buildMapPeople([], [cand('c1', 'Ana', '1'), cand('c2', 'Bia', '2')], ['c1']);
  assert.deepEqual(r.candidatos.map((p) => p.id), ['c2']);
});

test('herda endereço por CPF (só dígitos)', () => {
  const r = buildMapPeople([emp('e1', 'Outro Nome', '111.222.333-44')], [cand('c1', 'Ana', '11122233344')], ['c1']);
  assert.equal(r.colaboradores.length, 1);
  assert.equal(r.colaboradores[0].address, 'RUA A');
  assert.equal(r.colaboradores[0].workplace_name, 'JOY');
});

test('herda por nome normalizado quando CPF não bate', () => {
  const r = buildMapPeople([emp('e1', ' maria  da silva ', null)], [cand('c1', 'MARIA DA SILVA', null)], ['c1']);
  assert.equal(r.colaboradores.length, 1);
  assert.equal(r.colaboradores[0].address, 'RUA A');
});

test('contratado sem employee vira colaborador A ADMITIR', () => {
  const r = buildMapPeople([], [cand('c1', 'Ana', '1')], ['c1']);
  assert.equal(r.candidatos.length, 0);
  assert.equal(r.colaboradores[0].workplace_name, 'A ADMITIR');
  assert.equal(r.colaboradores[0].name, 'Ana');
  assert.equal(r.colaboradores[0].address, 'RUA A');
});

test('employee com endereço próprio mantém o seu', () => {
  const r = buildMapPeople([emp('e1', 'Ana', '1', { address: 'RUA B' })], [cand('c1', 'Ana', '1')], ['c1']);
  assert.equal(r.colaboradores[0].address, 'RUA B');
});
