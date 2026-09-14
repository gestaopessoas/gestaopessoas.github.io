import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasRealEmail,
  placeholderEmail,
  identityLookups,
  findExistingCandidateId,
} from "./candidateIdentity.mjs";

test("placeholder não conta como e-mail de verdade", () => {
  assert.equal(hasRealEmail("borgestiago571@gmail.com"), true);
  assert.equal(hasRealEmail(" TIAGO@Gmail.com "), true);
  assert.equal(hasRealEmail("jose@sememail.com"), false);
  assert.equal(hasRealEmail(""), false);
  assert.equal(hasRealEmail("sem arroba"), false);
});

test("dois homônimos sem e-mail recebem chaves diferentes", () => {
  const um = placeholderEmail("José Silva", "a1");
  const outro = placeholderEmail("José Silva", "b2");
  assert.notEqual(um, outro);
  assert.match(um, /^jose\.silva\.a1@sememail\.com$/);
  assert.equal(hasRealEmail(um), false);
  assert.match(placeholderEmail("", "x9"), /^candidato\.x9@sememail\.com$/);
});

test("ordem de identificação: e-mail, CPF, telefone", () => {
  assert.deepEqual(
    identityLookups({ email: "a@b.com", cpf: "123.456.789-09", phone: "(53) 98475-8582" }).map((l) => l.column),
    ["email", "cpf", "phone"]
  );
  // Placeholder e CPF incompleto não identificam ninguém.
  assert.deepEqual(
    identityLookups({ email: "jose@sememail.com", cpf: "123", phone: "(53) 98475-8582" }).map((l) => l.column),
    ["phone"]
  );
  assert.deepEqual(identityLookups({}), []);
});

test("sem dado que identifique, ninguém é encontrado — cadastro novo", async () => {
  const supabase = {
    from: () => {
      throw new Error("não deveria consultar o banco sem dado de identificação");
    },
  };
  assert.equal(await findExistingCandidateId(supabase, { email: "jose@sememail.com" }), null);
});

test("encontra pelo CPF quando o e-mail é placeholder", async () => {
  const consultas = [];
  const supabase = {
    from: () => ({
      select: () => ({
        ilike: (column, value) => {
          consultas.push([column, value]);
          return {
            limit: () => ({
              maybeSingle: async () => (column === "cpf" ? { data: { id: "cand-1" } } : { data: null }),
            }),
          };
        },
      }),
    }),
  };
  const id = await findExistingCandidateId(supabase, {
    email: "jose@sememail.com",
    cpf: "123.456.789-09",
    phone: "(53) 98475-8582",
  });
  assert.equal(id, "cand-1");
  assert.deepEqual(consultas, [["cpf", "123.456.789-09"]]);
});
