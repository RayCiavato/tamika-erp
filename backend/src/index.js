const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 5000;
const readPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const MOVIMIENTO_TIPOS = ['INGRESO', 'EGRESO', 'CUENTA_POR_COBRAR', 'CUENTA_POR_PAGAR'];
const MOVIMIENTO_ESTADOS = ['PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO'];
const PENDIENTE_ESTADOS = ['PENDIENTE', 'VENCIDO'];
const DOCUMENTO_TIPOS = ['PROPUESTA', 'PRESUPUESTO'];
const DOCUMENTO_ESTADOS = ['BORRADOR', 'APROBADO', 'CONVERTIDO', 'FACTURADO', 'ANULADO'];
const TASA_FUENTES = ['BCV_API', 'MANUAL', 'CACHE', 'FALLBACK'];
const DEFAULT_BCV_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const BCV_API_TIMEOUT_MS = readPositiveNumber(process.env.BCV_API_TIMEOUT_MS, 5000);
const BCV_API_CACHE_TTL_SECONDS = readPositiveNumber(process.env.BCV_API_CACHE_TTL_SECONDS, 3600);
let bcvCache = null;

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

const parseApiNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;

  const clean = value.trim().replace(/[^\d,.-]/g, '');
  if (!clean) return NaN;

  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const extractPreferredNumber = (payload) => {
  const preferredKeys = ['tasa', 'bcv', 'promedio', 'valor', 'rate', 'precio', 'price'];

  const scan = (value) => {
    if (!value || typeof value !== 'object') return NaN;

    for (const key of Object.keys(value)) {
      const normalizedKey = key.toLowerCase();
      if (preferredKeys.some((candidate) => normalizedKey.includes(candidate))) {
        const parsed = parseApiNumber(value[key]);
        if (parsed > 0) return parsed;
      }
    }

    for (const key of Object.keys(value)) {
      const nested = value[key];
      if (nested && typeof nested === 'object') {
        const parsed = scan(nested);
        if (parsed > 0) return parsed;
      }
    }

    return NaN;
  };

  return scan(payload);
};

const extractPreferredDate = (payload) => {
  const preferredKeys = ['fecha', 'date', 'actualizacion', 'updated'];

  const scan = (value) => {
    if (!value || typeof value !== 'object') return null;

    for (const key of Object.keys(value)) {
      const normalizedKey = key.toLowerCase();
      if (preferredKeys.some((candidate) => normalizedKey.includes(candidate))) {
        const parsed = parseDate(value[key]);
        if (parsed) return parsed;
      }
    }

    for (const key of Object.keys(value)) {
      const nested = value[key];
      if (nested && typeof nested === 'object') {
        const parsed = scan(nested);
        if (parsed) return parsed;
      }
    }

    return null;
  };

  return scan(payload);
};

const fallbackTasaGuardada = async () => {
  const tasa = await prisma.tasa.findFirst({ orderBy: { fecha: 'desc' } });
  if (!tasa || !Number.isFinite(Number(tasa.bcv)) || Number(tasa.bcv) <= 0) return null;

  return {
    success: true,
    tasa: Number(tasa.bcv),
    moneda: 'USD',
    fuente: 'FALLBACK',
    fecha: tasa.fecha,
    cache: false,
    message: 'Se uso la ultima tasa guardada porque no se pudo obtener la tasa BCV actual.',
  };
};

const consultarTasaBcv = async () => {
  const now = Date.now();
  if (bcvCache && bcvCache.expiresAt > now) {
    return {
      ...bcvCache.data,
      fuente: 'CACHE',
      cache: true,
    };
  }

  const url = process.env.BCV_API_URL || DEFAULT_BCV_API_URL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BCV_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Respuesta invalida de la API BCV.');

    const payload = await response.json();
    const tasa = extractPreferredNumber(payload);
    if (!Number.isFinite(tasa) || tasa <= 0) throw new Error('Tasa BCV invalida.');

    const fecha = extractPreferredDate(payload) || new Date();
    const data = {
      success: true,
      tasa: Number(tasa.toFixed(4)),
      moneda: 'USD',
      fuente: 'BCV_API',
      fecha,
      cache: false,
    };

    bcvCache = {
      data,
      expiresAt: now + Math.max(BCV_API_CACHE_TTL_SECONDS, 0) * 1000,
    };

    return data;
  } catch (error) {
    const fallback = await fallbackTasaGuardada();
    if (fallback) return fallback;

    return {
      success: false,
      message: 'No se pudo obtener la tasa BCV actual. Ingrese la tasa manualmente.',
    };
  } finally {
    clearTimeout(timeout);
  }
};

