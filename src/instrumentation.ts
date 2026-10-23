// Ao subir o servidor, prepara o banco (migrações e dados iniciais) antes da primeira requisição.
// O import condicional mantém o código de Node fora do bundle do runtime edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
