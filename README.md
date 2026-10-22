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

São dois ambientes independentes, cada um com seu banco e seu projeto na Vercel:

| Ambiente | Banco | `DEMO_MODE` | Endereço (exemplo) |
|---|---|---|---|
| Cliente | database só do cliente | `false` | `https://integra.suaempresa.com.br` |
| Portfólio | database só do demo | `true` | `https://demo.integra.suaempresa.com.br` |

1. **Banco na VPS**: um Supabase só para o Integra, com o Postgres acessível pela internet com SSL (a Vercel conecta de fora). Crie dois databases, um para o cliente e um para o demo.
2. **Arquivos de conexão** (ficam só na sua máquina; `.env*.local` está no `.gitignore`):
   ```bash
   # .env.producao.local
   DATABASE_URL=postgres://USUARIO:SENHA@HOST:5432/integra?sslmode=require
   ADMIN_SENHA=senha-inicial-do-admin
   # .env.demo.local
   DATABASE_URL=postgres://USUARIO:SENHA@HOST:5432/integra_demo?sslmode=require
   ```
   Use a porta direta do Postgres (5432). O pooler do Supabase (6543) também serve, desde que esteja configurado para esse database.
3. **Migrar e preparar** (os scripts mostram só o host, nunca a senha):
   ```bash
   ENV_FILE=.env.producao.local npm run db:migrate
   ENV_FILE=.env.producao.local npm run db:seed -- empresa "Nome da Empresa" "Portaria Principal" "Nome do Admin" admin@empresa.com.br
   ENV_FILE=.env.demo.local npm run db:migrate
   ENV_FILE=.env.demo.local npm run db:seed -- demo
   ```
4. **Vercel**: importe o repositório duas vezes (um projeto por ambiente). Em cada um defina `DATABASE_URL`, `AUTH_SECRET` (um diferente por projeto; gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `APP_URL` com o domínio do ambiente e `DEMO_MODE`. As funções rodam em São Paulo (`gru1`, em `vercel.json`) para ficar perto da VPS.
5. **Domínio**: em *Settings → Domains* de cada projeto, adicione o subdomínio e crie no DNS o `CNAME` que a Vercel indicar.
6. **Vídeo**: converta para HLS e suba a pasta gerada num bucket público do Storage do Supabase:
   ```bash
   npm run video:preparar -- video-integracao.mp4
   ```
7. **No painel do cliente**: troque a senha em **Minha senha**, cole o link do `master.m3u8` em **Vídeo e perguntas**, detecte a duração, cadastre as perguntas e publique. Imprima o cartaz em **Portaria**.

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