const prefijoDocumento = (tipoDocumento) => (tipoDocumento === 'PRESUPUESTO' ? 'PRES' : 'PROP');

const formatCorrelativo = (tipoDocumento, secuencia) => {
  return `${prefijoDocumento(tipoDocumento)}-${String(secuencia).padStart(6, '0')}`;
};

const obtenerSiguienteCorrelativo = async (tx, tipoDocumento = 'PROPUESTA') => {
  if (!DOCUMENTO_TIPOS.includes(tipoDocumento)) {
    throw new Error('tipoDocumento invalido.');
  }

  const prefijo = prefijoDocumento(tipoDocumento);
  const ultimo = await tx.cotizacion.findFirst({
    where: {
      tipoDocumento,
      numero: { startsWith: `${prefijo}-` },
    },
    orderBy: { numero: 'desc' },
  });

  const ultimoNumero = ultimo?.numero?.split('-').at(-1);
  const secuencia = Number.parseInt(ultimoNumero, 10);
  return formatCorrelativo(tipoDocumento, Number.isFinite(secuencia) ? secuencia + 1 : 1);
};

const normalizeCotizacionPayload = (body) => {
  const errors = [];
  const tipoDocumento = body.tipoDocumento || 'PROPUESTA';
  const estado = body.estado || 'BORRADOR';
  const subtotal = toNumber(body.subtotal);
  const iva = toNumber(body.iva);
  const total = toNumber(body.total);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!DOCUMENTO_TIPOS.includes(tipoDocumento)) errors.push('tipoDocumento debe ser PROPUESTA o PRESUPUESTO.');
  if (!DOCUMENTO_ESTADOS.includes(estado)) errors.push('estado debe ser valido.');
  if (!body.clienteId) errors.push('clienteId es obligatorio.');
  if (!body.vigencia || !body.vigencia.toString().trim()) errors.push('vigencia es obligatoria.');
  if (!body.condiciones || !body.condiciones.toString().trim()) errors.push('condiciones es obligatoria.');
  if (!Array.isArray(body.items)) errors.push('items debe ser un arreglo.');
  if (Number.isNaN(subtotal) || subtotal === null || subtotal < 0) errors.push('subtotal debe ser numerico y mayor o igual a 0.');
  if (Number.isNaN(iva) || iva === null || iva < 0) errors.push('iva debe ser numerico y mayor o igual a 0.');
  if (Number.isNaN(total) || total === null || total < 0) errors.push('total debe ser numerico y mayor o igual a 0.');

  if (errors.length) return { errors };

  return {
    data: {
      tipoDocumento,
      clienteId: body.clienteId,
      titulo: body.titulo?.toString().trim() || null,
      vigencia: body.vigencia.toString().trim(),
      condiciones: body.condiciones.toString(),
      subtotal,
      iva,
      total,
      items,
      estado,
    },
  };
};

