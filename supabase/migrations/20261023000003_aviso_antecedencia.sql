-- Aviso prévio: alguns dias antes de a integração vencer (para a portaria e, opcionalmente, para o motorista).

alter table app.empresas add column if not exists aviso_antecedencia_dias int not null default 15
  check (aviso_antecedencia_dias between 0 and 90);
alter table app.empresas add column if not exists avisar_motorista boolean not null default false;
comment on column app.empresas.aviso_antecedencia_dias is 'Dias antes do vencimento para o aviso prévio (0 = sem aviso prévio).';
comment on column app.empresas.avisar_motorista is 'No aviso prévio, também manda ao motorista um link novo para refazer a integração.';

-- Um aviso de cada tipo por comprovante.
alter table app.alertas_vencimento add column if not exists tipo text not null default 'vencimento'
  check (tipo in ('vencimento', 'antecedencia'));
alter table app.alertas_vencimento drop constraint if exists alertas_vencimento_pkey;
alter table app.alertas_vencimento add primary key (comprovante_id, tipo);
