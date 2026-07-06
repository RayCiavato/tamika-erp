const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 5000;

const MOVIMIENTO_TIPOS = ['INGRESO', 'EGRESO', 'CUENTA_POR_COBRAR', 'CUENTA_POR_PAGAR'];
const MOVIMIENTO_ESTADOS = ['PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO'];
const PENDIENTE_ESTADOS = ['PENDIENTE', 'VENCIDO'];

app.use(cors());
app.use(express.json());

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const serializeError = (res, status, message, details) => {
  res.status(status).json({ error: message, details });
};

const normalizeMovimientoPayload = (body) => {
  const errors = [];
  const tipo = body.tipo;
  const estado = body.estado || 'PENDIENTE';
  const montoUsd = toNumber(body.montoUsd);
  const tasaBcv = toNumber(body.tasaBcv);
  const montoBsInput = toNumber(body.montoBs);
  const fechaMovimiento = parseDate(body.fechaMovimiento);
  const fechaVencimiento = parseDate(body.fechaVencimiento);

  if (!MOVIMIENTO_TIPOS.includes(tipo)) errors.push('tipo debe ser valido.');
  if (!body.concepto || !body.concepto.toString().trim()) errors.push('concepto es obligatorio.');
  if (Number.isNaN(montoUsd) || montoUsd === null || montoUsd < 0) errors.push('montoUsd debe ser numerico y mayor o igual a 0.');
  if (!MOVIMIENTO_ESTADOS.includes(estado)) errors.push('estado debe ser valido.');
  if (!fechaMovimiento) errors.push('fechaMovimiento es obligatoria y debe ser valida.');
  if (body.tasaBcv !== undefined && body.tasaBcv !== null && body.tasaBcv !== '' && (Number.isNaN(tasaBcv) || tasaBcv < 0)) errors.push('tasaBcv debe ser numerica y mayor o igual a 0.');
  if (body.fechaVencimiento && !fechaVencimiento) errors.push('fechaVencimiento debe ser valida.');
  if (body.montoBs !== undefined && body.montoBs !== null && body.montoBs !== '' && (Number.isNaN(montoBsInput) || montoBsInput < 0)) errors.push('montoBs debe ser numerico y mayor o igual a 0.');

  if (errors.length) return { errors };

  const montoBs = tasaBcv !== null && tasaBcv > 0 ? Number((montoUsd * tasaBcv).toFixed(2)) : montoBsInput;

  return {
    data: {
      tipo,
      concepto: body.concepto.toString().trim(),
      descripcion: body.descripcion?.toString().trim() || null,
      montoUsd,
      tasaBcv: tasaBcv === null || Number.isNaN(tasaBcv) ? null : tasaBcv,
      montoBs: montoBs === null || Number.isNaN(montoBs) ? null : montoBs,
      fechaMovimiento,
      fechaVencimiento,
      estado,
      clienteId: body.clienteId || null,
      proveedorId: body.proveedorId?.toString().trim() || null,
      referencia: body.referencia?.toString().trim() || null,
    },
  };
};

const calcularResumenContable = (movimientos) => {
  return movimientos.reduce((acc, mov) => {
    if (mov.estado === 'ANULADO') return acc;

    const monto = Number(mov.montoUsd || 0);
    const fecha = new Date(mov.fechaMovimiento);
    const mesActual = new Date();
    const esMesActual = fecha.getMonth() === mesActual.getMonth() && fecha.getFullYear() === mesActual.getFullYear();
    const ingresoReal = (mov.tipo === 'INGRESO' || mov.tipo === 'CUENTA_POR_COBRAR') && mov.estado === 'PAGADO';
    const egresoReal = (mov.tipo === 'EGRESO' || mov.tipo === 'CUENTA_POR_PAGAR') && mov.estado === 'PAGADO';

    if (ingresoReal) {
      acc.totalIngresos += monto;
      acc.balance += monto;
      if (esMesActual) acc.ingresosMes += monto;
    }

    if (egresoReal) {
      acc.totalEgresos += monto;
      acc.balance -= monto;
      if (esMesActual) acc.egresosMes += monto;
    }

    if (mov.tipo === 'CUENTA_POR_COBRAR' && PENDIENTE_ESTADOS.includes(mov.estado)) {
      acc.pendientePorCobrar += monto;
      acc.cuentasPorCobrarPendientes += 1;
    }

    if (mov.tipo === 'CUENTA_POR_PAGAR' && PENDIENTE_ESTADOS.includes(mov.estado)) {
      acc.pendientePorPagar += monto;
      acc.cuentasPorPagarPendientes += 1;
    }

    return acc;
  }, {
    totalIngresos: 0,
    totalEgresos: 0,
    ingresosMes: 0,
    egresosMes: 0,
    balance: 0,
    pendientePorCobrar: 0,
    pendientePorPagar: 0,
    cuentasPorCobrarPendientes: 0,
    cuentasPorPagarPendientes: 0,
  });
};

const buildContabilidadWhere = (query) => {
  const filters = [];

  if (query.tipo && MOVIMIENTO_TIPOS.includes(query.tipo)) filters.push({ tipo: query.tipo });
  if (query.estado && MOVIMIENTO_ESTADOS.includes(query.estado)) filters.push({ estado: query.estado });

  const desde = parseDate(query.desde);
  const hasta = parseDate(query.hasta);
  if (desde || hasta) {
    filters.push({
      fechaMovimiento: {
        ...(desde ? { gte: desde } : {}),
        ...(hasta ? { lte: hasta } : {}),
      },
    });
  }

  if (query.buscar) {
    const buscar = query.buscar.toString().trim();
    filters.push({
      OR: [
        { concepto: { contains: buscar, mode: 'insensitive' } },
        { referencia: { contains: buscar, mode: 'insensitive' } },
        { descripcion: { contains: buscar, mode: 'insensitive' } },
      ],
    });
  }

  return filters.length ? { AND: filters } : {};
};

