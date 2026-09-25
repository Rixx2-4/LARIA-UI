# LARIA-UI

## Desarrollo

Requiere Node 20+ y **pnpm 10+** (pnpm 9 no entiende `pnpm-workspace.yaml`).

```bash
pnpm install   # también activa los hooks de git
pnpm dev       # http://localhost:3000
```

El backend se configura con `NEXT_PUBLIC_LARIA_API_URL` (por defecto `http://localhost:8000/api/v1`).
El origen del frontend debe estar en el `CORS_ORIGINS` del backend.

## Comprobación antes de cada push

Al hacer `git push`, un hook (`.husky/pre-push`) ejecuta en orden lint, tipos, tests y build
de producción. Si algo falla, el push se cancela y se muestra el error. Se puede lanzar a mano:

```bash
pnpm verify
```

Solo en una emergencia: `git push --no-verify`.
