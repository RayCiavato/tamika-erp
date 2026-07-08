const DEFAULT_TIPOS_SERVICIO = [
  'Soporte tecnico',
  'Instalacion',
  'Mantenimiento',
  'Suscripcion',
  'Consultoria',
  'Starlink',
  'Seguridad',
  'Infraestructura',
  'Otro',
];

const DEFAULT_TIPOS_PRODUCTO = [
  'Antena Starlink',
  'Router',
  'Servidor',
  'Rack',
  'Cableado',
  'UPS',
  'Licencia',
  'Hardware',
  'Otro',
];

const STARLINK_ESTADOS = ['ACTIVA', 'INACTIVA', 'SUSPENDIDA'];
const PAGO_ESTADOS = ['PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO'];
const NOMINA_ESTADOS = ['PENDIENTE', 'PAGADO', 'ANULADO'];
const CATEGORIAS_CONTABLES = ['Servicio', 'Producto', 'Nomina', 'Pago de factura', 'Suscripcion', 'Otro'];

const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseActivo = (value) => {
  if (value === undefined) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return !['false', '0', 'no', 'inactivo'].includes(value.trim().toLowerCase());
  return Boolean(value);
};

const cleanText = (value) => value?.toString().trim() || '';
const nullableText = (value) => cleanText(value) || null;
const normalizeEstado = (value, allowed, fallback) => {
  const normalized = cleanText(value).toUpperCase();
  return allowed.includes(normalized) ? normalized : fallback;
};

const buildSearchWhere = (query, fields) => {
  const filters = [];
  if (query.activo !== undefined && query.activo !== '') filters.push({ activo: parseActivo(query.activo) });
  if (query.buscar) {
    const buscar = cleanText(query.buscar);
    filters.push({
      OR: fields.map((field) => ({ [field]: { contains: buscar, mode: 'insensitive' } })),
    });
  }
  return filters.length ? { AND: filters } : {};
};

const nextCode = async (tx, modelName, field, prefix, fecha = new Date()) => {
  const year = fecha.getFullYear();
  const base = `${prefix}-${year}-`;
  const rows = await tx[modelName].findMany({
    where: { [field]: { startsWith: base } },
    select: { [field]: true },
  });

  const ultimo = rows.reduce((acc, row) => {
    const value = row[field] || '';
    const secuencia = Number.parseInt(value.split('-').at(-1), 10);
    return Number.isFinite(secuencia) && secuencia > acc ? secuencia : acc;
  }, 0);

  return `${base}${String(ultimo + 1).padStart(4, '0')}`;
};

const ensureDefaultTypes = async (prisma, modelName, names) => {
  await Promise.all(names.map((nombre) => prisma[modelName].upsert({
    where: { nombre },
    update: {},
    create: { nombre },
  })));
};

const resolveTipo = async (tx, modelName, idField, nombreField, body) => {
  const id = nullableText(body[idField]);
  if (id) return id;

  const nombre = nullableText(body[nombreField]);
  if (!nombre) return null;

  const tipo = await tx[modelName].upsert({
    where: { nombre },
    update: { activo: true },
    create: { nombre },
  });
  return tipo.id;
};

const safeAudit = async (logAudit, req, payload) => {
  if (!logAudit) return;
  await logAudit(req, payload);
};

