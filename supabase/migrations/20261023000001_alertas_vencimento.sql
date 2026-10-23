-- Aviso por WhatsApp quando a integração de um motorista vence.

alter table app.empresas add column if not exists whatsapp_alertas text;
comment on column app.empresas.whatsapp_alertas is
  'Números com DDI, separados por vírgula, que recebem o aviso de integração vencida (para barrar o motorista).';

create table app.alertas_vencimento (
  comprovante_id uuid primary key references app.comprovantes(id),
  empresa_id uuid not null references app.empresas(id),
  status text not null check (status in ('enviando', 'enviado', 'erro')),
  destinos text not null,
  tentativas int not null default 0,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
comment on table app.alertas_vencimento is 'Um aviso por comprovante vencido: impede mensagens repetidas e guarda falhas para nova tentativa.';
create index alertas_vencimento_empresa on app.alertas_vencimento (empresa_id, criado_em desc);

alter table app.alertas_vencimento enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema app from anon, authenticated;
  end if;
end
$$;
