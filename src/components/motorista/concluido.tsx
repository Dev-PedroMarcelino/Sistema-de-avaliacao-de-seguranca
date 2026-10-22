"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CircleCheckBig, Clock4, Download, ShieldCheck } from "lucide-react";
import { classesBotao } from "@/components/ui";
import { data, dataHora } from "@/lib/formato";

interface Comprovante {
  codigo: string;
  nome: string;
  emitidoEm: string;
  vigenteAte: string;
  vigente: boolean;
}

export function Concluido({ token, comprovante, jaValida }: { token: string; comprovante: Comprovante; jaValida: boolean }) {
  const [qr, setQr] = useState("");
  const urlVerificacao = typeof window !== "undefined" ? `${window.location.origin}/v/${comprovante.codigo}` : "";

  useEffect(() => {
    if (urlVerificacao) void QRCode.toDataURL(urlVerificacao, { margin: 1, width: 360 }).then(setQr);
  }, [urlVerificacao]);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl bg-green-700 text-white shadow-lg">
        <div className="flex flex-col items-center px-6 pb-6 pt-7 text-center">
          <CircleCheckBig className="h-16 w-16" strokeWidth={2.2} />
          <h1 className="mt-3 text-[26px] font-extrabold leading-tight">
            {jaValida ? "Você já tem integração válida" : "Integração concluída"}
          </h1>
          <p className="mt-1 text-lg font-semibold text-green-100">{comprovante.nome}</p>
        </div>
        <div className="bg-white px-6 py-5 text-center text-tinta">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-500">Código do comprovante</p>
          <p className="mt-1 font-mono text-4xl font-black tracking-wider">{comprovante.codigo}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR Code para conferir o comprovante" className="mx-auto mt-4 h-44 w-44" />
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[15px] font-semibold text-green-800">
            <Clock4 className="h-4 w-4" /> Válida até {data(comprovante.vigenteAte)}
          </p>
          <p className="mt-1 text-xs text-stone-500">Emitido em {dataHora(comprovante.emitidoEm)}</p>
        </div>
      </div>

      <p className="rounded-2xl bg-marca/20 px-4 py-3 text-center text-[15px] font-bold text-tinta">
        Mostre esta tela na portaria.
      </p>

      <a href={`/api/i/${token}/comprovante`} className={classesBotao("primario", "lg")}>
        <Download className="h-5 w-5" /> Baixar comprovante (PDF)
      </a>
      <a href={`/v/${comprovante.codigo}`} className={classesBotao("contorno", "lg")}>
        <ShieldCheck className="h-5 w-5" /> Conferir autenticidade
      </a>
    </div>
  );
}

export function LinkExpirado({ empresa }: { empresa: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Clock4 className="h-14 w-14 text-stone-400" />
      <h1 className="text-2xl font-extrabold">Este link expirou</h1>
      <p className="text-stone-600">Peça um novo link para a portaria ou para a segurança da {empresa}.</p>
    </div>
  );
}
