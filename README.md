# Integra · Integração de segurança para motoristas externos

Sistema web para **documentar, de forma difícil de contestar, que cada motorista terceirizado foi instruído sobre as regras de segurança antes de entrar na área** (mineração, pedreiras, indústria).

O motorista recebe um link pelo WhatsApp (ou lê o QR Code da portaria), assiste a um vídeo que **não pode ser pulado**, responde perguntas de verificação, assina um termo de ciência com o dedo e recebe um comprovante com código e QR Code. A segurança do trabalho acompanha tudo num painel; a portaria consulta a placa e vê na hora se o motorista pode entrar.

> **Por quê:** se um motorista externo causa um acidente e a empresa não consegue provar que ele foi instruído, ela também responde. Uma planilha dizendo "assistiu" vale pouco. Aqui, cada passo fica gravado com o horário do servidor e encadeado por SHA-256, e qualquer alteração posterior é detectada.

## Demonstração

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Sem configurar nada, o sistema sobe com um Postgres embutido (PGlite) e uma empresa fictícia (**Mineração Demo**) com dois meses de histórico:

- **Fazer como motorista**: percorre o fluxo inteiro no celular (vídeo demo de 48 s).
- **Ver o painel**: entrada com um clique como Administrador, Segurança ou Portaria.
- **/v**: verificação pública de comprovantes.

## O que o sistema faz

### Fluxo do motorista (celular, sem instalar nada)

1. **Boas-vindas**: confirma que o veículo está parado (um sistema de segurança não pode incentivar o uso do celular ao volante).
2. **Identificação**: nome, CPF (validado), placa (antiga e Mercosul), transportadora e aceite de privacidade (LGPD). Se o CPF já tem integração válida, mostra o comprovante em vez de refazer.
3. **Vídeo travado**: sem pausar, adiantar, acelerar, baixar ou picture-in-picture. Trocar de app ou bloquear o celular pausa o vídeo e registra a saída. Tela cheia, tela sempre ligada (Wake Lock), legenda e retomada de onde parou se a internet cair.
4. **Perguntas**: errou, a tela fica com **borda vermelha**, treme e vibra, e o motorista não sai da pergunta até acertar (com 3 s de espera entre tentativas para desestimular o chute). Alternativas embaralhadas e, opcionalmente, sorteio de N perguntas de um banco maior, para evitar a "cola" no grupo. Botão para ouvir a pergunta.
5. **Termo de ciência** com assinatura pelo dedo.
6. **Comprovante** com código (ex.: `GF5Q-9Y6B`), QR Code de verificação e PDF.

### Painel (segurança do trabalho e portaria)

| Tela | Para quê |
|---|---|
| Visão geral | Integrações do dia e do mês, motoristas liberados, vencimentos, **funil** (onde os motoristas param), **perguntas que mais erram**, transportadoras |
| Enviar link | Link único por motorista e botão que abre o WhatsApp com a mensagem pronta (`wa.me`); reenvio; situação de cada link |
| Portaria | Placa, CPF ou nome e a resposta em tela cheia: **pode entrar** (verde) ou **não** (vermelho); "conferi pessoalmente" registra o porteiro como testemunha; **cartaz com QR Code** por unidade para imprimir |
| Motoristas | Busca, filtros por situação e transportadora, histórico de cada motorista |
| Integração | **Linha do tempo** completa (link gerado, aberto, vídeo, saídas da tela, cada resposta, assinatura), estado da trilha de auditoria, comprovante e **dossiê em PDF para o jurídico** |
| Vídeo e perguntas | Editor com rascunho e publicação. **Versão publicada fica congelada** no banco; cada comprovante aponta para a versão exata vista. Detecção automática da duração. Opção de invalidar integrações anteriores quando a regra muda |
| Relatórios | Filtros por período, unidade, transportadora e situação; exporta **Excel** e **PDF** |
| Configurações | Empresa, cor, mensagem do WhatsApp, validade do link, unidades e usuários (perfis Admin, Segurança e Portaria) |

## Como a prova é garantida

```mermaid
flowchart LR
  subgraph Celular
    P[Player sem controles] -- "sinal a cada 10 s" --> API
    Q[Perguntas] --> API
    A[Assinatura] --> API
  end
  API[Route Handlers do Next] -->|valida token, tempo real e etapa| S[(Postgres)]
  S --> E["app.eventos<br/>só inserção<br/>hash = SHA-256(anterior + evento)"]
  E --> C[Comprovante<br/>hash dos dados + corrente]
  C --> V["/v/código<br/>verificação pública"]
```

