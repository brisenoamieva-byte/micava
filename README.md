# Cavatale

Tu cava de vinos con historias que abren conversación — Next.js.

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Compartir cava (link público)

1. En Supabase → **SQL Editor**, ejecuta las migraciones de cava pública / handle (`011_public_cava.sql`, `013_public_handle.sql`, etc.).
2. En la app: **Más → Compartir cava** → activa “Cava pública”, elige un `@handle` y copia el link `/u/tu-handle`.
