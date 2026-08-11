// Client Supabase compartilhado pelos scripts ESM.
// Credenciais vêm sempre do ambiente — nunca hardcoded (ver docs/adr/0001).
// Carrega .env.local automaticamente; também aceita variáveis já exportadas no shell.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.resolve(here, "..", "..", ".env.local");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Credenciais do Supabase ausentes.\n" +
    "Crie um .env.local na raiz com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY,\n" +
    "ou exporte essas variáveis no shell antes de rodar o script."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
