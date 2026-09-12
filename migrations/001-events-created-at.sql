-- Añade la columna "createdAt" a la tabla events ya existente.
-- Pégalo en el SQL Editor de tu proyecto de Supabase y dale a "Run".
-- Necesario para que "Deshacer" siga funcionando después de recargar la página.

alter table events add column if not exists "createdAt" bigint;
