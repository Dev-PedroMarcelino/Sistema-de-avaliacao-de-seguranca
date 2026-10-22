// Carrega as variáveis do arquivo indicado em ENV_FILE (padrão: .env.local).
// Assim cada ambiente tem seu arquivo, ex.: ENV_FILE=.env.producao.local npm run db:migrate

const arquivo = process.env.ENV_FILE || ".env.local";
try {
  process.loadEnvFile(arquivo);
  console.log(`Usando ${arquivo}`);
} catch {
  if (process.env.ENV_FILE) {
    console.error(`Não encontrei ${arquivo}.`);
    process.exit(1);
  }
}

export function exigirBanco() {
  if (!process.env.DATABASE_URL) {
    console.error(`Defina DATABASE_URL em ${arquivo} (conexão do Postgres do Supabase).`);
    process.exit(1);
  }
  const host = new URL(process.env.DATABASE_URL).host;
  console.log(`Banco: ${host}`);
}
