-- Añade la columna "link" a la tabla matches ya existente.
-- Pégalo en el SQL Editor de tu proyecto de Supabase y dale a "Run".
-- Necesario para poder guardar un enlace (vídeo, resumen...) en cada partido.

alter table matches add column if not exists link text;
