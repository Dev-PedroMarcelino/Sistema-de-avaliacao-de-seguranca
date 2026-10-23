import Link from "next/link";
import {
  ClipboardCheck,
  Fingerprint,
  Gauge,
  Link2,
  Lock,
  MonitorSmartphone,
  PenLine,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  TimerReset,
} from "lucide-react";
import { BotaoLink, Logo } from "@/components/ui";

// DEMO_MODE é lido em tempo de execução (o mesmo build serve o cliente e o demo).
export const dynamic = "force-dynamic";

const PASSOS = [
  { icone: Link2, titulo: "Link pelo WhatsApp", texto: "A segurança gera um link único para o motorista. Quem chega sem ele lê o QR Code da portaria." },
  { icone: Smartphone, titulo: "Vídeo que não pula", texto: "Sem pausar, adiantar ou acelerar. Saiu da tela, o vídeo para. O servidor confere o tempo real assistido." },
  { icone: ClipboardCheck, titulo: "Perguntas", texto: "Errou: borda vermelha e fica na pergunta até acertar. Cada tentativa fica registrada." },
  { icone: PenLine, titulo: "Termo assinado", texto: "Assinatura com o dedo e comprovante com código e QR Code para mostrar na portaria." },
];

const PROVAS = [
  { icone: Fingerprint, titulo: "Identificação", texto: "Nome, CPF, placa, transportadora e o WhatsApp para onde o link foi enviado." },
  { icone: TimerReset, titulo: "Vídeo validado no servidor", texto: "Sinais a cada 10 s; o progresso nunca anda mais rápido que o relógio." },
  { icone: Lock, titulo: "Trilha à prova de adulteração", texto: "Cada evento guarda o SHA-256 do anterior e o banco recusa alterações." },
  { icone: ScanLine, titulo: "Verificação pública", texto: "Qualquer pessoa confere o comprovante pelo QR Code, sem acessar o sistema." },
];

const PAINEL = [
  { icone: Gauge, titulo: "Dashboard", texto: "Funil das integrações, perguntas que mais erram e vencimentos." },
  { icone: ShieldCheck, titulo: "Portaria", texto: "Placa ou CPF e a resposta na hora: pode entrar ou não." },
  { icone: QrCode, titulo: "QR Code por unidade", texto: "Cartaz pronto para imprimir em cada portaria." },
  { icone: MonitorSmartphone, titulo: "Dossiê para o jurídico", texto: "PDF com comprovante, linha do tempo e dados técnicos." },
];

