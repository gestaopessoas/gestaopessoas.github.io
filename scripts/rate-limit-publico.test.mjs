// Issue #105 (resto): rate limit no insert público. Roda contra o Supabase local.
//   npx supabase start   →   node test-rate-limit-publico.mjs
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const anon = createClient(url, anonKey);

// O teste gasta a cota da hora inteira. Sem zerar antes, a segunda execução do dia falha
// no primeiro assert em vez de testar qualquer coisa.
assert.ok(url.includes('127.0.0.1') || url.includes('localhost'), 'este teste só roda contra o Supabase local');
const admin = createClient(url, serviceKey);
await admin.from('public_application_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000');

const pdf = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: 'application/pdf' });
const ficha = (id) => ({ id, full_name: 'Teste Rate Limit', first_name: 'Teste', last_name: 'Rate Limit' });

const { data: ticket, error: ticketError } = await anon.rpc('new_application_ticket');
assert.equal(ticketError, null, 'emissão de ticket falhou: ' + ticketError?.message);
assert.match(String(ticket), /^[0-9a-f-]{36}$/, 'ticket não é uuid');

// Sem ticket, nem candidato nem arquivo entram.
const forjado = crypto.randomUUID();
const semTicket = await anon.from('candidates').insert(ficha(forjado));
assert.equal(semTicket.error?.code, '42501', 'insert sem ticket deveria bater na RLS');

const uploadForjado = await anon.storage.from('resumes')
  .upload(`${forjado}/${crypto.randomUUID()}-cv.pdf`, pdf, { contentType: 'application/pdf' });
assert.ok(uploadForjado.error, 'upload em pasta sem ticket deveria ser negado');

// Com ticket, o caminho normal do formulário funciona.
const comTicket = await anon.from('candidates').insert(ficha(ticket));
assert.equal(comTicket.error, null, 'insert com ticket falhou: ' + comTicket.error?.message);

const uploadOk = await anon.storage.from('resumes')
  .upload(`${ticket}/${crypto.randomUUID()}-cv.pdf`, pdf, { contentType: 'application/pdf' });
assert.equal(uploadOk.error, null, 'upload na pasta do ticket falhou: ' + uploadOk.error?.message);

// job_applications: candidato forjado não vincula.
const vinculoForjado = await anon.from('job_applications').insert({ candidate_id: forjado });
assert.equal(vinculoForjado.error?.code, '42501', 'candidatura em candidato sem ticket deveria bater na RLS');

// Caminho normal: candidate_id é o próprio ticket.
const vinculoOk = await anon.from('job_applications').insert({ candidate_id: ticket });
assert.equal(vinculoOk.error, null, 'candidatura com ticket falhou: ' + vinculoOk.error?.message);

// Reaproveitamento (23505): candidato antigo, id que nunca foi ticket — é o caso que o
// gate por ticket quebraria se não houvesse reivindicação.
const antigo = crypto.randomUUID();
const email = `rate.limit.${crypto.randomUUID()}@exemplo.test`;
assert.equal((await admin.from('candidates').insert({ ...ficha(antigo), email })).error, null);

const { data: t2 } = await anon.rpc('new_application_ticket');
const duplicado = await anon.from('candidates').insert({ ...ficha(t2), email });
assert.equal(duplicado.error?.code, '23505', 'e-mail repetido deveria dar 23505');

// Sem passar o ticket, nada é reivindicado e o vínculo continua barrado.
const semMarca = await anon.rpc('find_candidate_id_by_email', { p_email: email });
assert.equal(semMarca.data, antigo, 'RPC de um argumento deveria continuar respondendo');
assert.equal((await anon.from('job_applications').insert({ candidate_id: antigo })).error?.code, '42501',
  'candidato antigo sem reivindicação deveria ser barrado');

const comMarca = await anon.rpc('find_candidate_id_by_email', { p_email: email, p_ticket: t2 });
assert.equal(comMarca.data, antigo, 'RPC com ticket deveria devolver o candidato antigo');
const reaproveitado = await anon.from('job_applications').insert({ candidate_id: antigo });
assert.equal(reaproveitado.error, null, 'reaproveitamento falhou: ' + reaproveitado.error?.message);

// O 16º ticket da mesma origem dentro da hora é recusado.
let bloqueado = null;
for (let i = 0; i < 20 && !bloqueado; i++) {
  const { error } = await anon.rpc('new_application_ticket');
  if (error) bloqueado = { tentativa: i + 2, error };
}
assert.ok(bloqueado, 'contador por IP não disparou: request.headers não trouxe x-forwarded-for');
assert.match(bloqueado.error.message, /rate_limit/, 'erro inesperado: ' + bloqueado.error.message);
assert.ok(bloqueado.tentativa <= 16, 'limite disparou tarde demais: ' + bloqueado.tentativa);

console.log(`ok — ticket exigido em candidates e no bucket resumes; reaproveitamento preservado; IP travado no ticket ${bloqueado.tentativa}`);
