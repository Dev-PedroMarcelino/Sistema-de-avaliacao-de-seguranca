-- Integra: integração de segurança para motoristas externos.
-- Tudo fica no schema "app", que o PostgREST do Supabase não expõe.
-- O servidor Next conecta direto (dono das tabelas); anon e authenticated não têm acesso.

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Empresas, unidades e usuários do painel (multiempresa desde o início)
-- ---------------------------------------------------------------------------

create table app.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  cor text not null default '#f59e0b',
  mensagem_whatsapp text not null default 'Olá, {nome}! Antes de entrar na {empresa}, faça a integração de segurança: um vídeo curto e 3 perguntas. Faça com o veículo parado. Sem ela a entrada não é liberada: {link}',
  validade_link_dias int not null default 15 check (validade_link_dias between 1 and 90),
  criado_em timestamptz not null default now()
);
comment on table app.empresas is 'Cliente que usa o sistema (ex.: a mineradora).';

create table app.unidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references app.empresas(id) on delete cascade,
  nome text not null,
  slug text not null unique,
  criado_em timestamptz not null default now()
);
comment on table app.unidades is 'Local físico com portaria (cada uma tem seu QR Code de entrada).';

create table app.usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references app.empresas(id) on delete cascade,
  nome text not null,
  email text not null unique check (email = lower(email)),
  senha_hash text not null,
  perfil text not null check (perfil in ('admin', 'seguranca', 'portaria')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  ultimo_acesso_em timestamptz
);
comment on table app.usuarios is 'Quem acessa o painel. admin: tudo; seguranca: tudo menos usuários; portaria: consulta e links.';

create table app.transportadoras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references app.empresas(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);
create unique index transportadoras_nome_unico on app.transportadoras (empresa_id, lower(nome));

create table app.motoristas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references app.empresas(id) on delete cascade,
  nome text not null,
  cpf text not null check (cpf ~ '^[0-9]{11}$'),
  telefone text not null check (telefone ~ '^[0-9]{12,13}$'),
  transportadora_id uuid references app.transportadoras(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, cpf)
);
comment on column app.motoristas.cpf is 'Só dígitos. Mascarado nas telas, completo apenas no dossiê.';
comment on column app.motoristas.telefone is 'Só dígitos, com DDI 55.';

-- ---------------------------------------------------------------------------
-- Treinamento e versões (o conteúdo publicado é congelado)
-- ---------------------------------------------------------------------------

create table app.treinamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references app.empresas(id) on delete cascade,
  titulo text not null,
  publico text not null default 'motoristas',
  validade_dias int not null default 365 check (validade_dias between 1 and 1825),
  criado_em timestamptz not null default now()
);

create table app.versoes (
  id uuid primary key default gen_random_uuid(),
  treinamento_id uuid not null references app.treinamentos(id) on delete cascade,
  numero int not null,
  video_url text not null default '',
  legenda_url text,
  duracao_seg double precision not null default 0,
  termo text not null,
  perguntas jsonb not null default '[]',
  perguntas_por_integracao int,
  invalida_anteriores boolean not null default false,
  conteudo_hash text,
  publicada_em timestamptz,
  publicada_por uuid references app.usuarios(id),
  criado_em timestamptz not null default now(),
  unique (treinamento_id, numero)
);
comment on column app.versoes.perguntas is '[{id, texto, alternativas: [{id, texto}], correta: id da alternativa}]';
comment on column app.versoes.perguntas_por_integracao is 'Quantas perguntas sortear do banco. Nulo = todas, na ordem.';
comment on column app.versoes.invalida_anteriores is 'Se verdadeiro, ao publicar, comprovantes anteriores deixam de valer.';
comment on column app.versoes.conteudo_hash is 'SHA-256 do conteúdo publicado: prova qual vídeo e quais perguntas o motorista viu.';

-- ---------------------------------------------------------------------------
-- Integração: um link (ou uma entrada pelo QR) = uma integração
-- ---------------------------------------------------------------------------

create table app.integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references app.empresas(id) on delete cascade,
  unidade_id uuid not null references app.unidades(id),
  treinamento_id uuid not null references app.treinamentos(id),
  versao_id uuid references app.versoes(id),
  token text not null unique,
  origem text not null check (origem in ('link', 'qr')),
  nome_informado text,
  telefone text not null check (telefone ~ '^[0-9]{12,13}$'),
  transportadora_informada text,
  criado_por uuid references app.usuarios(id),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  etapa text not null default 'boas_vindas'
    check (etapa in ('boas_vindas', 'identificacao', 'video', 'quiz', 'termo', 'concluida', 'ja_valida')),
  motorista_id uuid references app.motoristas(id),
  placa text,
  transportadora_id uuid references app.transportadoras(id),
  perguntas_ids jsonb,
  aberto_em timestamptz,
  iniciado_em timestamptz,
  identificado_em timestamptz,
  video_iniciado_em timestamptz,
  video_concluido_em timestamptz,
  quiz_concluido_em timestamptz,
  concluida_em timestamptz,
  progresso_seg double precision not null default 0,
  ultimo_sinal_em timestamptz,
  saidas_tela int not null default 0,
  comprovante_vigente_id uuid,
  conferido_por uuid references app.usuarios(id),
  conferido_em timestamptz
);
comment on column app.integracoes.progresso_seg is 'Ponto do vídeo validado pelo servidor (nunca avança mais rápido que o relógio).';
comment on column app.integracoes.ultimo_sinal_em is 'Último sinal do player enquanto assistindo. Nulo = pausado (saiu da tela).';
comment on column app.integracoes.comprovante_vigente_id is 'Quando o CPF já tinha integração válida (etapa ja_valida).';
create index integracoes_empresa_criado on app.integracoes (empresa_id, criado_em desc);
create index integracoes_motorista on app.integracoes (motorista_id);
create index integracoes_placa on app.integracoes (empresa_id, placa);

