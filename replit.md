# SANTI · Centro de Mando Operativo

Sistema de Análisis Neuronal Táctico Inteligente para la Secretaría de Seguridad Pública de Temixco, Morelos — demo para Google I/O 2026.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 8080)
- `pnpm --filter @workspace/santi run dev` — Frontend (port 23210)
- `pnpm run typecheck` — typecheck completo
- `pnpm run typecheck:libs` — compila solo las libs
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks y schemas Zod desde OpenAPI
- `pnpm --filter @workspace/db run push` — push schema a DB (solo dev)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Leaflet + Leaflet.heat + TanStack Query
- API: Express 5 (`artifacts/api-server`, port 8080)
- DB: PostgreSQL + Drizzle ORM
- AI: Gemini 2.5 Flash vía Replit AI Integrations (`@workspace/integrations-gemini-ai`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/`)
- Build: esbuild (CJS bundle) para API server

## Where things live

- `artifacts/santi/` — Frontend React del Centro de Mando
- `artifacts/api-server/` — Express API con rutas SANTI y Gemini
- `lib/db/src/schema/santi.ts` — Schema de incident_reports
- `lib/api-spec/openapi.yaml` — Contrato OpenAPI (fuente de verdad)
- `lib/api-client-react/` — Hooks generados (useAnalyzeIncident, useGetStats, etc.)
- `lib/api-zod/` — Schemas Zod generados para validación en server
- `lib/integrations-gemini-ai/` — Cliente Gemini con batch processing y retry

## Architecture decisions

- `@google/genai` marcado como external en esbuild (`@google/*` pattern en build.mjs) → debe instalarse como dependency en `api-server/package.json`
- `lib/api-zod/src/index.ts` exporta SOLO `./generated/api` (NO `./generated/types`) para evitar conflictos de exportación duplicada
- `lib/integrations-gemini-ai/tsconfig.json` sin campo `types` (se eliminó `"types":["node"]` que causaba TS2688)
- Mutaciones del api-client-react requieren `{ data: { ...payload } }` (no el payload directo) por convención Orval
- Leaflet.heat se carga vía CDN en `index.html` para evitar bundling de módulos CJS incompatibles con Vite

## Product

- Mapa táctico de Temixco con heatmap real, zonas de riesgo coloreadas, patrullas autónomas animadas
- 5 agentes IA: SANTI (coordinador), EMILIANO (táctico), MAXIMILIANO (inteligencia), SANTIAGO (escuela segura), KATERING (código violeta)
- Análisis en tiempo real con Gemini 2.5 Flash: nivel de riesgo, protocolo, acciones recomendadas
- Módulos tácticos: Código Violeta, Antiextorsión, Escuela Segura, Desaparición, Narcomenudeo CJNG
- Generación de folios (TX-INC-2026-XXXX), registro en DB PostgreSQL
- Escaneo vehicular C2 + síntesis de voz (SpeechSynthesis)
- Reporte directo al Secretario de Seguridad
- Bitácora en vivo con feed automático cada 10 segundos

## User preferences

- Demo para Google I/O, enfoque en impresión visual y funcionalidad real
- Datos reales de Temixco 2025 (CJNG célula El Trébol, AVG, 93 cámaras WiFi, 24 detenidos)
- Lenguaje neuronal táctico en todos los textos
- Paleta: fondo #000509, dorado #C8A84B, accent #00E5FF, rojo #FF1744, violeta #C13AFF

## Gotchas

- Al agregar nuevas rutas al API server, el workflow requiere rebuild (las rutas se compilan con esbuild)
- `@google/*` está en la lista de externals de build.mjs → cualquier paquete `@google/...` debe ser dependency explícita del api-server
- `PORT` y `BASE_PATH` son requeridos por vite.config.ts del frontend — el workflow los inyecta automáticamente
- `lib/integrations-gemini-ai` es una lib compuesta que emite solo `.d.ts` — esbuild la transpila desde `./src/index.ts` directamente

## Pointers

- Ver `pnpm-workspace` skill para estructura del monorepo
- Ver `ai-integrations-gemini` skill para uso del cliente Gemini
