import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSearchTags, searchTagEntries, withOrphanTags } from "./searchTags.mjs";

test("agrupa por categoria em ordem alfabética e respeita a ordem numérica", () => {
  const groups = groupSearchTags([
    { path: ["Perfil", "10"], value_text: "Viagem" },
    { path: ["CNH", "0"], value_text: "CNH B" },
    { path: ["Perfil", "2"], value_text: "Estabilidade" },
    { path: ["Área de atuação", "0"], value_text: "Compras" },
    { path: ["Perfil", "3"], value_text: null },
  ]);
  assert.deepEqual(groups, [
    { category: "Área de atuação", tags: ["Compras"] },
    { category: "CNH", tags: ["CNH B"] },
    { category: "Perfil", tags: ["Estabilidade", "Viagem"] },
  ]);
});

test("tag removida da lista continua visível em Outras", () => {
  const groups = [{ category: "CNH", tags: ["CNH B"] }];
  assert.deepEqual(withOrphanTags(groups, ["CNH B", "Júnior"]), [...groups, { category: "Outras", tags: ["Júnior"] }]);
  assert.equal(withOrphanTags(groups, ["CNH B"]), groups);
});

test("ida e volta entre grupos e linhas do banco", () => {
  const groups = [{ category: "CNH", tags: ["CNH B", "CNH C"] }, { category: "Perfil", tags: ["Viagem"] }];
  assert.deepEqual(groupSearchTags(searchTagEntries(groups)), groups);
});