const normalizeMovimientoPayload = async (body) => {
  const errors = [];
  const tipo = body.tipo;
  const estado = body.estado || 'PENDIENTE';
  const montoUsd = toNumber(body.montoUsd);
  let tasaBcv = toNumber(body.tasaBcv);
  const montoBsInput = toNumber(body.montoBs);
  const fechaMovimiento = parseDate(body.fechaMovimiento);
  const fechaVencimiento = parseDate(body.fechaVencimiento);
  let tasaFecha = parseDate(body.tasaFecha);
  const tasaEditadaManual = body.tasaEditadaManual === true || body.tasaEditadaManual === 'true';
  let tasaFuente = body.tasaFuente?.toString().trim() || null;
  const tieneTasaInput = body.tasaBcv !== undefined && body.tasaBcv !== null && body.tasaBcv !== '';

  if (!MOVIMIENTO_TIPOS.includes(tipo)) errors.push('tipo debe ser valido.');
  if (!body.concepto || !body.concepto.toString().trim()) errors.push('concepto es obligatorio.');
  if (Number.isNaN(montoUsd) || montoUsd === null || montoUsd < 0) errors.push('montoUsd debe ser numerico y mayor o igual a 0.');
  if (!MOVIMIENTO_ESTADOS.includes(estado)) errors.push('estado debe ser valido.');
  if (!fechaMovimiento) errors.push('fechaMovimiento es obligatoria y debe ser valida.');
  if (tieneTasaInput && (Number.isNaN(tasaBcv) || tasaBcv <= 0)) errors.push('tasaBcv debe ser numerica y mayor que 0.');
  if (body.fechaVencimiento && !fechaVencimiento) errors.push('fechaVencimiento debe ser valida.');
  if (body.montoBs !== undefined && body.montoBs !== null && body.montoBs !== '' && (Number.isNaN(montoBsInput) || montoBsInput < 0)) errors.push('montoBs debe ser numerico y mayor o igual a 0.');
  if (tasaFuente && !TASA_FUENTES.includes(tasaFuente)) errors.push('tasaFuente debe ser valida.');

  if (errors.length) return { errors };

  if (!tieneTasaInput) {
    const tasaActual = await consultarTasaBcv();
    if (tasaActual.success) {
      tasaBcv = tasaActual.tasa;
      tasaFuente = tasaActual.fuente;
      tasaFecha = parseDate(tasaActual.fecha) || new Date();
    }
  }

  if (tasaEditadaManual) tasaFuente = 'MANUAL';
  if (tasaBcv !== null && !Number.isNaN(tasaBcv) && tasaBcv > 0 && !tasaFuente) tasaFuente = 'BCV_API';

  const montoBs = tasaBcv !== null && !Number.isNaN(tasaBcv) && tasaBcv > 0
    ? Number((montoUsd * tasaBcv).toFixed(2))
    : (montoBsInput === null || Number.isNaN(montoBsInput) ? null : montoBsInput);

  return {
    data: {
      tipo,
      concepto: body.concepto.toString().trim(),
      descripcion: body.descripcion?.toString().trim() || null,
      montoUsd,
      tasaBcv: tasaBcv === null || Number.isNaN(tasaBcv) ? null : tasaBcv,
      montoBs: montoBs === null || Number.isNaN(montoBs) ? null : montoBs,
      tasaFuente,
      tasaFecha,
      tasaEditadaManual,
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

// PROPUESTAS / PRESUPUESTOS
const listarCotizaciones = async (req, res) => {
  try {
    const where = { deletedAt: null };
    if (DOCUMENTO_TIPOS.includes(req.query.tipoDocumento)) where.tipoDocumento = req.query.tipoDocumento;

    res.json(await prisma.cotizacion.findMany({
      where,
      include: { cliente: true },
      orderBy: { fecha: 'desc' },
    }));
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar las propuestas.');
  }
};

const obtenerCotizacion = async (req, res) => {
  try {
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { cliente: true },
    });

    if (!cotizacion) return serializeError(res, 404, 'Documento no encontrado.');
    res.json(cotizacion);
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar el documento.');
  }
};

const obtenerSiguienteCorrelativoHandler = async (req, res) => {
  try {
    const tipoDocumento = req.query.tipoDocumento || 'PROPUESTA';
    if (!DOCUMENTO_TIPOS.includes(tipoDocumento)) {
      return serializeError(res, 400, 'tipoDocumento debe ser PROPUESTA o PRESUPUESTO.');
    }

    const numero = await prisma.$transaction((tx) => obtenerSiguienteCorrelativo(tx, tipoDocumento));
    res.json({ numero, tipoDocumento });
  } catch (error) {
    serializeError(res, 500, 'No se pudo generar el correlativo.');
  }
};

const crearCotizacion = async (req, res) => {
  const normalized = normalizeCotizacionPayload(req.body);
  if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const cotizacion = await prisma.$transaction(async (tx) => {
        const numero = await obtenerSiguienteCorrelativo(tx, normalized.data.tipoDocumento);
        return tx.cotizacion.create({
          data: { ...normalized.data, numero },
          include: { cliente: true },
        });
      });

      return res.status(201).json(cotizacion);
    } catch (error) {
      if (error.code === 'P2002') continue;
      if (error.code === 'P2003') return serializeError(res, 400, 'Cliente invalido.');
      return serializeError(res, 500, 'No se pudo crear la propuesta.');
    }
  }

  return serializeError(res, 409, 'No se pudo reservar un correlativo disponible.');
};

