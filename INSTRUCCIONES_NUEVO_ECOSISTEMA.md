# SANTI · Instrucciones para Continuar en Otro Ecosistema Replit

## Paso 1 — Crear nuevo Replit

1. Ve a https://replit.com/new
2. Selecciona **Import from GitHub** o **Blank Repl (Node.js)**
3. Nombre del proyecto: `SANTI-CMO-Temixco`

## Paso 2 — Subir el código

Si tienes ZIP del proyecto actual:
- Sube todos los archivos manteniendo la estructura de carpetas
- La estructura debe ser:
```
/
├── artifacts/
│   ├── santi/          ← Frontend React
│   └── api-server/     ← Backend Express
├── lib/
│   ├── db/             ← PostgreSQL + Drizzle ORM
│   ├── api-spec/       ← OpenAPI contract
│   ├── api-client-react/  ← Hooks generados
│   └── api-zod/        ← Validaciones Zod
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.json
```

## Paso 3 — Variables de Entorno (Secrets)

En el panel izquierdo de Replit → **Secrets** → agrega:

| Secret | Valor |
|--------|-------|
| `DATABASE_URL` | URL de tu PostgreSQL (Replit provee una gratis) |
| `SESSION_SECRET` | Cualquier string largo aleatorio: `santi-tmx-2026-secreto` |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Tu API key de Google Gemini |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` |

### Obtener API Key de Gemini:
1. Ve a https://aistudio.google.com/app/apikey
2. Crea una nueva clave
3. Cópiala al Secret `AI_INTEGRATIONS_GEMINI_API_KEY`

## Paso 4 — Instalar dependencias

En la terminal de Replit:
```bash
npm install -g pnpm
pnpm install
```

## Paso 5 — Configurar base de datos

```bash
pnpm --filter @workspace/db run push
```

## Paso 6 — Configurar Workflows

En Replit, ve a **Workflows** (panel izquierdo) y crea dos workflows:

### Workflow 1: API Server
- **Nombre:** API Server
- **Comando:** `pnpm --filter @workspace/api-server run dev`
- **Puerto:** 8080

### Workflow 2: Frontend SANTI
- **Nombre:** Frontend SANTI  
- **Comando:** `pnpm --filter @workspace/santi run dev`
- **Puerto:** Variable `PORT`

## Paso 7 — Regenerar código si se modifica OpenAPI

Si modificas `lib/api-spec/openapi.yaml`:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Paso 8 — Verificar que funciona

Abre el Preview de Replit → debe aparecer el Centro de Mando SANTI.

Prueba la API:
```bash
curl localhost:80/api/santi/stats
```

---

## Para el DEMO STANDALONE (sin backend)

Usa el archivo `demo-santi.html` incluido en este proyecto. 

- **Abre directamente en cualquier navegador** (sin servidor)
- Ingresa tu API key de Gemini cuando la solicite
- Todos los agentes responden con IA real

---

## Archivos clave para modificar

| Archivo | Para qué |
|---------|----------|
| `artifacts/santi/src/pages/santi-command.tsx` | UI principal del Centro de Mando |
| `artifacts/api-server/src/routes/santi/index.ts` | Lógica de IA y API |
| `lib/api-spec/openapi.yaml` | Contrato de API (si añades endpoints) |
| `lib/db/src/schema/santi.ts` | Esquema de base de datos |

---

## Comandos útiles

```bash
pnpm run typecheck          # Verificar tipos TypeScript
pnpm run typecheck:libs     # Solo librerías
pnpm --filter @workspace/santi run build   # Build producción frontend
pnpm --filter @workspace/api-server run build  # Build producción backend
```

---

*Sistema SANTI · Secretaría de Seguridad Pública · Temixco, Morelos · 2026*