const registerTipoRoutes = (app, { prisma, logAudit, serializeError, path, modelName, defaults, entity }) => {
  app.get(`/api/${path}`, async (req, res) => {
    try {
      await ensureDefaultTypes(prisma, modelName, defaults);
      const rows = await prisma[modelName].findMany({
        where: buildSearchWhere(req.query, ['nombre', 'descripcion']),
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      res.json(rows);
    } catch (error) {
      serializeError(res, 500, `No se pudieron cargar los ${path}.`);
    }
  });

  app.post(`/api/${path}`, async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      const row = await prisma[modelName].create({
        data: {
          nombre,
          descripcion: nullableText(req.body.descripcion),
          activo: parseActivo(req.body.activo),
        },
      });
      await safeAudit(logAudit, req, {
        accion: `${entity.toUpperCase()}_CREATE`,
        entidad: entity,
        entidadId: row.id,
        descripcion: `${entity} creado: ${row.nombre}.`,
      });
      res.status(201).json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un tipo con ese nombre.');
      serializeError(res, 400, `No se pudo crear el ${entity}.`);
    }
  });

  app.put(`/api/${path}/:id`, async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      const row = await prisma[modelName].update({
        where: { id: req.params.id },
        data: {
          nombre,
          descripcion: nullableText(req.body.descripcion),
          activo: parseActivo(req.body.activo),
        },
      });
      await safeAudit(logAudit, req, {
        accion: `${entity.toUpperCase()}_UPDATE`,
        entidad: entity,
        entidadId: row.id,
        descripcion: `${entity} actualizado: ${row.nombre}.`,
      });
      res.json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un tipo con ese nombre.');
      serializeError(res, 400, `No se pudo actualizar el ${entity}.`);
    }
  });

  app.delete(`/api/${path}/:id`, async (req, res) => {
    try {
      const row = await prisma[modelName].update({ where: { id: req.params.id }, data: { activo: false } });
      await safeAudit(logAudit, req, {
        accion: `${entity.toUpperCase()}_DEACTIVATE`,
        entidad: entity,
        entidadId: row.id,
        descripcion: `${entity} desactivado: ${row.nombre}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, `No se pudo desactivar el ${entity}.`);
    }
  });
};

const registerCatalogRoutes = (app, { prisma, logAudit, serializeError }) => {
  registerTipoRoutes(app, {
    prisma,
    logAudit,
    serializeError,
    path: 'tipos-servicio',
    modelName: 'tipoServicio',
    defaults: DEFAULT_TIPOS_SERVICIO,
    entity: 'TipoServicio',
  });

  registerTipoRoutes(app, {
    prisma,
    logAudit,
    serializeError,
    path: 'tipos-producto',
    modelName: 'tipoProducto',
    defaults: DEFAULT_TIPOS_PRODUCTO,
    entity: 'TipoProducto',
  });

  app.get('/api/servicios/siguiente-codigo', async (req, res) => {
    try {
      res.json({ codigoServicio: await prisma.$transaction((tx) => nextCode(tx, 'servicio', 'codigoServicio', 'SERV')) });
    } catch (error) {
      serializeError(res, 500, 'No se pudo generar el codigo de servicio.');
    }
  });

  app.get('/api/productos/siguiente-codigo', async (req, res) => {
    try {
      res.json({ codigoProducto: await prisma.$transaction((tx) => nextCode(tx, 'producto', 'codigoProducto', 'PROD')) });
    } catch (error) {
      serializeError(res, 500, 'No se pudo generar el codigo de producto.');
    }
  });

  app.get('/api/proveedores/siguiente-codigo', async (req, res) => {
    try {
      res.json({ codigoProveedor: await prisma.$transaction((tx) => nextCode(tx, 'proveedor', 'codigoProveedor', 'PROV')) });
    } catch (error) {
      serializeError(res, 500, 'No se pudo generar el codigo de proveedor.');
    }
  });

  app.get('/api/servicios', async (req, res) => {
    try {
      const rows = await prisma.servicio.findMany({
        where: buildSearchWhere(req.query, ['codigoServicio', 'nombre', 'descripcion']),
        include: { tipoServicio: true },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      res.json(rows);
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar los servicios.');
    }
  });

  app.get('/api/servicios/:id', async (req, res) => {
    try {
      const row = await prisma.servicio.findUnique({ where: { id: req.params.id }, include: { tipoServicio: true } });
      if (!row) return serializeError(res, 404, 'Servicio no encontrado.');
      res.json(row);
    } catch (error) {
      serializeError(res, 500, 'No se pudo cargar el servicio.');
    }
  });

  app.post('/api/servicios', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      const precioUsd = toNumber(req.body.precioUsd, 0);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      if (Number.isNaN(precioUsd) || precioUsd < 0) return serializeError(res, 400, 'El precio debe ser numerico y mayor o igual a 0.');

      const row = await prisma.$transaction(async (tx) => {
        const tipoServicioId = await resolveTipo(tx, 'tipoServicio', 'tipoServicioId', 'tipoServicioNombre', req.body);
        const codigoServicio = nullableText(req.body.codigoServicio) || await nextCode(tx, 'servicio', 'codigoServicio', 'SERV');
        return tx.servicio.create({
          data: {
            codigoServicio,
            nombre,
            descripcion: nullableText(req.body.descripcion),
            tipoServicioId,
            precioUsd,
            activo: parseActivo(req.body.activo),
          },
          include: { tipoServicio: true },
        });
      });
      await safeAudit(logAudit, req, {
        accion: 'SERVICIO_CREATE',
        entidad: 'Servicio',
        entidadId: row.id,
        descripcion: `Servicio creado: ${row.nombre}.`,
        metadata: { codigoServicio: row.codigoServicio, precioUsd: row.precioUsd },
      });
      res.status(201).json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un servicio con ese codigo.');
      serializeError(res, 400, 'No se pudo crear el servicio.');
    }
  });

  app.put('/api/servicios/:id', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      const precioUsd = toNumber(req.body.precioUsd, 0);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      if (Number.isNaN(precioUsd) || precioUsd < 0) return serializeError(res, 400, 'El precio debe ser numerico y mayor o igual a 0.');

      const row = await prisma.$transaction(async (tx) => {
        const tipoServicioId = await resolveTipo(tx, 'tipoServicio', 'tipoServicioId', 'tipoServicioNombre', req.body);
        return tx.servicio.update({
          where: { id: req.params.id },
          data: {
            codigoServicio: nullableText(req.body.codigoServicio),
            nombre,
            descripcion: nullableText(req.body.descripcion),
            tipoServicioId,
            precioUsd,
            activo: parseActivo(req.body.activo),
          },
          include: { tipoServicio: true },
        });
      });
      await safeAudit(logAudit, req, {
        accion: 'SERVICIO_UPDATE',
        entidad: 'Servicio',
        entidadId: row.id,
        descripcion: `Servicio actualizado: ${row.nombre}.`,
        metadata: { codigoServicio: row.codigoServicio, precioUsd: row.precioUsd },
      });
      res.json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un servicio con ese codigo.');
      serializeError(res, 400, 'No se pudo actualizar el servicio.');
    }
  });

  app.delete('/api/servicios/:id', async (req, res) => {
    try {
      const row = await prisma.servicio.update({ where: { id: req.params.id }, data: { activo: false } });
      await safeAudit(logAudit, req, {
        accion: 'SERVICIO_DEACTIVATE',
        entidad: 'Servicio',
        entidadId: row.id,
        descripcion: `Servicio desactivado: ${row.nombre}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo desactivar el servicio.');
    }
  });

  app.get('/api/productos', async (req, res) => {
    try {
      const rows = await prisma.producto.findMany({
        where: buildSearchWhere(req.query, ['codigoProducto', 'nombre', 'descripcion']),
        include: { tipoProducto: true },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      res.json(rows);
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar los productos.');
    }
  });

  app.get('/api/productos/:id', async (req, res) => {
    try {
      const row = await prisma.producto.findUnique({ where: { id: req.params.id }, include: { tipoProducto: true } });
      if (!row) return serializeError(res, 404, 'Producto no encontrado.');
      res.json(row);
    } catch (error) {
      serializeError(res, 500, 'No se pudo cargar el producto.');
    }
  });

  app.post('/api/productos', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      const precioUsd = toNumber(req.body.precioUsd, 0);
      const stock = toNumber(req.body.stock, null);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      if (Number.isNaN(precioUsd) || precioUsd < 0) return serializeError(res, 400, 'El precio debe ser numerico y mayor o igual a 0.');
      if (Number.isNaN(stock) || (stock !== null && stock < 0)) return serializeError(res, 400, 'El stock debe ser numerico y mayor o igual a 0.');

      const row = await prisma.$transaction(async (tx) => {
        const tipoProductoId = await resolveTipo(tx, 'tipoProducto', 'tipoProductoId', 'tipoProductoNombre', req.body);
        const codigoProducto = nullableText(req.body.codigoProducto) || await nextCode(tx, 'producto', 'codigoProducto', 'PROD');
        return tx.producto.create({
          data: {
            codigoProducto,
            nombre,
            descripcion: nullableText(req.body.descripcion),
            tipoProductoId,
            precioUsd,
            stock,
            activo: parseActivo(req.body.activo),
          },
          include: { tipoProducto: true },
        });
      });
      await safeAudit(logAudit, req, {
        accion: 'PRODUCTO_CREATE',
        entidad: 'Producto',
        entidadId: row.id,
        descripcion: `Producto creado: ${row.nombre}.`,
        metadata: { codigoProducto: row.codigoProducto, precioUsd: row.precioUsd },
      });
      res.status(201).json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un producto con ese codigo.');
      serializeError(res, 400, 'No se pudo crear el producto.');
    }
  });

  app.put('/api/productos/:id', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      const precioUsd = toNumber(req.body.precioUsd, 0);
      const stock = toNumber(req.body.stock, null);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      if (Number.isNaN(precioUsd) || precioUsd < 0) return serializeError(res, 400, 'El precio debe ser numerico y mayor o igual a 0.');
      if (Number.isNaN(stock) || (stock !== null && stock < 0)) return serializeError(res, 400, 'El stock debe ser numerico y mayor o igual a 0.');

      const row = await prisma.$transaction(async (tx) => {
        const tipoProductoId = await resolveTipo(tx, 'tipoProducto', 'tipoProductoId', 'tipoProductoNombre', req.body);
        return tx.producto.update({
          where: { id: req.params.id },
          data: {
            codigoProducto: nullableText(req.body.codigoProducto),
            nombre,
            descripcion: nullableText(req.body.descripcion),
            tipoProductoId,
            precioUsd,
            stock,
            activo: parseActivo(req.body.activo),
          },
          include: { tipoProducto: true },
        });
      });
      await safeAudit(logAudit, req, {
        accion: 'PRODUCTO_UPDATE',
        entidad: 'Producto',
        entidadId: row.id,
        descripcion: `Producto actualizado: ${row.nombre}.`,
        metadata: { codigoProducto: row.codigoProducto, precioUsd: row.precioUsd },
      });
      res.json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un producto con ese codigo.');
      serializeError(res, 400, 'No se pudo actualizar el producto.');
    }
  });

  app.delete('/api/productos/:id', async (req, res) => {
    try {
      const row = await prisma.producto.update({ where: { id: req.params.id }, data: { activo: false } });
      await safeAudit(logAudit, req, {
        accion: 'PRODUCTO_DEACTIVATE',
        entidad: 'Producto',
        entidadId: row.id,
        descripcion: `Producto desactivado: ${row.nombre}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo desactivar el producto.');
    }
  });

  app.get('/api/proveedores', async (req, res) => {
    try {
      const rows = await prisma.proveedor.findMany({
        where: buildSearchWhere(req.query, ['codigoProveedor', 'nombre', 'rif', 'email', 'tipoEmpresa']),
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      res.json(rows);
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar los proveedores.');
    }
  });

  app.get('/api/proveedores/:id', async (req, res) => {
    try {
      const row = await prisma.proveedor.findUnique({ where: { id: req.params.id } });
      if (!row) return serializeError(res, 404, 'Proveedor no encontrado.');
      res.json(row);
    } catch (error) {
      serializeError(res, 500, 'No se pudo cargar el proveedor.');
    }
  });

  app.post('/api/proveedores', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      const row = await prisma.$transaction(async (tx) => {
        const codigoProveedor = nullableText(req.body.codigoProveedor) || await nextCode(tx, 'proveedor', 'codigoProveedor', 'PROV');
        return tx.proveedor.create({
          data: {
            codigoProveedor,
            nombre,
            rif: nullableText(req.body.rif),
            direccion: nullableText(req.body.direccion),
            telefono: nullableText(req.body.telefono),
            email: nullableText(req.body.email),
            tipoEmpresa: nullableText(req.body.tipoEmpresa),
            activo: parseActivo(req.body.activo),
          },
        });
      });
      await safeAudit(logAudit, req, {
        accion: 'PROVEEDOR_CREATE',
        entidad: 'Proveedor',
        entidadId: row.id,
        descripcion: `Proveedor creado: ${row.nombre}.`,
        metadata: { codigoProveedor: row.codigoProveedor, rif: row.rif },
      });
      res.status(201).json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un proveedor con ese codigo o RIF.');
      serializeError(res, 400, 'No se pudo crear el proveedor.');
    }
  });

  app.put('/api/proveedores/:id', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      const row = await prisma.proveedor.update({
        where: { id: req.params.id },
        data: {
          codigoProveedor: nullableText(req.body.codigoProveedor),
          nombre,
          rif: nullableText(req.body.rif),
          direccion: nullableText(req.body.direccion),
          telefono: nullableText(req.body.telefono),
          email: nullableText(req.body.email),
          tipoEmpresa: nullableText(req.body.tipoEmpresa),
          activo: parseActivo(req.body.activo),
        },
      });
      await safeAudit(logAudit, req, {
        accion: 'PROVEEDOR_UPDATE',
        entidad: 'Proveedor',
        entidadId: row.id,
        descripcion: `Proveedor actualizado: ${row.nombre}.`,
        metadata: { codigoProveedor: row.codigoProveedor, rif: row.rif },
      });
      res.json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un proveedor con ese codigo o RIF.');
      serializeError(res, 400, 'No se pudo actualizar el proveedor.');
    }
  });

  app.delete('/api/proveedores/:id', async (req, res) => {
    try {
      const row = await prisma.proveedor.update({ where: { id: req.params.id }, data: { activo: false } });
      await safeAudit(logAudit, req, {
        accion: 'PROVEEDOR_DEACTIVATE',
        entidad: 'Proveedor',
        entidadId: row.id,
        descripcion: `Proveedor desactivado: ${row.nombre}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo desactivar el proveedor.');
    }
  });
};

const movimientoStarlinkData = (pago, cuenta) => {
  const estado = normalizeEstado(pago.estado, PAGO_ESTADOS, 'PENDIENTE');
  const pagado = estado === 'PAGADO';
  const anulado = estado === 'ANULADO';
  const tipo = pagado || anulado ? 'INGRESO' : 'CUENTA_POR_COBRAR';
  const movimientoEstado = anulado ? 'ANULADO' : (pagado ? 'PAGADO' : estado === 'VENCIDO' ? 'VENCIDO' : 'PENDIENTE');

  return {
    tipo,
    categoria: 'Suscripcion',
    concepto: `Pago Starlink ${cuenta.nombreCuenta} ${pago.periodo}`,
    descripcion: `Servicio Starlink mensual. Cuenta: ${cuenta.nombreCuenta}.`,
    montoUsd: pago.montoUsd,
    tasaBcv: pago.tasaBcv,
    montoBs: pago.montoBs,
    tasaFuente: pago.tasaBcv ? 'MANUAL' : null,
    tasaEditadaManual: Boolean(pago.tasaBcv),
    fechaMovimiento: pago.fechaPago || new Date(),
    fechaVencimiento: pago.fechaCorte,
    estado: movimientoEstado,
    clienteId: pago.clienteId,
    referencia: pago.referencia || `STARLINK-${pago.periodo}`,
  };
};

const syncPagoStarlinkMovimiento = async (tx, pago) => {
  const cuenta = await tx.cuentaStarlink.findUnique({ where: { id: pago.cuentaStarlinkId } });
  if (!cuenta) return pago;

  const data = movimientoStarlinkData(pago, cuenta);
  if (pago.movimientoContableId) {
    await tx.movimientoContable.update({ where: { id: pago.movimientoContableId }, data });
    return pago;
  }

  const movimiento = await tx.movimientoContable.create({ data });
  return tx.pagoStarlink.update({
    where: { id: pago.id },
    data: { movimientoContableId: movimiento.id },
    include: { cliente: true, cuentaStarlink: true },
  });
};

const registerStarlinkRoutes = (app, { prisma, logAudit, serializeError }) => {
  app.get('/api/starlink/cuentas', async (req, res) => {
    try {
      const where = {};
      if (req.query.clienteId) where.clienteId = req.query.clienteId.toString();
      if (req.query.estado) where.estado = req.query.estado.toString();
      const rows = await prisma.cuentaStarlink.findMany({
        where,
        include: { cliente: true, antenas: true, pagos: { orderBy: { createdAt: 'desc' }, take: 3 } },
        orderBy: { updatedAt: 'desc' },
      });
      res.json(rows);
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar las cuentas Starlink.');
    }
  });

  app.post('/api/starlink/cuentas', async (req, res) => {
    try {
      const clienteId = nullableText(req.body.clienteId);
      const nombreCuenta = cleanText(req.body.nombreCuenta);
      if (!clienteId || !nombreCuenta) return serializeError(res, 400, 'Cliente y nombre de cuenta son obligatorios.');

      const row = await prisma.cuentaStarlink.create({
        data: {
          clienteId,
          nombreCuenta,
          correoCuenta: nullableText(req.body.correoCuenta),
          referencia: nullableText(req.body.referencia),
          tipoServicio: nullableText(req.body.tipoServicio) || 'SERVICIO_COMPLETO',
          montoMensualUsd: toNumber(req.body.montoMensualUsd, null),
          fechaCorte: parseDate(req.body.fechaCorte),
          estado: normalizeEstado(req.body.estado, STARLINK_ESTADOS, 'ACTIVA'),
          observaciones: nullableText(req.body.observaciones),
        },
        include: { cliente: true, antenas: true, pagos: true },
      });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_CUENTA_CREATE',
        entidad: 'CuentaStarlink',
        entidadId: row.id,
        descripcion: `Cuenta Starlink creada: ${row.nombreCuenta}.`,
      });
      res.status(201).json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo crear la cuenta Starlink.');
    }
  });

  app.get('/api/starlink/cuentas/:id', async (req, res) => {
    try {
      const row = await prisma.cuentaStarlink.findUnique({
        where: { id: req.params.id },
        include: { cliente: true, antenas: true, pagos: { orderBy: { createdAt: 'desc' } } },
      });
      if (!row) return serializeError(res, 404, 'Cuenta Starlink no encontrada.');
      res.json(row);
    } catch (error) {
      serializeError(res, 500, 'No se pudo cargar la cuenta Starlink.');
    }
  });

  app.put('/api/starlink/cuentas/:id', async (req, res) => {
    try {
      const row = await prisma.cuentaStarlink.update({
        where: { id: req.params.id },
        data: {
          clienteId: nullableText(req.body.clienteId),
          nombreCuenta: cleanText(req.body.nombreCuenta),
          correoCuenta: nullableText(req.body.correoCuenta),
          referencia: nullableText(req.body.referencia),
          tipoServicio: nullableText(req.body.tipoServicio) || 'SERVICIO_COMPLETO',
          montoMensualUsd: toNumber(req.body.montoMensualUsd, null),
          fechaCorte: parseDate(req.body.fechaCorte),
          estado: normalizeEstado(req.body.estado, STARLINK_ESTADOS, 'ACTIVA'),
          observaciones: nullableText(req.body.observaciones),
        },
        include: { cliente: true, antenas: true, pagos: true },
      });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_CUENTA_UPDATE',
        entidad: 'CuentaStarlink',
        entidadId: row.id,
        descripcion: `Cuenta Starlink actualizada: ${row.nombreCuenta}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo actualizar la cuenta Starlink.');
    }
  });

  app.delete('/api/starlink/cuentas/:id', async (req, res) => {
    try {
      const row = await prisma.cuentaStarlink.update({ where: { id: req.params.id }, data: { estado: 'INACTIVA' } });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_CUENTA_DEACTIVATE',
        entidad: 'CuentaStarlink',
        entidadId: row.id,
        descripcion: `Cuenta Starlink desactivada: ${row.nombreCuenta}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo desactivar la cuenta Starlink.');
    }
  });

  app.get('/api/starlink/antenas', async (req, res) => {
    try {
      const where = {};
      if (req.query.clienteId) where.clienteId = req.query.clienteId.toString();
      if (req.query.cuentaStarlinkId) where.cuentaStarlinkId = req.query.cuentaStarlinkId.toString();
      if (req.query.estado) where.estado = req.query.estado.toString();
      res.json(await prisma.antenaStarlink.findMany({
        where,
        include: { cliente: true, cuentaStarlink: true },
        orderBy: { updatedAt: 'desc' },
      }));
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar las antenas Starlink.');
    }
  });

  app.post('/api/starlink/antenas', async (req, res) => {
    try {
      const cuenta = req.body.cuentaStarlinkId
        ? await prisma.cuentaStarlink.findUnique({ where: { id: req.body.cuentaStarlinkId } })
        : null;
      const clienteId = nullableText(req.body.clienteId) || cuenta?.clienteId;
      const nombreAntena = cleanText(req.body.nombreAntena);
      if (!clienteId || !nombreAntena) return serializeError(res, 400, 'Cliente y nombre de antena son obligatorios.');

      const row = await prisma.antenaStarlink.create({
        data: {
          clienteId,
          cuentaStarlinkId: cuenta?.id || nullableText(req.body.cuentaStarlinkId),
          numeroKit: nullableText(req.body.numeroKit),
          numeroSerie: nullableText(req.body.numeroSerie),
          nombreAntena,
          ubicacion: nullableText(req.body.ubicacion),
          fechaRegistro: parseDate(req.body.fechaRegistro) || new Date(),
          fechaCorte: parseDate(req.body.fechaCorte),
          tipoServicio: nullableText(req.body.tipoServicio) || cuenta?.tipoServicio || 'SERVICIO_COMPLETO',
          estado: normalizeEstado(req.body.estado, STARLINK_ESTADOS, 'ACTIVA'),
          observaciones: nullableText(req.body.observaciones),
        },
        include: { cliente: true, cuentaStarlink: true },
      });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_ANTENA_CREATE',
        entidad: 'AntenaStarlink',
        entidadId: row.id,
        descripcion: `Antena Starlink creada: ${row.nombreAntena}.`,
      });
      res.status(201).json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe una antena con ese numero de kit.');
      serializeError(res, 400, 'No se pudo crear la antena Starlink.');
    }
  });

  app.get('/api/starlink/antenas/:id', async (req, res) => {
    try {
      const row = await prisma.antenaStarlink.findUnique({ where: { id: req.params.id }, include: { cliente: true, cuentaStarlink: true } });
      if (!row) return serializeError(res, 404, 'Antena Starlink no encontrada.');
      res.json(row);
    } catch (error) {
      serializeError(res, 500, 'No se pudo cargar la antena Starlink.');
    }
  });

  app.put('/api/starlink/antenas/:id', async (req, res) => {
    try {
      const cuenta = req.body.cuentaStarlinkId
        ? await prisma.cuentaStarlink.findUnique({ where: { id: req.body.cuentaStarlinkId } })
        : null;
      const row = await prisma.antenaStarlink.update({
        where: { id: req.params.id },
        data: {
          clienteId: nullableText(req.body.clienteId) || cuenta?.clienteId,
          cuentaStarlinkId: cuenta?.id || nullableText(req.body.cuentaStarlinkId),
          numeroKit: nullableText(req.body.numeroKit),
          numeroSerie: nullableText(req.body.numeroSerie),
          nombreAntena: cleanText(req.body.nombreAntena),
          ubicacion: nullableText(req.body.ubicacion),
          fechaRegistro: parseDate(req.body.fechaRegistro) || undefined,
          fechaCorte: parseDate(req.body.fechaCorte),
          tipoServicio: nullableText(req.body.tipoServicio) || cuenta?.tipoServicio || 'SERVICIO_COMPLETO',
          estado: normalizeEstado(req.body.estado, STARLINK_ESTADOS, 'ACTIVA'),
          observaciones: nullableText(req.body.observaciones),
        },
        include: { cliente: true, cuentaStarlink: true },
      });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_ANTENA_UPDATE',
        entidad: 'AntenaStarlink',
        entidadId: row.id,
        descripcion: `Antena Starlink actualizada: ${row.nombreAntena}.`,
      });
      res.json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe una antena con ese numero de kit.');
      serializeError(res, 400, 'No se pudo actualizar la antena Starlink.');
    }
  });

  app.delete('/api/starlink/antenas/:id', async (req, res) => {
    try {
      const row = await prisma.antenaStarlink.update({ where: { id: req.params.id }, data: { estado: 'INACTIVA' } });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_ANTENA_DEACTIVATE',
        entidad: 'AntenaStarlink',
        entidadId: row.id,
        descripcion: `Antena Starlink desactivada: ${row.nombreAntena}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo desactivar la antena Starlink.');
    }
  });

  app.get('/api/starlink/pagos', async (req, res) => {
    try {
      const where = {};
      if (req.query.cuentaStarlinkId) where.cuentaStarlinkId = req.query.cuentaStarlinkId.toString();
      if (req.query.clienteId) where.clienteId = req.query.clienteId.toString();
      if (req.query.estado) where.estado = req.query.estado.toString();
      res.json(await prisma.pagoStarlink.findMany({
        where,
        include: { cliente: true, cuentaStarlink: true },
        orderBy: { fechaCorte: 'desc' },
      }));
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar los pagos Starlink.');
    }
  });

  app.post('/api/starlink/pagos', async (req, res) => {
    try {
      const cuenta = await prisma.cuentaStarlink.findUnique({ where: { id: req.body.cuentaStarlinkId } });
      if (!cuenta) return serializeError(res, 400, 'Cuenta Starlink invalida.');
      const montoUsd = toNumber(req.body.montoUsd, cuenta.montoMensualUsd || 0);
      const tasaBcv = toNumber(req.body.tasaBcv, null);
      const fechaCorte = parseDate(req.body.fechaCorte || cuenta.fechaCorte);
      if (Number.isNaN(montoUsd) || montoUsd < 0) return serializeError(res, 400, 'Monto USD invalido.');
      if (!fechaCorte) return serializeError(res, 400, 'La fecha de corte es obligatoria.');

      const row = await prisma.$transaction(async (tx) => {
        const pago = await tx.pagoStarlink.create({
          data: {
            cuentaStarlinkId: cuenta.id,
            clienteId: cuenta.clienteId,
            periodo: cleanText(req.body.periodo) || fechaCorte.toISOString().slice(0, 7),
            montoUsd,
            tasaBcv,
            montoBs: tasaBcv && !Number.isNaN(tasaBcv) ? Number((montoUsd * tasaBcv).toFixed(2)) : null,
            fechaPago: parseDate(req.body.fechaPago),
            fechaCorte,
            estado: normalizeEstado(req.body.estado, PAGO_ESTADOS, 'PENDIENTE'),
            referencia: nullableText(req.body.referencia),
          },
          include: { cliente: true, cuentaStarlink: true },
        });
        return syncPagoStarlinkMovimiento(tx, pago);
      });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_PAGO_CREATE',
        entidad: 'PagoStarlink',
        entidadId: row.id,
        descripcion: `Pago Starlink registrado: ${row.periodo}.`,
        metadata: { estado: row.estado, montoUsd: row.montoUsd },
      });
      res.status(201).json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo registrar el pago Starlink.');
    }
  });

  app.put('/api/starlink/pagos/:id', async (req, res) => {
    try {
      const actual = await prisma.pagoStarlink.findUnique({ where: { id: req.params.id } });
      if (!actual) return serializeError(res, 404, 'Pago Starlink no encontrado.');
      const cuenta = await prisma.cuentaStarlink.findUnique({ where: { id: req.body.cuentaStarlinkId || actual.cuentaStarlinkId } });
      const montoUsd = toNumber(req.body.montoUsd, actual.montoUsd);
      const tasaBcv = toNumber(req.body.tasaBcv, actual.tasaBcv);
      const fechaCorte = parseDate(req.body.fechaCorte) || actual.fechaCorte;

      const row = await prisma.$transaction(async (tx) => {
        const pago = await tx.pagoStarlink.update({
          where: { id: req.params.id },
          data: {
            cuentaStarlinkId: cuenta.id,
            clienteId: cuenta.clienteId,
            periodo: cleanText(req.body.periodo) || actual.periodo,
            montoUsd,
            tasaBcv,
            montoBs: tasaBcv && !Number.isNaN(tasaBcv) ? Number((montoUsd * tasaBcv).toFixed(2)) : null,
            fechaPago: parseDate(req.body.fechaPago),
            fechaCorte,
            estado: normalizeEstado(req.body.estado, PAGO_ESTADOS, actual.estado),
            referencia: nullableText(req.body.referencia),
          },
          include: { cliente: true, cuentaStarlink: true },
        });
        return syncPagoStarlinkMovimiento(tx, pago);
      });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_PAGO_UPDATE',
        entidad: 'PagoStarlink',
        entidadId: row.id,
        descripcion: `Pago Starlink actualizado: ${row.periodo}.`,
        metadata: { estado: row.estado, montoUsd: row.montoUsd },
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo actualizar el pago Starlink.');
    }
  });

  app.delete('/api/starlink/pagos/:id', async (req, res) => {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const pago = await tx.pagoStarlink.update({ where: { id: req.params.id }, data: { estado: 'ANULADO' } });
        if (pago.movimientoContableId) {
          await tx.movimientoContable.update({ where: { id: pago.movimientoContableId }, data: { estado: 'ANULADO' } });
        }
        return pago;
      });
      await safeAudit(logAudit, req, {
        accion: 'STARLINK_PAGO_ANULAR',
        entidad: 'PagoStarlink',
        entidadId: row.id,
        descripcion: `Pago Starlink anulado: ${row.periodo}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo anular el pago Starlink.');
    }
  });

  app.get('/api/starlink/alertas', async (req, res) => {
    try {
      const cuentas = await prisma.cuentaStarlink.findMany({
        where: { estado: { not: 'INACTIVA' } },
        include: {
          cliente: true,
          antenas: true,
          pagos: { orderBy: { fechaCorte: 'desc' }, take: 1 },
        },
      });
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const alertas = cuentas
        .map((cuenta) => {
          const fechaBase = cuenta.fechaCorte || cuenta.antenas
            .map((antena) => antena.fechaCorte)
            .filter(Boolean)
            .sort((a, b) => new Date(a) - new Date(b))[0];
          if (!fechaBase || cuenta.tipoServicio === 'SOLO_ANTENAS') return null;
          const fechaCorte = new Date(fechaBase);
          fechaCorte.setHours(0, 0, 0, 0);
          const diasRestantes = Math.ceil((fechaCorte - today) / 86400000);
          const ultimoPago = cuenta.pagos[0];
          const estadoPago = ultimoPago?.estado || 'PENDIENTE';
          const semaforo = diasRestantes < 0 || estadoPago === 'VENCIDO'
            ? 'ROJO'
            : diasRestantes <= 10 || estadoPago === 'PENDIENTE'
              ? 'AMARILLO'
              : 'VERDE';

          return {
            cuentaId: cuenta.id,
            cliente: cuenta.cliente,
            nombreCuenta: cuenta.nombreCuenta,
            cantidadAntenas: cuenta.antenas.length,
            fechaCorte,
            diasRestantes,
            estadoPago,
            semaforo,
            montoMensualUsd: cuenta.montoMensualUsd || 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.diasRestantes - b.diasRestantes);

      res.json({ alertas });
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar las alertas Starlink.');
    }
  });
};

const movimientoNominaData = (nomina, empleado) => {
  const pagado = nomina.estado === 'PAGADO';
  const anulado = nomina.estado === 'ANULADO';
  return {
    tipo: pagado || anulado ? 'EGRESO' : 'CUENTA_POR_PAGAR',
    categoria: 'Nomina',
    concepto: `Nomina ${nomina.periodo} - ${empleado.nombre} ${empleado.apellido || ''}`.trim(),
    descripcion: `Pago de nomina para ${empleado.cargo || 'empleado'}.`,
    montoUsd: nomina.totalUsd,
    tasaBcv: nomina.tasaBcv,
    montoBs: nomina.totalBs,
    tasaFuente: nomina.tasaBcv ? 'MANUAL' : null,
    tasaEditadaManual: Boolean(nomina.tasaBcv),
    fechaMovimiento: nomina.fechaPago || new Date(),
    fechaVencimiento: null,
    estado: anulado ? 'ANULADO' : pagado ? 'PAGADO' : 'PENDIENTE',
    proveedorId: empleado.codigoEmpleado || empleado.id,
    referencia: nomina.referencia || `NOMINA-${nomina.periodo}`,
  };
};

const syncNominaMovimiento = async (tx, nomina) => {
  const empleado = await tx.empleado.findUnique({ where: { id: nomina.empleadoId } });
  if (!empleado) return nomina;
  const data = movimientoNominaData(nomina, empleado);
  if (nomina.movimientoContableId) {
    await tx.movimientoContable.update({ where: { id: nomina.movimientoContableId }, data });
    return nomina;
  }
  const movimiento = await tx.movimientoContable.create({ data });
  return tx.nomina.update({
    where: { id: nomina.id },
    data: { movimientoContableId: movimiento.id },
    include: { empleado: true },
  });
};

const registerNominaRoutes = (app, { prisma, logAudit, serializeError }) => {
  app.get('/api/empleados/siguiente-codigo', async (req, res) => {
    try {
      res.json({ codigoEmpleado: await prisma.$transaction((tx) => nextCode(tx, 'empleado', 'codigoEmpleado', 'EMP')) });
    } catch (error) {
      serializeError(res, 500, 'No se pudo generar el codigo de empleado.');
    }
  });

  app.get('/api/empleados', async (req, res) => {
    try {
      const rows = await prisma.empleado.findMany({
        where: buildSearchWhere(req.query, ['codigoEmpleado', 'nombre', 'apellido', 'cedula', 'cargo', 'email']),
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      res.json(rows);
    } catch (error) {
      serializeError(res, 500, 'No se pudieron cargar los empleados.');
    }
  });

  app.post('/api/empleados', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      const salarioBaseUsd = toNumber(req.body.salarioBaseUsd, null);
      const row = await prisma.$transaction(async (tx) => {
        const codigoEmpleado = nullableText(req.body.codigoEmpleado) || await nextCode(tx, 'empleado', 'codigoEmpleado', 'EMP');
        return tx.empleado.create({
          data: {
            codigoEmpleado,
            nombre,
            apellido: nullableText(req.body.apellido),
            cedula: nullableText(req.body.cedula),
            cargo: nullableText(req.body.cargo),
            telefono: nullableText(req.body.telefono),
            email: nullableText(req.body.email),
            fechaIngreso: parseDate(req.body.fechaIngreso),
            salarioBaseUsd,
            activo: parseActivo(req.body.activo),
          },
        });
      });
      await safeAudit(logAudit, req, {
        accion: 'EMPLEADO_CREATE',
        entidad: 'Empleado',
        entidadId: row.id,
        descripcion: `Empleado creado: ${row.nombre}.`,
      });
      res.status(201).json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un empleado con ese codigo o cedula.');
      serializeError(res, 400, 'No se pudo crear el empleado.');
    }
  });

  app.put('/api/empleados/:id', async (req, res) => {
    try {
      const nombre = cleanText(req.body.nombre);
      if (!nombre) return serializeError(res, 400, 'El nombre es obligatorio.');
      const row = await prisma.empleado.update({
        where: { id: req.params.id },
        data: {
          codigoEmpleado: nullableText(req.body.codigoEmpleado),
          nombre,
          apellido: nullableText(req.body.apellido),
          cedula: nullableText(req.body.cedula),
          cargo: nullableText(req.body.cargo),
          telefono: nullableText(req.body.telefono),
          email: nullableText(req.body.email),
          fechaIngreso: parseDate(req.body.fechaIngreso),
          salarioBaseUsd: toNumber(req.body.salarioBaseUsd, null),
          activo: parseActivo(req.body.activo),
        },
      });
      await safeAudit(logAudit, req, {
        accion: 'EMPLEADO_UPDATE',
        entidad: 'Empleado',
        entidadId: row.id,
        descripcion: `Empleado actualizado: ${row.nombre}.`,
      });
      res.json(row);
    } catch (error) {
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un empleado con ese codigo o cedula.');
      serializeError(res, 400, 'No se pudo actualizar el empleado.');
    }
  });

  app.delete('/api/empleados/:id', async (req, res) => {
    try {
      const row = await prisma.empleado.update({ where: { id: req.params.id }, data: { activo: false } });
      await safeAudit(logAudit, req, {
        accion: 'EMPLEADO_DEACTIVATE',
        entidad: 'Empleado',
        entidadId: row.id,
        descripcion: `Empleado desactivado: ${row.nombre}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo desactivar el empleado.');
    }
  });

  app.get('/api/nomina', async (req, res) => {
    try {
      const where = {};
      if (req.query.periodo) where.periodo = req.query.periodo.toString();
      if (req.query.estado) where.estado = req.query.estado.toString();
      if (req.query.empleadoId) where.empleadoId = req.query.empleadoId.toString();
      res.json(await prisma.nomina.findMany({
        where,
        include: { empleado: true },
        orderBy: { createdAt: 'desc' },
      }));
    } catch (error) {
      serializeError(res, 500, 'No se pudo cargar la nomina.');
    }
  });

  app.post('/api/nomina', async (req, res) => {
    try {
      const empleado = await prisma.empleado.findUnique({ where: { id: req.body.empleadoId } });
      if (!empleado) return serializeError(res, 400, 'Empleado invalido.');
      const salarioBaseUsd = toNumber(req.body.salarioBaseUsd, empleado.salarioBaseUsd || 0);
      const bonosUsd = toNumber(req.body.bonosUsd, 0);
      const deduccionesUsd = toNumber(req.body.deduccionesUsd, 0);
      const tasaBcv = toNumber(req.body.tasaBcv, null);
      if ([salarioBaseUsd, bonosUsd, deduccionesUsd].some(Number.isNaN)) return serializeError(res, 400, 'Montos invalidos.');
      const totalUsd = Number((salarioBaseUsd + bonosUsd - deduccionesUsd).toFixed(2));
      const totalBs = tasaBcv && !Number.isNaN(tasaBcv) ? Number((totalUsd * tasaBcv).toFixed(2)) : null;

      const row = await prisma.$transaction(async (tx) => {
        const nomina = await tx.nomina.create({
          data: {
            empleadoId: empleado.id,
            periodo: cleanText(req.body.periodo) || new Date().toISOString().slice(0, 7),
            salarioBaseUsd,
            bonosUsd,
            deduccionesUsd,
            totalUsd,
            tasaBcv,
            totalBs,
            fechaPago: parseDate(req.body.fechaPago),
            estado: normalizeEstado(req.body.estado, NOMINA_ESTADOS, 'PENDIENTE'),
            referencia: nullableText(req.body.referencia),
          },
          include: { empleado: true },
        });
        return syncNominaMovimiento(tx, nomina);
      });
      await safeAudit(logAudit, req, {
        accion: 'NOMINA_CREATE',
        entidad: 'Nomina',
        entidadId: row.id,
        descripcion: `Nomina registrada: ${row.periodo}.`,
        metadata: { empleadoId: row.empleadoId, estado: row.estado, totalUsd: row.totalUsd },
      });
      res.status(201).json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo registrar la nomina.');
    }
  });

  app.put('/api/nomina/:id', async (req, res) => {
    try {
      const actual = await prisma.nomina.findUnique({ where: { id: req.params.id } });
      if (!actual) return serializeError(res, 404, 'Nomina no encontrada.');
      const empleado = await prisma.empleado.findUnique({ where: { id: req.body.empleadoId || actual.empleadoId } });
      const salarioBaseUsd = toNumber(req.body.salarioBaseUsd, actual.salarioBaseUsd);
      const bonosUsd = toNumber(req.body.bonosUsd, actual.bonosUsd);
      const deduccionesUsd = toNumber(req.body.deduccionesUsd, actual.deduccionesUsd);
      const tasaBcv = toNumber(req.body.tasaBcv, actual.tasaBcv);
      const totalUsd = Number((salarioBaseUsd + bonosUsd - deduccionesUsd).toFixed(2));
      const totalBs = tasaBcv && !Number.isNaN(tasaBcv) ? Number((totalUsd * tasaBcv).toFixed(2)) : null;

      const row = await prisma.$transaction(async (tx) => {
        const nomina = await tx.nomina.update({
          where: { id: req.params.id },
          data: {
            empleadoId: empleado.id,
            periodo: cleanText(req.body.periodo) || actual.periodo,
            salarioBaseUsd,
            bonosUsd,
            deduccionesUsd,
            totalUsd,
            tasaBcv,
            totalBs,
            fechaPago: parseDate(req.body.fechaPago),
            estado: normalizeEstado(req.body.estado, NOMINA_ESTADOS, actual.estado),
            referencia: nullableText(req.body.referencia),
          },
          include: { empleado: true },
        });
        return syncNominaMovimiento(tx, nomina);
      });
      await safeAudit(logAudit, req, {
        accion: 'NOMINA_UPDATE',
        entidad: 'Nomina',
        entidadId: row.id,
        descripcion: `Nomina actualizada: ${row.periodo}.`,
        metadata: { empleadoId: row.empleadoId, estado: row.estado, totalUsd: row.totalUsd },
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo actualizar la nomina.');
    }
  });

  app.delete('/api/nomina/:id', async (req, res) => {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const nomina = await tx.nomina.update({ where: { id: req.params.id }, data: { estado: 'ANULADO' } });
        if (nomina.movimientoContableId) {
          await tx.movimientoContable.update({ where: { id: nomina.movimientoContableId }, data: { estado: 'ANULADO' } });
        }
        return nomina;
      });
      await safeAudit(logAudit, req, {
        accion: 'NOMINA_ANULAR',
        entidad: 'Nomina',
        entidadId: row.id,
        descripcion: `Nomina anulada: ${row.periodo}.`,
      });
      res.json(row);
    } catch (error) {
      serializeError(res, 400, 'No se pudo anular la nomina.');
    }
  });
};

const registerEnterpriseRoutes = (app, deps) => {
  registerCatalogRoutes(app, deps);
  registerStarlinkRoutes(app, deps);
  registerNominaRoutes(app, deps);

  app.get('/api/catalogos/categorias-contables', (req, res) => {
    res.json(CATEGORIAS_CONTABLES);
  });
};

module.exports = { registerEnterpriseRoutes };
