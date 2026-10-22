import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, lerTokenSessao } from "@/lib/auth/sessao";

export async function middleware(req: NextRequest) {
  const sessao = await lerTokenSessao(req.cookies.get(COOKIE_SESSAO)?.value);
  if (sessao) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ erro: "Sessão expirada. Entre de novo." }, { status: 401 });
  }
  const login = new URL("/login", req.url);
  login.searchParams.set("proximo", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/painel/:path*", "/api/painel/:path*"] };
