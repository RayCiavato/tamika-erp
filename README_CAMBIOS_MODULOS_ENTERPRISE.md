# Cambios modulos enterprise

## Resumen

Se agrego una capa enterprise gradual sin borrar funcionalidades existentes:

- Nuevos modelos Prisma para productos, servicios, proveedores, Starlink y nomina.
- Nuevas rutas backend agrupadas en `backend/src/modules/enterprise`.
- Nuevas vistas frontend en `frontend/app/modules`.
- Contabilidad acepta proveedor por selector y referencias a producto/servicio.
- Propuestas y presupuestos pueden usar items manuales, productos o servicios.
- PDF ajustado a tamano carta, con marca de agua central y firma solo en barra lateral.

## Cambios PDF

- El documento se genera en `LETTER`.
- La fecha sale en formato `DD/MM/YYYY`.
- El bloque derecho del membrete queda dentro de la franja gris.
- La firma central fue removida.
- La firma/sello se mantiene ampliada en la barra lateral.
- El logo se muestra como marca de agua central con baja opacidad.
- Los terminos y condiciones usan letra compacta para impresion.

## Productos y servicios

Modelos agregados:

- `Producto`
- `TipoProducto`
- `Servicio`
- `TipoServicio`

Los codigos `PROD-YYYY-0001` y `SERV-YYYY-0001` son automaticos y editables.
Los tipos se administran desde API y se pueden crear rapidamente desde formularios.

APIs:

- `GET /api/productos`
- `GET /api/productos/:id`
- `POST /api/productos`
- `PUT /api/productos/:id`
- `DELETE /api/productos/:id`
- `GET /api/productos/siguiente-codigo`
- `GET /api/tipos-producto`
- `POST /api/tipos-producto`
- `PUT /api/tipos-producto/:id`
- `DELETE /api/tipos-producto/:id`
- `GET /api/servicios`
- `GET /api/servicios/:id`
- `POST /api/servicios`
- `PUT /api/servicios/:id`
- `DELETE /api/servicios/:id`
- `GET /api/servicios/siguiente-codigo`
- `GET /api/tipos-servicio`
- `POST /api/tipos-servicio`
- `PUT /api/tipos-servicio/:id`
- `DELETE /api/tipos-servicio/:id`

## Proveedores y Proveedor ID automatico

Modelo agregado:

- `Proveedor`

APIs:

- `GET /api/proveedores`
- `GET /api/proveedores/:id`
- `POST /api/proveedores`
- `PUT /api/proveedores/:id`
- `DELETE /api/proveedores/:id`
- `GET /api/proveedores/siguiente-codigo`

En contabilidad, el usuario selecciona el proveedor desde un desplegable. El ID tecnico se guarda internamente y se muestra solo como dato automatico/solo lectura.

## Contabilidad

Modelo modificado:

- `MovimientoContable`

Campos agregados de forma nullable:

- `categoria`
- `productoId`
- `servicioId`
- `tipoProductoId`
- `tipoServicioId`

La vista de contabilidad ahora permite clasificar movimientos como:

- Servicio
- Producto
- Nomina
- Pago de factura
- Suscripcion
- Otro

Los desplegables consumen datos reales desde API.

## Starlink

Modelos agregados:

- `CuentaStarlink`
- `AntenaStarlink`
- `PagoStarlink`

APIs:

- `GET /api/starlink/cuentas`
- `POST /api/starlink/cuentas`
- `GET /api/starlink/cuentas/:id`
- `PUT /api/starlink/cuentas/:id`
- `DELETE /api/starlink/cuentas/:id`
- `GET /api/starlink/antenas`
- `POST /api/starlink/antenas`
- `GET /api/starlink/antenas/:id`
- `PUT /api/starlink/antenas/:id`
- `DELETE /api/starlink/antenas/:id`
- `GET /api/starlink/pagos`
- `POST /api/starlink/pagos`
- `PUT /api/starlink/pagos/:id`
- `DELETE /api/starlink/pagos/:id`
- `GET /api/starlink/alertas`

