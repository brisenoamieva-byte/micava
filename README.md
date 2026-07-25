# Cavatale

Tu cava de vinos con historias que abren conversación — Next.js.

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Red de usuarios + chat

1. En Supabase → **SQL Editor**, ejecuta [`supabase/migrations/006_user_network.sql`](supabase/migrations/006_user_network.sql).
2. Confirma en **Database → Publications → supabase_realtime** que `messages` (y `conversations`) estén publicadas.
3. En la app: pestaña **Red** → Mi presencia → activa “Aparecer en la red”.
