import test from "node:test";
import assert from "node:assert/strict";
import { buscarTudo } from "./paginacao.ts";

// Fonte falsa que se comporta como o PostgREST: nunca devolve mais que o tamanho da
// pagina, mesmo que peca mais.
const fonte = (total) => {
  const linhas = Array.from({ length: total }, (_, i) => ({ i }));
  const chamadas = [];
  const consulta = (de, ate) => {
    chamadas.push([de, ate]);
    return Promise.resolve({ data: linhas.slice(de, ate + 1), error: null });
  };
  return { consulta, chamadas };
};

test("traz tudo quando passa de uma pagina", async () => {
  const { consulta, chamadas } = fonte(2464);
  const r = await buscarTudo(consulta, 1000);
  assert.equal(r.length, 2464, "as 2.464 linhas tem que voltar, nao 1.000");
  assert.equal(chamadas.length, 3);
});

test("para na pagina exata, sem repetir a ultima", async () => {
  // 2.000 em paginas de 1.000: a terceira volta vazia e encerra.
  const { consulta, chamadas } = fonte(2000);
  const r = await buscarTudo(consulta, 1000);
  assert.equal(r.length, 2000);
  assert.equal(new Set(r.map((x) => x.i)).size, 2000, "nao pode duplicar linha");
  assert.equal(chamadas.length, 3);
});

test("tabela vazia devolve lista vazia numa consulta so", async () => {
  const { consulta, chamadas } = fonte(0);
  assert.deepEqual(await buscarTudo(consulta, 1000), []);
  assert.equal(chamadas.length, 1);
});

test("erro estoura em vez de devolver lista curta", async () => {
  const falha = () => Promise.resolve({ data: null, error: new Error("PGRST103") });
  await assert.rejects(() => buscarTudo(falha, 1000), /PGRST103/);
});
