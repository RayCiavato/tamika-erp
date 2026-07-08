# Enterprise modules

Este modulo agrupa las rutas nuevas del ERP sin reescribir de golpe el `src/index.js` legado.

Incluye:

- Productos y tipos de producto.
- Servicios y tipos de servicio.
- Proveedores.
- Cuentas, antenas, pagos y alertas Starlink.
- Empleados y nomina.

Las rutas se montan despues de `app.use('/api', authenticateToken)`, por lo que requieren sesion valida.
Las bajas operativas se manejan como desactivaciones o anulaciones para evitar perdida historica.
