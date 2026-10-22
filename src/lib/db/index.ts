import fs from "node:fs";
import path from "node:path";

export type Linha = Record<string, unknown>;

/** Interface mínima comum ao Postgres do Supabase (postgres.js) e ao PGlite embutido. */
export interface Db {
  query<T = Linha>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

export async function um<T = Linha>(db: Db, sql: string, params?: unknown[]): Promise<T | undefined> {
  const linhas = await db.query<T>(sql, params);
  return linhas[0];
}

const PASTA_MIGRACOES = path.join(process.cwd(), "supabase", "migrations");

/** Aplica, em ordem, os .sql de supabase/migrations que ainda não rodaram. */
export async function aplicarMigracoes(db: Db, pasta = PASTA_MIGRACOES): Promise<string[]> {
  await db.exec(`
    create schema if not exists app;
    create table if not exists app.migracoes (nome text primary key, aplicada_em timestamptz not null default now());
  `);
  const feitas = new Set((await db.query<{ nome: string }>("select nome from app.migracoes")).map((m) => m.nome));
  const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort();
  const aplicadas: string[] = [];
  for (const arquivo of arquivos) {
    if (feitas.has(arquivo)) continue;
    const sql = fs.readFileSync(path.join(pasta, arquivo), "utf8");
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.query("insert into app.migracoes (nome) values ($1)", [arquivo]);
    });
    aplicadas.push(arquivo);
  }
  return aplicadas;
}

async function conectarPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // prepare: false é exigido pelo pooler do Supabase (Supavisor) em modo transação.
  const sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
  type Sql = typeof sql;
  const envolver = (s: Pick<Sql, "unsafe">, raiz: Sql | null): Db => ({
    async query<T>(texto: string, params: unknown[] = []) {
      return (await s.unsafe(texto, params as never[])) as unknown as T[];
    },
    async exec(texto: string) {
      await s.unsafe(texto);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (!raiz) return fn(envolver(s, null));
      return (await raiz.begin((t) => fn(envolver(t, null)))) as T;
    },
  });
  return envolver(sql, sql);
}

export async function criarPglite(pasta?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (pasta) fs.mkdirSync(pasta, { recursive: true });
  const pg = await PGlite.create(pasta);
  type Tx = Parameters<Parameters<typeof pg.transaction>[0]>[0];
  const envolver = (c: Tx | typeof pg, emTx: boolean): Db => ({
    async query<T>(texto: string, params: unknown[] = []) {
      return (await c.query<T>(texto, params)).rows;
    },
    async exec(texto: string) {
      await c.exec(texto);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (emTx) return fn(envolver(c, true));
      return pg.transaction((t) => fn(envolver(t, true)));
    },
  });
  return envolver(pg, false);
}

const global = globalThis as unknown as { __integraDb?: Promise<Db> };

/**
 * Conexão única do processo.
 * Com DATABASE_URL: Postgres do Supabase (migrações via `npm run db:migrate`).
 * Sem: PGlite em .data/pglite, com migrações e dados de demonstração automáticos.
 */
export function getDb(): Promise<Db> {
  if (!global.__integraDb) {
    global.__integraDb = (async () => {
      const url = process.env.DATABASE_URL;
      if (url) return conectarPostgres(url);
      const db = await criarPglite(process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite"));
      await aplicarMigracoes(db);
      const { semearSeVazio } = await import("../demo/semear");
      await semearSeVazio(db);
      return db;
    })().catch((erro) => {
      global.__integraDb = undefined;
      throw erro;
    });
  }
  return global.__integraDb;
}