export default function Inicio() {
  const demo = process.env.DEMO_MODE === "true";
  return (
    <div className="bg-white">
      <header className="relative overflow-hidden bg-tinta text-white">
        <div className="faixa-seguranca h-2" />
        <div className="mx-auto max-w-6xl px-4 py-5">
          <nav className="flex items-center justify-between">
            <Logo claro />
            <div className="flex items-center gap-4 text-sm">
              <Link href="/v" className="text-stone-300 hover:text-white">
                Verificar comprovante
              </Link>
              <Link href="/login" className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20">
                Entrar
              </Link>
            </div>
          </nav>
          <div className="grid items-center gap-10 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-24">
            <div>
              <p className="mb-4 inline-flex rounded-full bg-marca/15 px-3 py-1 text-sm font-semibold text-marca">
                Segurança do trabalho · motoristas externos
              </p>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                A prova de que cada motorista foi instruído antes de entrar.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-stone-300">
                Integração de segurança pelo celular: vídeo que não pode ser pulado, perguntas de verificação, termo
                assinado e um comprovante que denuncia qualquer alteração. Feito para mineração, onde a carreta de
                terceiro que entra sem instrução vira risco de acidente e de processo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {demo ? (
                  <>
                    <a href="/demo/motorista" className="inline-flex h-12 items-center gap-2 rounded-xl bg-marca px-5 font-bold text-tinta hover:brightness-95">
                      <Smartphone className="h-5 w-5" /> Fazer como motorista
                    </a>
                    <Link
                      href="/login"
                      className="inline-flex h-12 items-center rounded-xl border-2 border-white/25 px-5 font-semibold text-white hover:border-white/60"
                    >
                      Ver o painel da segurança
                    </Link>
                  </>
                ) : (
                  <BotaoLink href="/login" variante="marca" className="h-12 px-5">
                    Entrar no painel
                  </BotaoLink>
                )}
              </div>
              {demo && <p className="mt-3 text-sm text-stone-500">Demonstração com dados fictícios. O vídeo demo tem 48 segundos.</p>}
            </div>
            <div className="relative mx-auto w-full max-w-xs">
              <div className="rounded-[2.2rem] border-8 border-stone-800 bg-stone-100 p-3 shadow-2xl">
                <div className="rounded-2xl bg-white p-4 text-tinta">
                  <div className="mb-3 grid grid-cols-5 gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1.5 rounded-full ${i < 4 ? "bg-marca" : "bg-stone-200"}`} />
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase text-stone-500">Pergunta 2 de 3</p>
                  <div className="mt-2 rounded-2xl border-4 border-red-600 bg-red-50 p-3">
                    <p className="font-extrabold leading-snug">Durante o carregamento, onde o motorista deve ficar?</p>
                    <p className="mt-1 text-xs font-bold text-red-700">Resposta errada. Tente de novo.</p>
                    <div className="mt-3 space-y-1.5 text-sm font-semibold">
                      <p className="rounded-xl border-2 border-red-600 bg-red-100 px-3 py-2">Ao lado do caminhão</p>
                      <p className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2">Dentro da cabine</p>
                      <p className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2">Em cima da carroceria</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight">Como funciona</h2>
        <p className="mt-2 max-w-2xl text-stone-600">Cinco minutos no celular do motorista, sem instalar nada.</p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="rounded-2xl bg-stone-50 p-6 ring-1 ring-stone-200">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tinta text-marca">
                <p.icone className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-bold text-stone-400">{i + 1}</p>
              <h3 className="text-lg font-bold">{p.titulo}</h3>
              <p className="mt-1 text-stone-600">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-stone-100">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">O que fica guardado como prova</h2>
            <p className="mt-3 text-stone-600">
              Numa ação trabalhista, “o motorista assistiu ao vídeo” precisa de mais que uma planilha. Cada passo é
              gravado com o horário do servidor e encadeado por criptografia: se alguém mudar um registro depois, a
              verificação mostra.
            </p>
            <ul className="mt-8 space-y-5">
              {PROVAS.map((p) => (
                <li key={p.titulo} className="flex gap-4">
                  <p.icone className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
                  <div>
                    <h3 className="font-bold">{p.titulo}</h3>
                    <p className="text-stone-600">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Para a segurança e a portaria</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PAINEL.map((p) => (
                <div key={p.titulo} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                  <p.icone className="h-6 w-6 text-amber-700" />
                  <h3 className="mt-3 font-bold">{p.titulo}</h3>
                  <p className="mt-1 text-sm text-stone-600">{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-extrabold tracking-tight">Por dentro</h2>
        <div className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-2xl p-5 ring-1 ring-stone-200">
            <h3 className="font-bold">Aplicação</h3>
            <p className="mt-1 text-stone-600">Next.js 15 (App Router), React 19, TypeScript e Tailwind, em container Docker.</p>
          </div>
          <div className="rounded-2xl p-5 ring-1 ring-stone-200">
            <h3 className="font-bold">Dados</h3>
            <p className="mt-1 text-stone-600">
              Postgres do Supabase com schema próprio, RLS e triggers que recusam alterar registros de prova.
            </p>
          </div>
          <div className="rounded-2xl p-5 ring-1 ring-stone-200">
            <h3 className="font-bold">Vídeo e documentos</h3>
            <p className="mt-1 text-stone-600">HLS adaptativo (hls.js) para 4G fraco, PDFs com react-pdf e planilhas com ExcelJS.</p>
          </div>
        </div>
      </section>

      <footer className="bg-tinta text-stone-400">
        <div className="faixa-seguranca h-1.5" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
          <Logo claro />
          <p>Integração de segurança para motoristas externos</p>
        </div>
      </footer>
    </div>
  );
}
