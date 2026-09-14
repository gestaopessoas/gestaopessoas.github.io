// Sobe a aplicação apontada para o Supabase LOCAL, na porta 3100.
//
// `npm run dev` lê o `.env`, que aponta para PRODUÇÃO — abrir a tela por ali para
// conferir um comportamento significa mexer no cadastro de gente real. Este atalho faz
// o mesmo que `playwright.local.config.ts` já fazia para os testes: pergunta ao
// Supabase local qual é a URL e a chave, e passa para o Next.
//
//   npm run dev:local        → http://localhost:3100
//
// A porta é outra de propósito: dá para deixar os dois de pé ao mesmo tempo sem
// confundir qual banco está na tela.

import { execSync, spawn } from "node:child_process";

const env = Object.fromEntries(
  execSync("npx --yes supabase status -o env", { encoding: "utf8" })
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [chave, ...resto] = linha.split("=");
      return [chave, resto.join("=").replace(/^"|"$/g, "")];
    }),
);

if (!env.API_URL || !env.ANON_KEY) {
  console.error("Supabase local não está de pé. Rode `npx supabase start` antes.");
  process.exit(1);
}

console.log(`Supabase local: ${env.API_URL}`);

spawn("npx", ["next", "dev", "--port", "3100"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: env.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.ANON_KEY,
  },
}).on("exit", (codigo) => process.exit(codigo ?? 0));
