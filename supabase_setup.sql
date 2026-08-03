-- Ejecutar en Supabase: Project -> SQL Editor -> New query
-- Tabla opcional para guardar el progreso del personaje en la nube (además del
-- localStorage del celular). El juego funciona igual sin esto: si no existe la
-- tabla o falla el guardado, simplemente sigue usando localStorage.

create table if not exists personajes (
  id text primary key,
  nombre text,
  nivel integer default 1,
  xp integer default 0,
  arma_id text,
  armadura_id text,
  materiales integer default 0,
  actualizado_en timestamptz default now()
);

-- Como es un juego gratuito sin login, se usa la clave anónima pública para leer
-- y escribir. Para un prototipo esto es suficiente; si más adelante agregás
-- login de usuarios, conviene restringir estas políticas por user_id.
alter table personajes enable row level security;

create policy "Cualquiera puede leer personajes"
  on personajes for select
  using (true);

create policy "Cualquiera puede guardar su personaje"
  on personajes for insert
  with check (true);

create policy "Cualquiera puede actualizar personajes"
  on personajes for update
  using (true);
