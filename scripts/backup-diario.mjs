// Backup diário de PRODUÇÃO para este computador: banco, usuários do login e arquivos
// do Storage. O plano gratuito do Supabase não faz backup nenhum — este é o único.
//
//   node scripts/backup-diario.mjs
//
// Agendado no Windows pela tarefa "Backup gestaopessoas" (ver o fim deste arquivo).
//
// Senha do banco: lida pelo próprio pg_dump em %APPDATA%\postgresql\pgpass.conf.
// Chave do Storage: SUPABASE_SERVICE_ROLE_KEY do `.env`. Nenhum segredo neste arquivo —
// o repositório é público. Os backups ficam FORA do repositório, em BACKUP_DIR.
//
// Um dump pode sair com código 0 e arquivo cortado no meio, sem aviso. Por isso cada
// cópia só é aceita se trouxer a mesma contagem de linhas, tabela a tabela, que o banco
// tem agora. Se não bater, a pasta do dia fica marcada FALHOU e aparece um aviso na tela.

import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKUP_DIR = join(homedir(), "Backups", "gestaopessoas");
const PG_BIN = "C:\\Program Files\\PostgreSQL\\18\\bin";
// Host direto do Supabase é só IPv6; esta máquina não tem. O pooler em modo sessão serve ao pg_dump.
const PG_ENV = {
  ...process.env,
  PGHOST: "aws-1-us-west-2.pooler.supabase.com",
  PGPORT: "5432",
  PGDATABASE: "postgres",
  PGUSER: "postgres.bnwwdseczwrmmuvallml",
};
// Schemas nossos. auth/storage/cron são do Supabase: deles só vão os dados que importam.
const SCHEMAS = ["public", "backup_20260805", "supabase_migrations"];
const EXTRA_TABLES = ["auth.users", "auth.identities", "storage.buckets", "storage.objects", "cron.job"];

const today = new Date().toISOString().slice(0, 10);
const dayDir = join(BACKUP_DIR, today);
const log = [];
const say = (msg) => { const line = `${new Date().toISOString()} ${msg}`; log.push(line); console.log(line); };

