-- Instância de WhatsApp (uazapi) própria de cada empresa, conectada pelo painel com QR Code.

alter table app.empresas add column if not exists whatsapp_instancia text;
alter table app.empresas add column if not exists whatsapp_token text;
comment on column app.empresas.whatsapp_instancia is 'Nome da instância uazapi criada pelo painel.';
comment on column app.empresas.whatsapp_token is 'Token da instância uazapi (segredo: nunca enviado ao navegador).';