-- ---------------------------------------------------------------------------
-- Registros de prova: só inserção, nunca alteração
-- ---------------------------------------------------------------------------

create table app.eventos (
  id bigint generated always as identity primary key,
  integracao_id uuid not null references app.integracoes(id),
  seq int not null,
  tipo text not null,
  dados jsonb not null default '{}',
  ocorrido_em timestamptz not null,
  ip text,
  user_agent text,
  hash_anterior text,
  hash text not null,
  unique (integracao_id, seq)
);
comment on table app.eventos is 'Trilha de auditoria. Cada evento guarda o SHA-256 do anterior: qualquer alteração quebra a corrente.';

create table app.respostas (
  id bigint generated always as identity primary key,
  integracao_id uuid not null references app.integracoes(id),
  pergunta_id text not null,
  alternativa_id text not null,
  correta boolean not null,
  tentativa int not null,
  respondida_em timestamptz not null
);
create index respostas_integracao on app.respostas (integracao_id, pergunta_id);

create table app.assinaturas (
  integracao_id uuid primary key references app.integracoes(id),
  imagem text not null,
  termo_texto text not null,
  termo_hash text not null,
  assinada_em timestamptz not null,
  ip text,
  user_agent text
);

create table app.comprovantes (
  id uuid primary key default gen_random_uuid(),
  integracao_id uuid not null unique references app.integracoes(id),
  empresa_id uuid not null references app.empresas(id),
  motorista_id uuid not null references app.motoristas(id),
  versao_id uuid not null references app.versoes(id),
  codigo text not null unique,
  emitido_em timestamptz not null,
  valido_ate timestamptz not null,
  dados jsonb not null,
  evento_seq int not null,
  hash_corrente text not null,
  hash text not null
);
comment on column app.comprovantes.hash is 'SHA-256 de (dados canônicos | hash_corrente). Conferido na página pública /v/{codigo}.';
create index comprovantes_motorista on app.comprovantes (motorista_id, emitido_em desc);
create index comprovantes_empresa on app.comprovantes (empresa_id, emitido_em desc);

create or replace function app.impedir_alteracao() returns trigger language plpgsql as $$
begin
  raise exception 'Registro de prova não pode ser alterado nem apagado (tabela %).', tg_table_name;
end
$$;

create trigger eventos_imutaveis before update or delete on app.eventos
  for each row execute function app.impedir_alteracao();
create trigger eventos_sem_truncate before truncate on app.eventos
  for each statement execute function app.impedir_alteracao();
create trigger respostas_imutaveis before update or delete on app.respostas
  for each row execute function app.impedir_alteracao();
create trigger assinaturas_imutaveis before update or delete on app.assinaturas
  for each row execute function app.impedir_alteracao();
create trigger comprovantes_imutaveis before update or delete on app.comprovantes
  for each row execute function app.impedir_alteracao();

create or replace function app.proteger_versao_publicada() returns trigger language plpgsql as $$
begin
  if old.publicada_em is not null then
    raise exception 'Versão publicada não pode ser alterada nem apagada. Crie uma nova versão.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger versoes_congeladas before update or delete on app.versoes
  for each row execute function app.proteger_versao_publicada();

-- ---------------------------------------------------------------------------
-- Situação de cada comprovante (vence pela validade ou por nova versão obrigatória)
-- ---------------------------------------------------------------------------

create view app.comprovantes_situacao as
select
  c.*,
  v.treinamento_id,
  least(
    c.valido_ate,
    (select min(n.publicada_em)
       from app.versoes n
      where n.treinamento_id = v.treinamento_id
        and n.invalida_anteriores
        and n.publicada_em > c.emitido_em)
  ) as vigente_ate
from app.comprovantes c
join app.versoes v on v.id = c.versao_id;

-- ---------------------------------------------------------------------------
-- Segurança: RLS ligado e nada liberado para os papéis públicos do Supabase
-- ---------------------------------------------------------------------------

alter table app.empresas enable row level security;
alter table app.unidades enable row level security;
alter table app.usuarios enable row level security;
alter table app.transportadoras enable row level security;
alter table app.motoristas enable row level security;
alter table app.treinamentos enable row level security;
alter table app.versoes enable row level security;
alter table app.integracoes enable row level security;
alter table app.eventos enable row level security;
alter table app.respostas enable row level security;
alter table app.assinaturas enable row level security;
alter table app.comprovantes enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema app from anon, authenticated;
    revoke usage on schema app from anon, authenticated;
  end if;
end
$$;