function psql(sql) {
  return execFileSync(join(PG_BIN, "psql.exe"), ["-X", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql], { env: PG_ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function pgDump(args, file) {
  execFileSync(join(PG_BIN, "pg_dump.exe"), [...args, "--no-owner", "--no-privileges", "-f", file], { env: PG_ENV, stdio: ["ignore", "ignore", "pipe"] });
}

// Contagem viva, tabela a tabela, numa única ida ao banco.
function liveCounts() {
  const schemaList = SCHEMAS.map((s) => `'${s}'`).join(",");
  const extraList = EXTRA_TABLES.map((t) => `'${t}'`).join(",");
  const out = psql(`
    select n.nspname || '.' || c.relname,
           (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and (n.nspname in (${schemaList}) or n.nspname || '.' || c.relname in (${extraList}))`);
  return new Map(out.trim().split("\n").filter(Boolean).map((l) => { const [t, n] = l.split("\t"); return [t, Number(n)]; }));
}

// Linhas de dados por tabela no dump: cada linha entre "COPY x FROM stdin;" e "\." é um registro
// (o formato COPY escapa quebras de linha, então um registro nunca ocupa duas linhas).
async function dumpCounts(file, counts = new Map()) {
  let table = null, complete = false;
  for await (const line of createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity })) {
    if (table) {
      if (line === "\\.") table = null;
      else counts.set(table, counts.get(table) + 1);
    } else if (line.startsWith("COPY ")) {
      table = line.slice(5, line.indexOf(" (")).replaceAll('"', "");
      counts.set(table, 0);
    } else if (line.startsWith("-- PostgreSQL database dump complete")) complete = true;
  }
  if (!complete) throw new Error(`${file} terminou no meio — dump cortado`);
  return counts;
}

async function gzip(file) {
  await pipeline(createReadStream(file), createGzip(), createWriteStream(`${file}.gz`));
  rmSync(file);
}

// Espelho incremental do Storage: baixa só o que é novo ou mudou de tamanho. Arquivo apagado
// no Supabase continua aqui — ponytail: espelho nunca encolhe; limpar à mão se crescer demais.
async function mirrorStorage() {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env");

  const rows = psql("select bucket_id, name, coalesce(metadata->>'size','0') from storage.objects order by 1, 2").trim().split("\n").filter(Boolean);
  let downloaded = 0;
  for (const row of rows) {
    const [bucket, name, size] = row.split("\t");
    const dest = join(BACKUP_DIR, "storage", bucket, ...name.split("/"));
    if (existsSync(dest) && statSync(dest).size === Number(size)) continue;
    const path = name.split("/").map(encodeURIComponent).join("/");
    // Rede oscila: 3 tentativas antes de dar o dia como falho.
    let body;
    for (let attempt = 1; !body; attempt++) {
      try {
        const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        body = Buffer.from(await res.arrayBuffer());
      } catch (err) {
        if (attempt === 3) throw new Error(`Storage ${bucket}/${name}: ${err.cause?.code ?? err.message}`);
        await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
    }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, body);
    downloaded++;
  }
  say(`storage: ${rows.length} arquivos no Supabase, ${downloaded} baixados agora`);
}

// Guarda 7 dias, a mais recente de cada uma das últimas 4 semanas e de cada um dos últimos 12 meses.
function prune() {
  const days = readdirSync(BACKUP_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(join(BACKUP_DIR, d, "OK"))).sort().reverse();
  const keep = new Set(days.slice(0, 7));
  const newestBy = (keyOf, limit) => {
    const seen = new Set();
    for (const d of days) { const k = keyOf(d); if (!seen.has(k) && seen.size < limit) { seen.add(k); keep.add(d); } }
  };
  newestBy((d) => { const t = new Date(d); t.setUTCDate(t.getUTCDate() - t.getUTCDay()); return t.toISOString().slice(0, 10); }, 4);
  newestBy((d) => d.slice(0, 7), 12);
  // Só apaga pasta antiga que deu certo; pasta FALHOU fica para alguém olhar.
  for (const d of days) if (!keep.has(d)) { rmSync(join(BACKUP_DIR, d), { recursive: true }); say(`apagado backup antigo ${d}`); }
}

async function main() {
  rmSync(dayDir, { recursive: true, force: true });
  mkdirSync(dayDir, { recursive: true });

  const dbFile = join(dayDir, "banco.sql");
  const extraFile = join(dayDir, "auth-storage-cron.sql");
  // Conta antes e depois: com gente usando o sistema, o dump pode pegar um registro a mais
  // ou a menos que uma contagem só. Fora dessa faixa (ou tabela ausente) é dump cortado.
  const before = liveCounts();
  pgDump(SCHEMAS.flatMap((s) => ["-n", s]), dbFile);
  pgDump(["--data-only", ...EXTRA_TABLES.flatMap((t) => ["-t", t])], extraFile);
  const live = liveCounts();

  const dumped = await dumpCounts(extraFile, await dumpCounts(dbFile));
  const wrong = [...live].filter(([t, n]) => {
    const d = dumped.get(t), b = before.get(t) ?? n;
    return d === undefined || d < Math.min(b, n) || d > Math.max(b, n);
  }).map(([t, n]) => `${t}: banco ${before.get(t)}→${n}, backup ${dumped.get(t) ?? "ausente"}`);
  if (wrong.length) throw new Error(`contagem não bate em ${wrong.length} tabela(s):\n  ${wrong.join("\n  ")}`);
  const rows = [...live.values()].reduce((a, b) => a + b, 0);
  say(`banco: ${live.size} tabelas, ${rows} registros, contagem confere`);

  await gzip(dbFile);
  await gzip(extraFile);
  await mirrorStorage();
  writeFileSync(join(dayDir, "OK"), `${today}\n`);
  prune();
}

try {
  await main();
} catch (err) {
  say(`FALHOU: ${err.message}`);
  writeFileSync(join(dayDir, "FALHOU"), `${err.stack}\n`);
  // Aviso na tela de quem estiver logado — a tarefa roda escondida, sem isso a falha passa batida.
  try { execFileSync("msg", ["*", `Backup do gestaopessoas FALHOU em ${today}. Ver ${dayDir}\\backup.log`]); } catch {}
  process.exitCode = 1;
} finally {
  if (existsSync(dayDir)) await writeFile(join(dayDir, "backup.log"), log.join("\n") + "\n");
}

// Agendamento (rodar uma vez, no PowerShell, na pasta do repositório):
//
//   $a = New-ScheduledTaskAction -Execute "node.exe" -Argument "scripts\backup-diario.mjs" -WorkingDirectory (Get-Location)
//   $t = New-ScheduledTaskTrigger -Daily -At 12:00
//   $s = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
//   Register-ScheduledTask -TaskName "Backup gestaopessoas" -Action $a -Trigger $t -Settings $s
//
// -StartWhenAvailable: se o PC estiver desligado ao meio-dia, roda assim que ligar.