const actualizarCotizacion = async (req, res) => {
  try {
    const actual = await prisma.cotizacion.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!actual) return serializeError(res, 404, 'Documento no encontrado.');

    const merged = {
      ...actual,
      ...req.body,
      items: req.body.items === undefined ? actual.items : req.body.items,
    };
    const normalized = normalizeCotizacionPayload(merged);
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const cotizacion = await prisma.$transaction(async (tx) => {
          const numero = normalized.data.tipoDocumento !== actual.tipoDocumento
            ? await obtenerSiguienteCorrelativo(tx, normalized.data.tipoDocumento)
            : actual.numero;

          return tx.cotizacion.update({
            where: { id: req.params.id },
            data: { ...normalized.data, numero },
            include: { cliente: true },
          });
        });

        return res.json(cotizacion);
      } catch (error) {
        if (error.code === 'P2002') continue;
        if (error.code === 'P2003') return serializeError(res, 400, 'Cliente invalido.');
        return serializeError(res, 500, 'No se pudo actualizar la propuesta.');
      }
    }

    return serializeError(res, 409, 'No se pudo reservar un correlativo disponible.');
  } catch (error) {
    return serializeError(res, 500, 'No se pudo actualizar la propuesta.');
  }
};

const eliminarCotizacion = async (req, res) => {
  try {
    const actual = await prisma.cotizacion.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });

    if (!actual) return serializeError(res, 404, 'Documento no encontrado.');

    await prisma.cotizacion.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    serializeError(res, 400, 'No se pudo eliminar la propuesta.');
  }
};

app.get('/api/propuestas/siguiente-correlativo', obtenerSiguienteCorrelativoHandler);
app.get('/api/propuestas', listarCotizaciones);
app.get('/api/propuestas/:id', obtenerCotizacion);
app.post('/api/propuestas', crearCotizacion);
app.put('/api/propuestas/:id', actualizarCotizacion);
app.delete('/api/propuestas/:id', eliminarCotizacion);

app.get('/api/cotizaciones', listarCotizaciones);
app.get('/api/cotizaciones/:id', obtenerCotizacion);
app.post('/api/cotizaciones', crearCotizacion);
app.put('/api/cotizaciones/:id', actualizarCotizacion);
app.delete('/api/cotizaciones/:id', eliminarCotizacion);

// TASAS
app.get('/api/tasas/bcv', async (req, res) => {
  try {
    res.json(await consultarTasaBcv());
  } catch (error) {
    res.json({
      success: false,
      message: 'No se pudo obtener la tasa BCV actual. Ingrese la tasa manualmente.',
    });
  }
});

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
      prisma.cotizacion.count({ where: { deletedAt: null } }),
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
    const normalized = await normalizeMovimientoPayload(req.body);
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
      tasaFecha: req.body.tasaFecha === undefined ? actual.tasaFecha : req.body.tasaFecha,
    };

    if (
      req.body.tasaBcv !== undefined &&
      req.body.tasaEditadaManual === undefined &&
      toNumber(req.body.tasaBcv) !== toNumber(actual.tasaBcv)
    ) {
      merged.tasaEditadaManual = true;
    }

    const normalized = await normalizeMovimientoPayload(merged);
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
