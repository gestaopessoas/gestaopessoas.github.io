// Check minimo da Fase 1 do eixo unico de Etapa (issue #56, ADR 0006).
//
// O mapa de traducao mora em SQL, em public.canonical_stage: e o mesmo CASE que o backfill e o
// trigger BEFORE de traducao usam. Duplicar o mapa aqui em JS criaria a segunda fonte de verdade
// que a epica existe para eliminar -- entao o teste exercita a funcao de verdade, via RPC, no
// mesmo padrao dos outros test-*.mjs deste repo.
//
// Rodar com: node --test stage-map.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.LOGIN_BRUNO;
const password = process.env.PASS_BRUNO;

if (!url || !anonKey || !email || !password) {
  throw new Error("Missing required Supabase or login env vars");
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
  realtime: { enabled: false },
});

await supabase.auth.signInWithPassword({ email, password });

async function canonical(stage) {
  const { data, error } = await supabase.rpc("canonical_stage", { v_stage: stage });
  if (error) throw new Error(`canonical_stage(${JSON.stringify(stage)}): ${error.message}`);
  return data;
}

const CANONICAS = [
  "Nova", "Triagem", "Entrevista RH", "Entrevista Gestor", "Testagem Psicológica",
  "Aguardando Obra", "Em Avaliação na Obra", "Em Obra", "Proposta", "Documentação",
  "Processo de MP", "Contratado", "Reprovado", "Desistente",
];

// Entradas que carregam sinal de reprovacao, em qualquer dos vocabularios antigos.
const COM_SINAL_DE_REPROVACAO = ["Reprovado", "Recusado pela Obra"];

test("toda entrada com sinal de reprovacao sai como Reprovado", async () => {
  for (const entrada of COM_SINAL_DE_REPROVACAO) {
    assert.equal(await canonical(entrada), "Reprovado", `entrada: ${entrada}`);
  }
});

test("nenhuma entrada com sinal sai como Nova", async () => {
  for (const entrada of COM_SINAL_DE_REPROVACAO) {
    assert.notEqual(await canonical(entrada), "Nova", `entrada: ${entrada}`);
  }
});

test("as canonicas sao idempotentes", async () => {
  for (const etapa of CANONICAS) {
    assert.equal(await canonical(etapa), etapa);
  }
});

test("os colapsos do ADR 0006", async () => {
  const esperado = {
    "Proposta Pendente": "Proposta",
    "Proposta em Aprovação RH": "Proposta",
    "Proposta Aprovada": "Proposta",
    "Em proposta": "Proposta",
    "Coleta de Documentos & Exames": "Documentação",
    "Coleta de documentos": "Documentação",
    "Aguardando ASO": "Documentação",
    "Processo de MPs": "Processo de MP",
    "Nova Aplicação": "Nova",
    "Entrevista com Gestor": "Entrevista Gestor",
    "Entrevista com a Gestão": "Entrevista Gestor",
  };
  for (const [de, para] of Object.entries(esperado)) {
    assert.equal(await canonical(de), para, `${de} -> ${para}`);
  }
});

test("o que deixa de ser Etapa devolve NULL, nao um default", async () => {
  const naoSaoEtapa = [
    "Encaminhado - Obra Específica",
    "Encaminhado - Pool Geral",
    "Banco de Talentos",
    "Em entrevista",
    "Outros",
    "Currículo Visualizado",
  ];
  for (const entrada of naoSaoEtapa) {
    assert.equal(await canonical(entrada), null, `entrada: ${entrada}`);
  }
});

test("valor desconhecido nao vira Nova em silencio", async () => {
  // E aqui que o bug da epica nascia: normalizeStage() jogava qualquer coisa em "Nova".
  for (const lixo of ["", "   ", "Etapa Que Nunca Existiu", "contratado"]) {
    assert.equal(await canonical(lixo), null, `entrada: ${JSON.stringify(lixo)}`);
  }
});

test.after(async () => {
  await supabase.auth.signOut();
});
