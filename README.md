# Guardia de Rohan — Coop

Juego de acción top-down cooperativo (hasta 4 celulares) inspirado en *El Señor de los Anillos:
Las Dos Torres* (PS2): subís de nivel, mejorás arma y armadura, y jugás misiones de oleadas +
jefe final, defensa de base por tiempo, o exterminio de enemigos.

100% gratis para hostear: **GitHub** (código) + **Supabase** (multijugador en tiempo real,
free tier) + **Vercel** (hosting, free tier).

## 1. Requisitos

- Node.js 18 o superior instalado en tu compu ([nodejs.org](https://nodejs.org))
- Una cuenta gratis en [supabase.com](https://supabase.com) (solo si querés multijugador)
- Una cuenta gratis en [vercel.com](https://vercel.com) (para publicarlo online)
- Una cuenta en [github.com](https://github.com)

## 2. Probarlo en tu compu

```bash
npm install
npm run dev
```

Abrí la URL que te muestra la terminal (algo como `http://localhost:5173`). El modo **"Jugar
solo"** funciona sin configurar nada. El modo **"Jugar en grupo"** necesita Supabase (paso 3).

## 3. Configurar Supabase (multijugador gratis)

1. Entrá a [supabase.com](https://supabase.com) → **New project** (el plan gratis alcanza de sobra).
2. Cuando el proyecto esté listo, andá a **Project Settings → API** y copiá:
   - `Project URL`
   - `anon public key`
3. En la carpeta del proyecto, copiá `.env.example` a `.env.local` y pegá esos valores:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anonima
   ```
4. (Opcional pero recomendado) Andá a **SQL Editor** en Supabase, pegá el contenido de
   `supabase_setup.sql` de este proyecto y ejecutalo. Esto crea una tabla para guardar el
   progreso del personaje en la nube. Si no lo hacés, el juego sigue funcionando igual,
   guardando el progreso solo en el celular de cada uno (localStorage).
5. Reiniciá `npm run dev` para que tome las variables nuevas.

Supabase Realtime (lo que usa el multijugador) viene habilitado por defecto, no hay que
prender nada más.

## 4. Subir el código a GitHub

```bash
git init
git add .
git commit -m "Guardia de Rohan - primera versión"
```

Creá un repositorio nuevo en GitHub y seguí las instrucciones que te da para conectar tu
repo local (`git remote add origin ...` y `git push`).

## 5. Publicarlo gratis en Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Add New Project** → elegí tu repositorio de GitHub.
2. Vercel detecta automáticamente que es un proyecto Vite — no hace falta tocar nada de la build.
3. Antes de darle a **Deploy**, agregá las variables de entorno (sección **Environment Variables**):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. En un minuto tenés una URL pública (`tu-juego.vercel.app`) que podés abrir desde
   cualquier celular — no hace falta instalar nada, es una página web.

Cada vez que hagas `git push`, Vercel vuelve a publicar la última versión automáticamente.

## 6. Cómo se juega

- **Movimiento**: joystick táctil (celular) o WASD / flechas (compu).
- **Atacar**: botón "ATACAR" (celular) o clic / barra espaciadora (compu), mantenido para
  ataques seguidos.
- **Subir de nivel**: matando enemigos ganás experiencia y materiales.
- **Mejorar equipo**: en el campamento gastás materiales para comprar armas y armaduras
  mejores (algunas piden nivel mínimo).
- **Multijugador**: uno crea sala (le da un código de 4 letras) y hasta 3 amigos se unen con
  ese código desde su celular, todos desde la misma URL de Vercel.

## 7. Cómo está armada la red (por si querés tocar el código)

No hay servidor de juego propio — todo corre en el navegador de cada celular. El primer
jugador que entra a la sala es el "host": simula los enemigos y la misión, y les avisa a los
demás por Supabase Realtime varias veces por segundo. Los demás jugadores mandan su propia
posición y, cuando golpean a un enemigo, un "pedido de golpe" que el host valida. Está todo
comentado en `src/supabase/multiplayer.ts`.

## 8. Estructura del proyecto

```
src/
  game/         # motor del juego: tipos, datos (armas/enemigos/misiones), canvas y loop
  supabase/     # cliente de Supabase y la capa de multijugador en tiempo real
  ui/           # pantallas: menú, sala, campamento (equipo + misiones), HUD, joystick
  App.tsx       # arma el flujo entre pantallas y guarda el progreso
```

## 9. Ideas para seguir mejorando

- Sprites/animaciones en vez de círculos de color
- Más tipos de enemigos y una segunda misión de jefe
- Chat de texto rápido entre jugadores de la sala
- Cuentas con login (Supabase Auth) en vez de guardar solo por celular
