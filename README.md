# Bera Bera Senior — Estadísticas

Webapp para anotar en directo y consultar las estadísticas del equipo senior del Bera Bera. Pensada para usarse desde el banquillo en una tablet durante el partido, y para que cualquiera pueda consultar el historial de resultados y stats desde el móvil o el ordenador.

En producción: [berabera-senior-stats.vercel.app](https://berabera-senior-stats.vercel.app)

## Cómo funciona

- **Lectura pública, escritura con PIN.** Cualquiera puede entrar y ver partidos, jugadores y estadísticas sin iniciar sesión. Para crear partidos, anotar en directo o editar cualquier cosa hace falta el PIN compartido del equipo (botón "Anotar" en la barra de navegación).
- **Todo se calcula a partir de eventos.** No se guarda "goles", "minutos jugados" ni ningún resultado como un campo suelto — cada acción del partido (lanzamiento, cambio, tarjeta...) se registra como un evento con su marca de tiempo, y todas las estadísticas (marcador, minutos, % de acierto, zonas de lanzamiento...) se recalculan al vuelo a partir de esos eventos. Esto hace que editar o borrar un evento antiguo actualice automáticamente todo lo demás, sin inconsistencias.
- **Funciona sin conexión.** Anotar un partido no depende de tener wifi en el pabellón: cada acción se guarda al momento en el dispositivo y se sube a Supabase en segundo plano; si no hay red, se encola y se reintenta sola en cuanto vuelve la conexión (o cada 20s). El indicador "Sin conexión · X sin subir" de la barra lateral avisa de si queda algo por subir.
- **Instalable como app.** Es una PWA: se puede "Añadir a pantalla de inicio" en el iPad/móvil y se abre a pantalla completa, sin la barra del navegador.

## Stack

- **Vite + React 19 + TypeScript** — build rápido, sin necesidad de servidor propio (todo corre en el cliente).
- **React Router** para la navegación, con cada pantalla cargada bajo demanda (`React.lazy`) para que la primera carga no tenga que descargar toda la app de golpe.
- **Zustand** para el estado: `useAppData` (datos globales), `useLiveMatchStore` (la sesión de anotación en directo), `useAuthStore` (PIN), `useSyncStatus` / la cola offline, `useToast`.
- **Tailwind CSS v4** para los estilos.
- **Supabase** (Postgres + Auth) como backend: tablas `players`, `matches`, `seasons` y `events` (ver `supabase-schema.sql`), con RLS que permite lectura pública y escritura solo a la sesión autenticada. El PIN compartido inicia sesión contra un único usuario fijo (`equipo@berabera-app.local` / `bbs-<PIN>`) — no hay usuarios individuales.
- **vite-plugin-pwa** genera el manifest y el service worker.
- **Vercel** para el hosting y despliegue automático en cada push a `main`.
- Un workflow de GitHub Actions (`.github/workflows/keep-supabase-alive.yml`) hace ping a Supabase un par de veces por semana para que el proyecto gratuito no se pause por inactividad.

## Arquitectura del código

```
src/
  domain/       Tipos: Player, Match, MatchEvent (unión discriminada), MatchClock...
  data/
    supabase/     Repositorios que hablan con Supabase (uno por tabla)
    offline/      Cola de escrituras pendientes + snapshot local para leer offline
    index.ts       Punto único de acceso a los repositorios (dataProvider)
  stats/          Funciones puras: eventos → estadísticas (nunca se guarda nada derivado)
  stores/         Estado de la app (zustand)
  screens/        Una por ruta
  components/     Piezas de UI compartidas entre pantallas
  utils/          Formateo de fechas/tiempo, etiquetas de eventos, ids, haptics...
```

La UI nunca habla con Supabase directamente: todo pasa por `dataProvider` (`src/data/index.ts`), así que cambiar de backend en el futuro sería sustituir esa capa sin tocar pantallas ni lógica de negocio. Toda escritura pasa además por `writeOrQueue` (`src/data/offline/queue.ts`), que aplica el cambio en el estado local al instante y solo si la escritura en Supabase falla la deja en la cola para reintentarla — así anotar en directo nunca se bloquea por la conexión.

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # typecheck + build de producción
npm run lint     # oxlint
```

Hace falta un proyecto de Supabase con el esquema de `supabase-schema.sql` y un `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para que la app tenga datos con los que trabajar; sin ellas, la app sigue arrancando pero no habrá partidos ni jugadores que mostrar.