// CLIENTES
app.get('/api/clientes', async (req, res) => {
  try {
    res.json(await prisma.cliente.findMany({ orderBy: { nombre: 'asc' } }));
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar los clientes.');
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    res.json(await prisma.cliente.create({ data: req.body }));
  } catch (error) {
    serializeError(res, 400, 'No se pudo crear el cliente.');
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    res.json(await prisma.cliente.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) {
    serializeError(res, 400, 'No se pudo actualizar el cliente.');
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await prisma.cliente.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    serializeError(res, 400, 'No se pudo eliminar el cliente.');
  }
});

// COTIZACIONES
app.get('/api/cotizaciones', async (req, res) => {
  try {
    res.json(await prisma.cotizacion.findMany({ include: { cliente: true }, orderBy: { fecha: 'desc' } }));
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar las cotizaciones.');
  }
});

app.post('/api/cotizaciones', async (req, res) => {
  try {
    if (await prisma.cotizacion.findUnique({ where: { numero: req.body.numero } })) return res.status(400).json({ error: 'DUPLICADO' });
    res.json(await prisma.cotizacion.create({ data: req.body }));
  } catch (error) {
    serializeError(res, 500, 'No se pudo crear la cotizacion.');
  }
});

app.put('/api/cotizaciones/:id', async (req, res) => {
  try {
    res.json(await prisma.cotizacion.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) {
    serializeError(res, 400, 'No se pudo actualizar la cotizacion.');
  }
});

// TASAS
app.get('/api/tasas', async (req, res) => {
  try {
    res.json(await prisma.tasa.findFirst({ orderBy: { fecha: 'desc' } }) || { bcv: 0, paralelo: 0 });
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar la tasa.');
  }
});

app.post('/api/tasas', async (req, res) => {
  try {
    res.json(await prisma.tasa.create({ data: req.body }));
  } catch (error) {
    serializeError(res, 400, 'No se pudo guardar la tasa.');
  }
});

// DASHBOARD
app.get('/api/dashboard/resumen', async (req, res) => {
  try {
    const [totalClientes, totalCotizaciones, ventas, movimientos, ultimosMovimientos] = await Promise.all([
      prisma.cliente.count(),
      prisma.cotizacion.count(),
      prisma.venta.findMany(),
      prisma.movimientoContable.findMany(),
      prisma.movimientoContable.findMany({
        include: { cliente: true },
        orderBy: { fechaMovimiento: 'desc' },
        take: 6,
      }),
    ]);

    const resumen = calcularResumenContable(movimientos);

    res.json({
      kpis: {
        totalClientes,
        totalProveedores: 0,
        totalProductos: 0,
        totalCotizaciones,
        totalVentas: ventas.length,
        ingresosMes: resumen.ingresosMes,
        egresosMes: resumen.egresosMes,
        balanceActual: resumen.balance,
        cuentasPorCobrarPendientes: resumen.cuentasPorCobrarPendientes,
        cuentasPorPagarPendientes: resumen.cuentasPorPagarPendientes,
        montoPorCobrar: resumen.pendientePorCobrar,
        montoPorPagar: resumen.pendientePorPagar,
      },
      ultimosMovimientos,
    });
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar el resumen del dashboard.');
  }
});

// CONTABILIDAD
app.get('/api/contabilidad', async (req, res) => {
  try {
    const where = buildContabilidadWhere(req.query);
    const movimientos = await prisma.movimientoContable.findMany({
      where,
      include: { cliente: true },
      orderBy: { fechaMovimiento: 'desc' },
    });

    res.json({ movimientos, resumen: calcularResumenContable(movimientos) });
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar los movimientos contables.');
  }
});

app.get('/api/contabilidad/:id', async (req, res) => {
  try {
    const movimiento = await prisma.movimientoContable.findUnique({
      where: { id: req.params.id },
      include: { cliente: true },
    });

    if (!movimiento) return serializeError(res, 404, 'Movimiento no encontrado.');
    res.json(movimiento);
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar el movimiento.');
  }
});

app.post('/api/contabilidad', async (req, res) => {
  try {
    const normalized = normalizeMovimientoPayload(req.body);
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const movimiento = await prisma.movimientoContable.create({
      data: normalized.data,
      include: { cliente: true },
    });

    res.status(201).json(movimiento);
  } catch (error) {
    serializeError(res, 500, 'No se pudo crear el movimiento contable.');
  }
});

app.put('/api/contabilidad/:id', async (req, res) => {
  try {
    const actual = await prisma.movimientoContable.findUnique({ where: { id: req.params.id } });
    if (!actual) return serializeError(res, 404, 'Movimiento no encontrado.');

    const merged = {
      ...actual,
      ...req.body,
      fechaMovimiento: req.body.fechaMovimiento || actual.fechaMovimiento,
      fechaVencimiento: req.body.fechaVencimiento === undefined ? actual.fechaVencimiento : req.body.fechaVencimiento,
    };
    const normalized = normalizeMovimientoPayload(merged);
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const movimiento = await prisma.movimientoContable.update({
      where: { id: req.params.id },
      data: normalized.data,
      include: { cliente: true },
    });

    res.json(movimiento);
  } catch (error) {
    serializeError(res, 500, 'No se pudo actualizar el movimiento contable.');
  }
});

app.delete('/api/contabilidad/:id', async (req, res) => {
  try {
    await prisma.movimientoContable.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    serializeError(res, 400, 'No se pudo eliminar el movimiento contable.');
  }
});

app.listen(port, () => console.log(`Backend corriendo en ${port}`));
