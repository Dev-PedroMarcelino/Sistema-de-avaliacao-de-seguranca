import type { Metadata } from "next";
import { Fluxo } from "@/components/motorista/fluxo";

export const metadata: Metadata = {
  title: "Integração de segurança",
  robots: { index: false, follow: false },
};

export default async function Pagina({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Fluxo token={token} />;
}
