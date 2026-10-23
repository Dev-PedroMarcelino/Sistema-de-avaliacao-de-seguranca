-- O motorista pode chegar com vários caminhões e por várias transportadoras.
-- A integração vale para o motorista (CPF); placas e transportadoras ficam no cadastro dele.

create table app.motorista_placas (
  motorista_id uuid not null references app.motoristas(id) on delete cascade,
  placa text not null check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  origem text not null default 'integracao' check (origem in ('integracao', 'painel')),
  criado_em timestamptz not null default now(),
  primary key (motorista_id, placa)
);
create index motorista_placas_placa on app.motorista_placas (placa);
comment on table app.motorista_placas is 'Placas com que o motorista já entrou ou que foram vinculadas a ele no painel.';

create table app.motorista_transportadoras (
  motorista_id uuid not null references app.motoristas(id) on delete cascade,
  transportadora_id uuid not null references app.transportadoras(id) on delete cascade,
  origem text not null default 'integracao' check (origem in ('integracao', 'painel')),
  criado_em timestamptz not null default now(),
  primary key (motorista_id, transportadora_id)
);
comment on table app.motorista_transportadoras is 'Transportadoras pelas quais o motorista já veio.';

-- Traz o histórico das integrações já feitas.
insert into app.motorista_placas (motorista_id, placa, criado_em)
select motorista_id, placa, min(criado_em) from app.integracoes
 where motorista_id is not null and placa is not null group by motorista_id, placa
on conflict do nothing;

insert into app.motorista_transportadoras (motorista_id, transportadora_id, criado_em)
select motorista_id, transportadora_id, min(criado_em) from app.integracoes
 where motorista_id is not null and transportadora_id is not null group by motorista_id, transportadora_id
on conflict do nothing;

insert into app.motorista_transportadoras (motorista_id, transportadora_id)
select id, transportadora_id from app.motoristas where transportadora_id is not null
on conflict do nothing;

alter table app.motorista_placas enable row level security;
alter table app.motorista_transportadoras enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema app from anon, authenticated;
  end if;
end
$$;
