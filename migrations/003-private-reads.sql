-- Hace la app privada: a partir de ahora LEER (ver partidos, jugadores y
-- estadísticas) también requiere haber entrado con el PIN, no solo escribir.
-- Pégalo en el SQL Editor de tu proyecto de Supabase y dale a "Run".

drop policy if exists "public read players" on players;
drop policy if exists "public read seasons" on seasons;
drop policy if exists "public read matches" on matches;
drop policy if exists "public read events" on events;

create policy "auth read players" on players for select using (auth.role() = 'authenticated');
create policy "auth read seasons" on seasons for select using (auth.role() = 'authenticated');
create policy "auth read matches" on matches for select using (auth.role() = 'authenticated');
create policy "auth read events" on events for select using (auth.role() = 'authenticated');
