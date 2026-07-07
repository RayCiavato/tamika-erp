# Cambios en Propuestas y Presupuestos

## Resumen

- Se agrego el tipo de documento `PROPUESTA` / `PRESUPUESTO` al modelo de cotizaciones.
- El correlativo ahora lo genera el backend:
  - Propuestas: `PROP-000001`
  - Presupuestos: `PRES-000001`
- El campo `numero` existente se mantiene como correlativo unico y ahora puede editarse para cargar documentos historicos.
- El autogenerador lee numeros legacy del mismo tipo de documento, incluso si no tienen prefijo, para evitar conflictos con data vieja del servidor.
- Se agrego `estado` y borrado logico con `deletedAt`.
- La pantalla permite seleccionar tipo, estado, editar correlativo, guardar, editar y eliminar documentos.
- Las propuestas incluyen un bloque editable de contenido interno que se inserta en el PDF antes de la tabla de servicios.
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

## Correlativos y data historica

- Si el usuario deja el correlativo vacio, el backend genera el siguiente numero disponible segun `tipoDocumento`.
- Si el usuario escribe un correlativo manual, el backend lo respeta y valida que no exista ya en la tabla `Cotizacion`.
- La secuencia automatica toma el mayor sufijo numerico existente para el tipo seleccionado. Ejemplo: si ya existe una propuesta `0000210`, la proxima propuesta automatica sera `PROP-0000211`.
- Propuestas y presupuestos mantienen secuencias separadas por `tipoDocumento`, por lo que cambiar el tipo en el formulario recarga el correlativo correspondiente.

## Contenido interno de propuesta

- Se agrego el campo opcional `contenidoPropuesta String?` en `Cotizacion`.
- El editor aparece solo para documentos de tipo `PROPUESTA`, debajo de `Mostrar campos avanzados`.
- El contenido se guarda como HTML editable y se transforma a pdfmake al generar el PDF, manteniendo el formato existente del documento.