- **O servidor decide que o vídeo acabou, não o celular.** Cada sinal do player só pode avançar o progresso o quanto passou de tempo real desde o sinal anterior (`src/lib/video.ts`). Adiantar o vídeo pelo navegador ou chamar a API direto não adianta: as perguntas continuam bloqueadas.
- **Trilha de auditoria encadeada.** Cada evento guarda o SHA-256 do anterior (`src/lib/hash.ts`). Mudar, apagar ou reordenar qualquer registro quebra a corrente, e a página de verificação mostra "não confere".
- **O banco recusa alterar registros de prova.** Triggers bloqueiam `UPDATE`, `DELETE` e `TRUNCATE` em eventos, respostas, assinaturas e comprovantes, e versões publicadas do conteúdo não podem ser editadas.
- **Conteúdo com hash.** O comprovante leva o SHA-256 do vídeo, perguntas e termo daquela versão.
- **Horário do servidor**, IP e aparelho em cada evento; o porteiro pode registrar que viu o motorista.

> A assinatura eletrônica simples é aceita entre particulares (MP 2.200-2/2001, art. 10, §2º) e o processo admite qualquer meio de prova legítimo (CPC, art. 369). **O texto do termo e o prazo de guarda dos dados devem ser validados pelo jurídico e pelo SESMT do cliente.**

## Stack

- **Next.js 15** (App Router, Server Actions, Route Handlers), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Postgres** do Supabase (schema próprio `app`, RLS ligado, triggers de imutabilidade) via `postgres.js`; **PGlite** embutido para desenvolvimento, demo e testes
- **hls.js** (vídeo adaptativo 360p/720p para 4G fraco), **signature_pad**, **qrcode**
- **@react-pdf/renderer** (comprovante, dossiê e relatório), **ExcelJS**
- **jose** + **bcryptjs** (sessão do painel em cookie httpOnly), **zod**
- **Vitest** (regras e fluxo completo contra um Postgres real em memória)

## Estrutura

```
src/
  app/
    i/[token]/            fluxo do motorista (link único)
    entrada/[unidade]/    entrada pelo QR Code da portaria
    v/[codigo]/           verificação pública do comprovante
    painel/               dashboard, links, portaria, motoristas, conteúdo, relatórios, configurações
    api/i/[token]/...     etapas do motorista (início, identificação, vídeo, resposta, assinatura, PDF)
    api/painel/...        comprovante/dossiê em PDF e relatório Excel/PDF
  components/motorista/   player travado, quiz, assinatura, comprovante
  lib/
    integracao/servico.ts máquina de etapas + trilha de auditoria
    video.ts, hash.ts     regras anti-fraude (testadas)
    painel/consultas.ts   consultas do painel
    pdf/documentos.tsx    comprovante, dossiê e relatório
    db/index.ts           Postgres do Supabase ou PGlite
supabase/migrations/      schema, triggers e view de situação
scripts/                  migração, cadastro de empresa e preparo do vídeo
tests/                    regras + fluxo completo com adulteração simulada
```

## Colocando em produção (Vercel + Supabase da VPS)

1. **Banco**: com a connection string do Postgres do Supabase (de preferência o pooler, porta 6543):
   ```bash
   DATABASE_URL=postgres://... npm run db:migrate
   DATABASE_URL=postgres://... npm run db:seed -- empresa "Nome da Empresa" "Portaria Principal" "Nome do Admin" admin@empresa.com.br
   ```
2. **Vídeo**: converta para HLS e suba a pasta gerada num bucket público do Storage:
   ```bash
   npm run video:preparar -- video-integracao.mp4
   ```
3. **Vercel**: importe o repositório e defina `DATABASE_URL`, `AUTH_SECRET` (32+ caracteres aleatórios), `APP_URL` (ex.: `https://integra.suaempresa.com.br`) e `DEMO_MODE=false`.
4. No painel: **Vídeo e perguntas**, cole o link do `master.m3u8`, detecte a duração, cadastre as perguntas e publique. Imprima o cartaz da portaria em **Portaria**.

Para um deploy de portfólio separado, use outro banco com `npm run db:seed -- demo` e `DEMO_MODE=true`.

## Testes

```bash
npm test          # regras do vídeo, hash, quiz, validações e o fluxo completo em Postgres embutido
npm run typecheck
npm run lint
```

O teste de fluxo cobre: tentar pular o vídeo (recusado), responder antes do fim (bloqueado), sair da tela (não conta tempo), errar e ficar na pergunta, responder rápido demais após erro (429), comprovante autêntico, CPF com integração vigente e **adulteração direta no banco detectada pela verificação**.

## Próximos passos possíveis

- Envio automático do link e lembretes pela API de WhatsApp (ex.: uazapi), sem mudar a estrutura.
- Carimbo do tempo RFC 3161 no comprovante.
- Portal da transportadora para acompanhar os próprios motoristas.
- Outros públicos com o mesmo motor (visitantes, prestadores de serviço).
