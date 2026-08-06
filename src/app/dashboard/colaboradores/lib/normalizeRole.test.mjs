import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRole } from "./normalizeRole.mjs";

test("normaliza o cargo para o mesmo formato persistido pelo banco", () => {
  assert.equal(normalizeRole("  Analista de RH  "), "ANALISTA DE RH");
});

