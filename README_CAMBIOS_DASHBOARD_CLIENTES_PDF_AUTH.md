# Cambios dashboard, clientes, PDF, auth y auditoria

## Dashboard y contabilidad

- El dashboard calcula ingresos reales solo con `INGRESO` o `CUENTA_POR_COBRAR` en estado `PAGADO`.
- Los egresos reales solo suman `EGRESO` o `CUENTA_POR_PAGAR` en estado `PAGADO`.
- Las cuentas pendientes no afectan ingresos/egresos reales hasta cambiar a `PAGADO`.
- Se agregaron KPIs de ingresos reales, egresos reales, balance, pendientes, facturas pagadas, facturas pendientes, total mensual y total anual.
- Se agrego `GET /api/dashboard/balance?periodo=diario|semanal|mensual|anual` para la grafica de barras.

## Reportes contables

- Nueva vista `Reportes` con filtros por fecha, tipo, estado, cliente, proveedor y busqueda.
- Nuevo endpoint `GET /api/reportes/contabilidad`.
- El reporte separa ingresos, egresos, cuentas por cobrar, cuentas por pagar, facturas pagadas y facturas pendientes, con subtotales independientes.

## Clientes

- `Cliente` ahora tiene `codigoCliente`, `telefono` y `email`.
- Nuevo endpoint `GET /api/clientes/siguiente-codigo`.
- El formato automatico es `CLI-YYYY-0001`.
- El codigo es editable y unico.
- El codigo se muestra en formulario, tabla y selector de propuestas.

## Propuestas y PDF

- El selector de cliente carga datos desde Catalogos y rellena snapshots editables para el PDF.
- La seccion `Barra lateral del PDF` ahora selecciona el cliente desde Catalogos y muestra sus datos en una ficha de solo lectura para evitar doble carga manual.
- La propuesta conserva datos historicos en `datosPdf` y campos snapshot de cliente.
- El PDF muestra visualmente el numero como `COTIZACION NO. 0000210` o `PRESUPUESTO NO. 0000210`, sin forzar el prefijo interno `PROP-`.
- Se ajusto el bloque superior del PDF para que fecha y numero de cotizacion queden dentro del margen.
- La tabla economica usa columnas `Item`, `Descripcion del Servicio`, `Cantidad`, `Precio Unitario USD` y `Subtotal USD`.
- La barra lateral incluye cliente, RIF, direccion, telefono/email si existen, empresa, logo translucido y firma/sello mas grandes; las direcciones largas hacen salto de linea dentro del cuadro.
- Se agrego firma final con Frank Salazar y datos de contacto.
- Para iniciar el correlativo en `0000210`, usar:

```http
POST /api/propuestas/configurar-correlativo
Authorization: Bearer TOKEN_ADMIN
Content-Type: application/json

{
  "tipoDocumento": "PROPUESTA",
  "siguienteNumero": 210,
  "ancho": 7
}
```

## Login

- Se agrego `Usuario` con password hasheado usando `bcryptjs`.
- Se usa JWT con `Authorization: Bearer <token>`.
- Si no hay usuarios, la pantalla inicial permite crear el primer ADMIN.
- Despues del primer ADMIN, el registro publico queda cerrado.
- Variables nuevas en `.env.example`:
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`

## Usuarios enterprise

- Nueva vista `Usuarios`, visible solo para ADMIN.
- Nuevo endpoint `GET /api/usuarios`, protegido con `requireAdmin`.
- Nuevo endpoint `POST /api/usuarios`, protegido con `requireAdmin`, para crear usuarios con rol `USUARIO` o `ADMIN`.
- Nuevo endpoint `PUT /api/usuarios/:id`, protegido con `requireAdmin`, para editar nombre, email, rol, estado activo y password opcional.
- El backend evita dejar el sistema sin al menos un administrador activo.

## Auditoria

- Se agrego `AuditLog`.
- Se registran login, logout, clientes, propuestas, movimientos contables, cambios de estado, tasas manuales, generacion de PDF y cambios de correlativo.
- Nueva vista `Auditoria`, visible para ADMIN.
- Endpoints:
  - `GET /api/audit-logs`
  - `POST /api/audit-logs/event`

## Prisma

Aplicar cambios:

```bash
cd backend
npx prisma db push
npx prisma generate
```

En local se uso `npx prisma db push --accept-data-loss` porque Prisma advierte sobre el indice unico nuevo de `codigoCliente`. La columna es nueva y nullable; PostgreSQL permite multiples `NULL`.

## Docker

```bash
docker compose build
docker compose up -d
```

No usar `docker compose down -v` en servidor si se quiere conservar la data.

## Pruebas realizadas

- `node --check backend/src/index.js`
- `npx prisma format`
- `npx prisma db push --accept-data-loss`
- `npm run build` en frontend
- Login/register local
- `GET /api/auth/me`
- `GET /api/clientes/siguiente-codigo`
- Crear, editar y eliminar cliente temporal
- `GET /api/dashboard/balance`
- `GET /api/reportes/contabilidad`
- `GET /api/audit-logs`
- `GET /api/usuarios` con ADMIN
- `POST /api/usuarios` y `PUT /api/usuarios/:id` con usuario temporal
- `GET /api/usuarios` con usuario no ADMIN devuelve `403`
- `POST /api/auth/register` despues del primer ADMIN devuelve `403`
