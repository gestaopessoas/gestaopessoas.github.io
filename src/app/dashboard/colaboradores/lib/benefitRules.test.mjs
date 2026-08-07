import assert from "node:assert/strict";
import test from "node:test";

import { getEmployeeBenefitLevelLabel, matchesEmployeeBenefit } from "./benefitRules.mjs";

test("reconhece VR normalizado pelo banco em maiúsculas", () => {
  assert.equal(
    matchesEmployeeBenefit(
      "VALE REFEIÇÃO - NÍVEL II",
      "Vale Refeição",
    ),
    true,
  );
});

test("não confunde benefícios com nomes apenas parecidos", () => {
  assert.equal(
    matchesEmployeeBenefit("VALE ALIMENTAÇÃO", "Vale Refeição"),
    false,
  );
});

test("extrai o nível do VR normalizado pelo banco", () => {
  assert.equal(
    getEmployeeBenefitLevelLabel(
      "VALE REFEIÇÃO - NÍVEL II",
      "Vale Refeição",
    ),
    "Nível II",
  );
});
