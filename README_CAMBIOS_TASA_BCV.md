# Cambios de Tasa BCV en Contabilidad

## Qué se agregó

- Endpoint backend `GET /api/tasas/bcv` para consultar la tasa BCV desde una API externa configurada por entorno.
- Carga automática de tasa BCV al abrir el formulario de Contabilidad.
- Campo `Tasa BCV` editable para registrar facturas pagadas con una tasa anterior o distinta.
- Indicador visual de origen de tasa: automática, manual, cacheada, respaldo o no disponible.
- Cálculo en tiempo real de `montoBs = montoUsd * tasaBcv` en frontend.
- Recalculo y validación de `montoBs` en backend antes de guardar.
- Cache simple en memoria para evitar consultas excesivas a la API externa.
- Fallback a la última tasa guardada en `Tasa` si la API externa falla.

## Variables de entorno

Agregar en `.env` local o en el entorno Docker:

```bash
BCV_API_URL=
BCV_API_TIMEOUT_MS=5000
BCV_API_CACHE_TTL_SECONDS=3600
```

No se debe consultar la API externa desde el frontend. El frontend siempre usa `/api/tasas/bcv`.

## Endpoint nuevo

```http
GET /api/tasas/bcv
```

Respuesta exitosa:

```json
{
  "success": true,
  "tasa": 36.5,
  "moneda": "USD",
  "fuente": "BCV_API",
  "fecha": "2026-07-06T00:00:00.000Z",
  "cache": false
}
```

Respuesta controlada si no hay API ni fallback:

```json
{
  "success": false,
  "message": "No se pudo obtener la tasa BCV actual. Ingrese la tasa manualmente."
}
```

## Cambios Prisma

En `MovimientoContable` se agregaron:

- `tasaFuente String?`
- `tasaFecha DateTime?`
- `tasaEditadaManual Boolean @default(false)`

Ya existían `tasaBcv` y `montoBs`, por lo que se reutilizaron.

Aplicar cambios:

```bash
cd backend
npx prisma db push
```

## Uso en Contabilidad

- Al crear un movimiento, el formulario consulta la tasa actual automáticamente.
- Si el usuario cambia el valor de `Tasa BCV`, el movimiento queda marcado como manual.
- El botón `Actualizar tasa BCV` vuelve a consultar el backend.
- Si la tasa ya fue editada manualmente, se pide confirmación antes de reemplazarla.
- Si la API falla, el formulario muestra un mensaje y permite ingresar la tasa manualmente.

## Docker

Construir:

```bash
docker compose build
```

Levantar:

```bash
docker compose up
```

El servicio backend lee `BCV_API_URL`, `BCV_API_TIMEOUT_MS` y `BCV_API_CACHE_TTL_SECONDS` desde el entorno.

## Corrección de codificación y logo

- Se corrigieron textos visibles con mojibake en la interfaz, incluyendo `Tasas del Día`, `Descripción`, `+ Añadir Servicio`, `Catálogos`, `Gestión`, `Razón Social`, `Dirección Fiscal`, `Acción`, `Teléfono` y textos del PDF.
- Se reemplazó el carácter corrupto del sidebar por el logo real ubicado en `frontend/public/logo.png`.
- Se confirmó que `frontend/app/layout.js` ya define `<html lang="es">`; Next.js maneja UTF-8, por lo que el origen del problema eran cadenas ya guardadas con codificación dañada.
- Se verificó con búsqueda en `frontend` y `backend` que no queden secuencias `Ã`, `Â`, `â` ni `�` fuera de dependencias/builds.

## Verificación sugerida

```bash
rg -n "Ã|Â|â|�" frontend backend --glob "!node_modules/**" --glob "!.next/**"
cd backend && npx prisma db push
cd ../frontend && npm run build
docker compose build
```
