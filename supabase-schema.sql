-- Bera Bera Senior — esquema de Supabase
-- Pega esto entero en el SQL Editor de tu proyecto de Supabase y dale a "Run".

create table players (
  id text primary key,
  name text not null,
  position text not null check (position in ('player', 'goalkeeper')),
  number integer not null,
  active boolean not null default true
);

create table seasons (
  id text primary key,
  name text not null,
  "startDate" date not null,
  "closedAt" bigint
);

create table matches (
  id text primary key,
  opponent text not null,
  date date not null,
  competition text not null,
  "isHome" boolean not null,
  "calledPlayerIds" text[] not null default '{}',
  status text not null check (status in ('scheduled', 'live', 'finished')),
  clock jsonb not null,
  "createdAt" bigint not null,
  "seasonId" text references seasons(id)
);

create table events (
  id text primary key,
  "matchId" text not null references matches(id) on delete cascade,
  "playerId" text not null,
  timestamp integer not null,
  "eventType" text not null,
  "eventData" jsonb
);

-- Cualquiera puede leer (ver estadísticas); solo una sesión con el PIN
-- desbloqueado (usuario autenticado) puede crear, editar o borrar.
alter table players enable row level security;
alter table seasons enable row level security;
alter table matches enable row level security;
alter table events enable row level security;

create policy "public read players" on players for select using (true);
create policy "auth insert players" on players for insert with check (auth.role() = 'authenticated');
create policy "auth update players" on players for update using (auth.role() = 'authenticated');
create policy "auth delete players" on players for delete using (auth.role() = 'authenticated');

create policy "public read seasons" on seasons for select using (true);
create policy "auth insert seasons" on seasons for insert with check (auth.role() = 'authenticated');
create policy "auth update seasons" on seasons for update using (auth.role() = 'authenticated');
create policy "auth delete seasons" on seasons for delete using (auth.role() = 'authenticated');

create policy "public read matches" on matches for select using (true);
create policy "auth insert matches" on matches for insert with check (auth.role() = 'authenticated');
create policy "auth update matches" on matches for update using (auth.role() = 'authenticated');
create policy "auth delete matches" on matches for delete using (auth.role() = 'authenticated');

create policy "public read events" on events for select using (true);
create policy "auth insert events" on events for insert with check (auth.role() = 'authenticated');
create policy "auth update events" on events for update using (auth.role() = 'authenticated');
create policy "auth delete events" on events for delete using (auth.role() = 'authenticated');

-- Plantilla inicial: porteros con dorsal 1-3, jugadores de campo 4-19.
insert into players (id, name, position, number, active) values
  ('ander-etxeberria', 'Ander Etxeberria', 'player', 4, true),
  ('markel-monreal', 'Markel Monreal', 'player', 5, true),
  ('julen-iraola', 'Julen Iraola', 'player', 6, true),
  ('iker-goni', 'Iker Goñi', 'player', 7, true),
  ('aimar-barrenetxea', 'Aimar Barrenetxea', 'player', 8, true),
  ('amaiur-milla', 'Amaiur Milla', 'player', 9, true),
  ('urko-murgiondo', 'Urko Murgiondo', 'player', 10, true),
  ('unax-gillenea', 'Unax Gillenea', 'player', 11, true),
  ('aner-leunda', 'Aner Leunda', 'player', 12, true),
  ('juan-berregui', 'Juan Berregui', 'player', 13, true),
  ('mikel-gillenea', 'Mikel Gillenea', 'player', 14, true),
  ('mikel-cubillo', 'Mikel Cubillo', 'player', 15, true),
  ('ander-eceiza', 'Ander Eceiza', 'player', 16, true),
  ('aimar-ayestaran', 'Aimar Ayestaran', 'player', 17, true),
  ('benat-bastarrika', 'Beñat Bastarrika', 'player', 18, true),
  ('ibai-oyarzabal', 'Ibai Oyarzabal', 'player', 19, true),
  ('ekaitz-urrutia', 'Ekaitz Urrutia', 'goalkeeper', 1, true),
  ('oier-villoslada', 'Oier Villoslada', 'goalkeeper', 2, true),
  ('markel-echeverria', 'Markel Echeverria', 'goalkeeper', 3, true);

-- Temporada activa inicial (formato "2026/2027", calculado a partir de hoy).
insert into seasons (id, name, "startDate", "closedAt")
select
  'season-initial',
  case
    when extract(month from current_date) >= 7
      then extract(year from current_date)::text || '/' || (extract(year from current_date)::int + 1)::text
    else (extract(year from current_date)::int - 1)::text || '/' || extract(year from current_date)::text
  end,
  current_date,
  null;
