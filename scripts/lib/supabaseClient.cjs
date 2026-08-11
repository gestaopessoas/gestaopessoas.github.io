// Client Supabase compartilhado pelos scripts CommonJS.
// Credenciais vêm sempre do ambiente — nunca hardcoded (ver docs/adr/0001).
// Carrega .env.local automaticamente; também aceita variáveis já exportadas no shell.
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const envFile = path.resolve(__dirname, "..", "..", ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Credenciais do Supabase ausentes.\n" +
    "Crie um .env.local na raiz com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY,\n" +
    "ou exporte essas variáveis no shell antes de rodar o script."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase, supabaseUrl, supabaseKey, createClient };
