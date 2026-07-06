# Cambios en Propuestas y Presupuestos

## Resumen

- Se agrego el tipo de documento `PROPUESTA` / `PRESUPUESTO` al modelo de cotizaciones.
- El correlativo ahora lo genera el backend:
  - Propuestas: `PROP-000001`
  - Presupuestos: `PRES-000001`
- El campo `numero` existente se mantiene como correlativo unico.
- Se agrego `estado` y borrado logico con `deletedAt`.
- La pantalla permite seleccionar tipo, estado, ver correlativo readonly, guardar, editar y eliminar documentos.
- El PDF usa el tipo real del documento en el encabezado y nombre del archivo.

## Endpoints

- `GET /api/propuestas`
- `GET /api/propuestas/:id`
- `GET /api/propuestas/siguiente-correlativo?tipoDocumento=PROPUESTA`
- `POST /api/propuestas`
- `PUT /api/propuestas/:id`
- `DELETE /api/propuestas/:id`

Las rutas antiguas `/api/cotizaciones` siguen funcionando como alias para no romper integraciones existentes.

## Base de Datos

Aplicar cambios con:

```bash
npx prisma db push
```

El borrado es logico. Los registros eliminados no aparecen en listados ni dashboard, pero siguen reservando su correlativo para evitar reutilizacion.
