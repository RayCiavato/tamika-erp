# Cambios de Dashboard y Contabilidad

## Que se agrego

- Nuevo modulo frontend `Contabilidad` accesible desde el menu lateral.
- Dashboard principal redisenado con KPIs operativos y contables.
- Indicadores de ingresos, egresos, balance, cuentas por cobrar y cuentas por pagar.
- Tabla de ultimos movimientos contables en el dashboard.
- CRUD completo de movimientos contables en backend.
- Modelo Prisma `MovimientoContable` con enums `MovimientoTipo` y `MovimientoEstado`.

## Nuevas rutas frontend

- `Dashboard`: vista inicial del ERP.
- `Contabilidad`: seccion interna renderizada desde `frontend/app/page.js`.

## Nuevos endpoints backend

- `GET /api/dashboard/resumen`
- `GET /api/contabilidad`
- `GET /api/contabilidad/:id`
- `POST /api/contabilidad`
- `PUT /api/contabilidad/:id`
- `DELETE /api/contabilidad/:id`

Filtros soportados por `GET /api/contabilidad`:

- `tipo`
- `estado`
- `desde`
- `hasta`
- `buscar`

## Cambios Prisma

Se agrego:

- `MovimientoContable`
- `MovimientoTipo`
- `MovimientoEstado`
- Relacion opcional con `Cliente`

No se agrego relacion con proveedores porque no existe un modelo `Proveedor` en el schema actual. El campo `proveedorId` queda preparado como texto opcional para una integracion futura.

## Aplicar cambios de base de datos

Flujo actual del proyecto:

```bash
cd backend
npx prisma db push
```

El script `npm start` del backend tambien ejecuta `prisma db push` antes de levantar Express.

## Levantar con Docker

```bash
docker compose up --build
```

Servicios esperados:

- Frontend: http://localhost:8083
- Backend: http://localhost:5000
- PostgreSQL: localhost:5433

## Levantar local sin Docker

Backend:

```bash
cd backend
DATABASE_URL=postgresql://tamika_admin:TU_PASSWORD@localhost:5433/tamika_erp_db npm start
```

Frontend:

```bash
cd frontend
API_INTERNAL_URL=http://localhost:5000 npm run build
API_INTERNAL_URL=http://localhost:5000 npm start -- -p 8083
```

## Pendientes seguros

- Crear modelos reales de `Proveedor` y `Producto` cuando existan esos modulos.
- Reemplazar `db push` por migraciones versionadas con Prisma Migrate antes de produccion formal.
- Agregar autenticacion/autorizacion si el ERP se expone fuera de una red controlada.