Alertas tipo semaforo:

- Verde: mas de 10 dias para corte.
- Amarillo: 10 dias o menos, o pago pendiente.
- Rojo: fecha vencida o pago vencido.

Los pagos Starlink crean o actualizan movimientos contables:

- `PAGADO` como ingreso.
- `PENDIENTE` o `VENCIDO` como cuenta por cobrar.
- `ANULADO` anula el movimiento asociado.

## Nomina

Modelos agregados:

- `Empleado`
- `Nomina`

APIs:

- `GET /api/empleados`
- `POST /api/empleados`
- `PUT /api/empleados/:id`
- `DELETE /api/empleados/:id`
- `GET /api/empleados/siguiente-codigo`
- `GET /api/nomina`
- `POST /api/nomina`
- `PUT /api/nomina/:id`
- `DELETE /api/nomina/:id`

Los pagos de nomina crean o actualizan movimientos contables:

- `PAGADO` como egreso.
- `PENDIENTE` como cuenta por pagar.
- `ANULADO` anula el movimiento asociado.

## Frontend

Rutas/vistas integradas:

- `Productos`
- `Servicios`
- `Starlink`
- `Nomina`
- `Catalogos`

Archivos principales:

- `frontend/app/modules/catalogos/CatalogosEnterpriseView.js`
- `frontend/app/modules/starlink/StarlinkView.js`
- `frontend/app/modules/nomina/NominaView.js`
- `frontend/app/components/ContabilidadView.js`
- `frontend/app/page.js`

## Backend

Archivo principal:

- `backend/src/modules/enterprise/routes.js`

El modulo se monta en `backend/src/index.js` despues de la autenticacion:

```js
app.use('/api', authenticateToken);
registerEnterpriseRoutes(app, { prisma, logAudit, serializeError });
```

## Base de datos y despliegue seguro

Este repositorio no tenia historial Prisma migrations. Para un servidor con data existente, usar el flujo seguro:

```bash
cd /home/tamika/tamika-erp
docker compose exec -T db pg_dump -U tamika_admin tamika_erp_db > backup_tamika_erp_pre_enterprise_$(date +%Y%m%d_%H%M).sql
docker compose run --rm backend npx prisma db push
docker compose run --rm backend npx prisma generate
docker compose build
docker compose up -d --force-recreate
```

Antes de aceptar cambios, se puede revisar el SQL:

```bash
docker compose run --rm backend sh -lc 'npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script' > prisma_enterprise_preview.sql
grep -Ei "DROP|TRUNCATE|DELETE|ALTER TABLE .* DROP" prisma_enterprise_preview.sql
```

No usar:

```bash
npx prisma migrate reset
npx prisma db push --force-reset
docker compose down -v
```

## Como probar

1. Iniciar sesion como administrador.
2. Crear un tipo de servicio y un servicio.
3. Crear un tipo de producto y un producto.
4. Crear un proveedor.
5. En contabilidad, seleccionar proveedor desde el desplegable.
6. Crear movimiento de categoria `Producto` o `Servicio` y verificar que carga precio/descriptores.
7. En propuestas, agregar item y seleccionar producto o servicio.
8. Generar PDF y revisar:
   - tamano carta,
   - fecha completa,
   - membrete dentro de margen,
   - firma lateral,
   - marca de agua central,
   - terminos compactos.
9. Crear cuenta Starlink.
10. Agregar varias antenas a la cuenta.
11. Registrar pago Starlink y revisar que aparezca en contabilidad.
12. Crear empleado.
13. Registrar nomina y revisar que aparezca como egreso o cuenta por pagar.
14. Revisar auditoria.

## Validacion local realizada

```bash
npm run prisma:generate
npm run build
node --check backend/src/index.js
node --check backend/src/modules/enterprise/routes.js
```
