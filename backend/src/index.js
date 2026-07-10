const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { registerEnterpriseRoutes } = require('./modules/enterprise/routes');

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
const PLANTILLA_DOCUMENTO_TIPOS = ['PROPUESTA', 'PRESUPUESTO', 'AMBOS'];
const TASA_FUENTES = ['BCV_API', 'MANUAL', 'CACHE', 'FALLBACK'];
const MOVIMIENTO_CATEGORIAS = ['Servicio', 'Producto', 'Nomina', 'Pago de factura', 'Suscripcion', 'Otro'];
const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA'];
const ASOCIACION_TIPOS = ['PRODUCTO', 'SERVICIO'];
const DEFAULT_BCV_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const DEFAULT_PARALELO_API_URL = 'https://ve.dolarapi.com/v1/dolares/paralelo';
const BCV_API_TIMEOUT_MS = readPositiveNumber(process.env.BCV_API_TIMEOUT_MS, 5000);
const BCV_API_CACHE_TTL_SECONDS = readPositiveNumber(process.env.BCV_API_CACHE_TTL_SECONDS, 3600);
const JWT_SECRET = process.env.JWT_SECRET || 'tamika-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const USUARIO_ROLES = ['ADMIN', 'USUARIO'];
let bcvCache = null;
let paraleloCache = null;

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

const publicUser = (user) => user && ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  rol: user.rol,
  activo: user.activo,
});

const adminUserView = (user) => user && ({
  ...publicUser(user),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signAuthToken = (user) => jwt.sign(
  { sub: user.id, email: user.email, rol: user.rol },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
};

const authenticateToken = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return serializeError(res, 401, 'Autenticacion requerida.');

    const payload = jwt.verify(token, JWT_SECRET);
    const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.activo) return serializeError(res, 401, 'Sesion invalida.');

    req.user = usuario;
    return next();
  } catch (error) {
    return serializeError(res, 401, 'Sesion invalida.');
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.rol !== 'ADMIN') return serializeError(res, 403, 'Permiso de administrador requerido.');
  return next();
};

const logAudit = async (req, data) => {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: data.usuarioId || req.user?.id || null,
        accion: data.accion,
        entidad: data.entidad,
        entidadId: data.entidadId || null,
        descripcion: data.descripcion,
        metadata: data.metadata || null,
        ip: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    console.warn('No se pudo registrar auditoria:', error.message);
  }
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

const fallbackParaleloGuardado = async () => {
  const tasa = await prisma.tasa.findFirst({ orderBy: { fecha: 'desc' } });
  if (!tasa || !Number.isFinite(Number(tasa.paralelo)) || Number(tasa.paralelo) <= 0) return null;

  return {
    success: true,
    tasa: Number(tasa.paralelo),
    moneda: 'USD',
    fuente: 'FALLBACK',
    fecha: tasa.fecha,
    cache: false,
    message: 'Se uso la ultima tasa paralela guardada porque no se pudo obtener la tasa actual.',
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

const consultarTasaParalelo = async () => {
  const now = Date.now();
  if (paraleloCache && paraleloCache.expiresAt > now) {
    return {
      ...paraleloCache.data,
      fuente: 'CACHE',
      cache: true,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BCV_API_TIMEOUT_MS);

  try {
    const response = await fetch(process.env.PARALELO_API_URL || DEFAULT_PARALELO_API_URL, { signal: controller.signal });
    if (!response.ok) throw new Error('Respuesta invalida de la API paralelo.');

    const payload = await response.json();
    const tasa = extractPreferredNumber(payload);
    if (!Number.isFinite(tasa) || tasa <= 0) throw new Error('Tasa paralelo invalida.');

    const fecha = extractPreferredDate(payload) || new Date();
    const data = {
      success: true,
      tasa: Number(tasa.toFixed(4)),
      moneda: 'USD',
      fuente: 'PARALELO_API',
      fecha,
      cache: false,
    };

    paraleloCache = {
      data,
      expiresAt: now + Math.max(BCV_API_CACHE_TTL_SECONDS, 0) * 1000,
    };

    return data;
  } catch (error) {
    const fallback = await fallbackParaleloGuardado();
    if (fallback) return fallback;

    return {
      success: false,
      message: 'No se pudo obtener la tasa paralela actual.',
    };
  } finally {
    clearTimeout(timeout);
  }
};

const mismaFechaIso = (a, b) => {
  if (!a || !b) return false;
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
};

const guardarTasasSincronizadas = async ({ bcv, paralelo }) => {
  if (!Number.isFinite(bcv) || bcv <= 0 || !Number.isFinite(paralelo) || paralelo <= 0) return null;

  const ultima = await prisma.tasa.findFirst({ orderBy: { fecha: 'desc' } });
  const hoy = new Date();
  const valoresIguales = ultima
    && Math.abs(Number(ultima.bcv) - bcv) < 0.0001
    && Math.abs(Number(ultima.paralelo) - paralelo) < 0.0001;

  if (ultima && valoresIguales && mismaFechaIso(ultima.fecha, hoy)) return ultima;
  return prisma.tasa.create({ data: { bcv, paralelo, fecha: hoy } });
};

const consultarTasasActuales = async () => {
  const [bcvResult, paraleloResult] = await Promise.all([
    consultarTasaBcv(),
    consultarTasaParalelo(),
  ]);

  const ultima = await prisma.tasa.findFirst({ orderBy: { fecha: 'desc' } });
  const bcv = Number(bcvResult?.tasa || ultima?.bcv || 0);
  const paralelo = Number(paraleloResult?.tasa || ultima?.paralelo || 0);
  const guardada = await guardarTasasSincronizadas({ bcv, paralelo });

  return {
    success: bcv > 0 && paralelo > 0,
    bcv,
    paralelo,
    relacion: bcv > 0 && paralelo > 0 ? Number((bcv / paralelo).toFixed(4)) : 0,
    fecha: guardada?.fecha || bcvResult?.fecha || paraleloResult?.fecha || new Date(),
    bcvFecha: bcvResult?.fecha || guardada?.fecha || null,
    paraleloFecha: paraleloResult?.fecha || guardada?.fecha || null,
    fuenteBcv: bcvResult?.fuente || 'FALLBACK',
    fuenteParalelo: paraleloResult?.fuente || 'FALLBACK',
    messages: [bcvResult?.message, paraleloResult?.message].filter(Boolean),
  };
};

const prefijoDocumento = (tipoDocumento) => (tipoDocumento === 'PRESUPUESTO' ? 'PRES' : 'PROP');
const CORRELATIVO_GLOBAL_KEY = 'correlativo_DOCUMENTOS';
const CORRELATIVO_DEFAULT_WIDTH = 7;
const claveCorrelativoLegacy = (tipoDocumento) => `correlativo_${tipoDocumento}`;

const formatCorrelativo = (tipoDocumento, secuencia, ancho = CORRELATIVO_DEFAULT_WIDTH) => {
  return `${prefijoDocumento(tipoDocumento)}-${String(secuencia).padStart(Math.max(ancho, CORRELATIVO_DEFAULT_WIDTH), '0')}`;
};

const extraerSecuenciaCorrelativo = (numero) => {
  const valor = numero?.toString().trim();
  const match = valor?.match(/^(?:(?:PROP|PRES)-)?(\d{1,8})$/i);
  if (!match) return null;
  const digitos = match[1];

  const secuencia = Number.parseInt(digitos, 10);
  if (!Number.isFinite(secuencia)) return null;
  return { secuencia, ancho: digitos.length };
};

const obtenerSiguienteCorrelativo = async (tx, tipoDocumento = 'PROPUESTA') => {
  if (!DOCUMENTO_TIPOS.includes(tipoDocumento)) {
    throw new Error('tipoDocumento invalido.');
  }

  const configs = await tx.configuracionSistema.findMany({
    where: {
      clave: {
        in: [
          CORRELATIVO_GLOBAL_KEY,
          claveCorrelativoLegacy('PROPUESTA'),
          claveCorrelativoLegacy('PRESUPUESTO'),
        ],
      },
    },
  });

  const correlativos = await tx.cotizacion.findMany({
    select: { numero: true },
  });

  const baseConfig = configs.reduce((acc, config) => {
    const valor = config?.valor && typeof config.valor === 'object' ? config.valor : {};
    const siguienteNumero = Number.parseInt(valor.siguienteNumero, 10);
    const ancho = Number.parseInt(valor.ancho, 10);
    const secuencia = Number.isFinite(siguienteNumero) && siguienteNumero > 0 ? siguienteNumero - 1 : 0;
    return {
      secuencia: Math.max(acc.secuencia, secuencia),
      ancho: Math.max(acc.ancho, Number.isFinite(ancho) ? ancho : CORRELATIVO_DEFAULT_WIDTH),
    };
  }, { secuencia: 0, ancho: CORRELATIVO_DEFAULT_WIDTH });

  const ultimo = correlativos.reduce((acc, item) => {
    const parsed = extraerSecuenciaCorrelativo(item.numero);
    if (!parsed) return acc;
    if (parsed.secuencia > acc.secuencia) return parsed;
    if (parsed.secuencia === acc.secuencia && parsed.ancho > acc.ancho) return parsed;
    return acc;
  }, baseConfig);

  return formatCorrelativo(tipoDocumento, ultimo.secuencia + 1, ultimo.ancho);
};

const validarNumeroDisponible = async (tx, numero, idActual = null) => {
  if (!numero) return null;

  const existente = await tx.cotizacion.findUnique({
    where: { numero },
    select: { id: true },
  });

  if (existente && existente.id !== idActual) return 'Ya existe un documento con ese correlativo.';
  return null;
};

const normalizeCotizacionAsociaciones = (value) => {
  if (value === undefined) return { data: [], provided: false };
  if (!Array.isArray(value)) return { errors: ['asociaciones debe ser un arreglo.'], provided: true };

  const errors = [];
  const data = value.map((item, index) => {
    const tipo = item?.tipo?.toString().trim().toUpperCase();
    const cantidad = toNumber(item?.cantidad);
    const precioUsd = toNumber(item?.precioUsd);
    const productoId = tipo === 'PRODUCTO' ? item?.productoId?.toString().trim() || null : null;
    const servicioId = tipo === 'SERVICIO' ? item?.servicioId?.toString().trim() || null : null;

    if (!ASOCIACION_TIPOS.includes(tipo)) errors.push(`asociaciones[${index}].tipo debe ser PRODUCTO o SERVICIO.`);
    if (tipo === 'PRODUCTO' && !productoId) errors.push(`asociaciones[${index}].productoId es obligatorio.`);
    if (tipo === 'SERVICIO' && !servicioId) errors.push(`asociaciones[${index}].servicioId es obligatorio.`);
    if (Number.isNaN(cantidad) || cantidad === null || cantidad <= 0) errors.push(`asociaciones[${index}].cantidad debe ser mayor que 0.`);
    if (item?.precioUsd !== undefined && item?.precioUsd !== null && item?.precioUsd !== '' && (Number.isNaN(precioUsd) || precioUsd < 0)) {
      errors.push(`asociaciones[${index}].precioUsd debe ser mayor o igual a 0.`);
    }

    return {
      tipo,
      productoId,
      servicioId,
      cantidad: Number.isNaN(cantidad) || cantidad === null ? 1 : cantidad,
      precioUsd: Number.isNaN(precioUsd) || precioUsd === null ? null : precioUsd,
    };
  });

  return errors.length ? { errors, provided: true } : { data, provided: true };
};

const normalizeCotizacionPayload = (body) => {
  const errors = [];
  const tipoDocumento = body.tipoDocumento || 'PROPUESTA';
  const estado = body.estado || 'APROBADO';
  const subtotal = toNumber(body.subtotal);
  const iva = toNumber(body.iva);
  const total = toNumber(body.total);
  const items = Array.isArray(body.items) ? body.items : [];
  const numero = body.numero?.toString().trim() || null;
  const asociaciones = normalizeCotizacionAsociaciones(body.asociaciones);

  if (!DOCUMENTO_TIPOS.includes(tipoDocumento)) errors.push('tipoDocumento debe ser PROPUESTA o PRESUPUESTO.');
  if (!DOCUMENTO_ESTADOS.includes(estado)) errors.push('estado debe ser valido.');
  if (body.numero !== undefined && !numero) errors.push('numero no puede estar vacio.');
  if (!body.clienteId) errors.push('clienteId es obligatorio.');
  if (!body.vigencia || !body.vigencia.toString().trim()) errors.push('vigencia es obligatoria.');
  if (!body.condiciones || !body.condiciones.toString().trim()) errors.push('condiciones es obligatoria.');
  if (!Array.isArray(body.items)) errors.push('items debe ser un arreglo.');
  if (Number.isNaN(subtotal) || subtotal === null || subtotal < 0) errors.push('subtotal debe ser numerico y mayor o igual a 0.');
  if (Number.isNaN(iva) || iva === null || iva < 0) errors.push('iva debe ser numerico y mayor o igual a 0.');
  if (Number.isNaN(total) || total === null || total < 0) errors.push('total debe ser numerico y mayor o igual a 0.');
  if (asociaciones.errors) errors.push(...asociaciones.errors);

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
      contenidoPropuesta: body.contenidoPropuesta?.toString() || null,
      datosPdf: body.datosPdf && typeof body.datosPdf === 'object' ? body.datosPdf : null,
      clienteCodigoSnapshot: body.clienteCodigoSnapshot?.toString().trim() || body.datosPdf?.clienteCodigo?.toString().trim() || null,
      clienteNombreSnapshot: body.clienteNombreSnapshot?.toString().trim() || body.datosPdf?.clienteNombre?.toString().trim() || null,
      clienteRifSnapshot: body.clienteRifSnapshot?.toString().trim() || body.datosPdf?.clienteRif?.toString().trim() || null,
      clienteDireccionSnapshot: body.clienteDireccionSnapshot?.toString().trim() || body.datosPdf?.clienteDireccion?.toString().trim() || null,
      clienteTelefonoSnapshot: body.clienteTelefonoSnapshot?.toString().trim() || body.datosPdf?.clienteTelefono?.toString().trim() || null,
      clienteEmailSnapshot: body.clienteEmailSnapshot?.toString().trim() || body.datosPdf?.clienteEmail?.toString().trim() || null,
      estado,
    },
    numero,
    asociaciones: asociaciones.data || [],
    asociacionesProvided: asociaciones.provided,
  };
};

const parseActivoPlantilla = (value) => {
  if (value === undefined) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return !['false', '0', 'no', 'inactivo'].includes(value.trim().toLowerCase());
  return Boolean(value);
};

const normalizePlantillaDocumentoPayload = (body) => {
  const errors = [];
  const nombre = body.nombre?.toString().trim();
  const tipoDocumento = body.tipoDocumento?.toString().trim().toUpperCase() || 'AMBOS';

  if (!nombre) errors.push('nombre es obligatorio.');
  if (!PLANTILLA_DOCUMENTO_TIPOS.includes(tipoDocumento)) errors.push('tipoDocumento debe ser PROPUESTA, PRESUPUESTO o AMBOS.');

  if (errors.length) return { errors };

  return {
    data: {
      nombre,
      tipoDocumento,
      descripcion: body.descripcion?.toString().trim() || null,
      titulo: body.titulo?.toString().trim() || null,
      contenidoPropuesta: body.contenidoPropuesta?.toString() || null,
      condiciones: body.condiciones?.toString() || null,
      datosPdf: body.datosPdf && typeof body.datosPdf === 'object' ? body.datosPdf : null,
      activo: parseActivoPlantilla(body.activo),
    },
  };
};

const normalizeMovimientoPayload = async (body) => {
  const errors = [];
  const tipo = body.tipo;
  const estado = body.estado || 'PENDIENTE';
  const categoria = body.categoria?.toString().trim() || null;
  const montoUsd = toNumber(body.montoUsd);
  let tasaBcv = toNumber(body.tasaBcv);
  const montoBsInput = toNumber(body.montoBs);
  const fechaMovimiento = parseDate(body.fechaMovimiento);
  const fechaVencimiento = parseDate(body.fechaVencimiento);
  let tasaFecha = parseDate(body.tasaFecha);
  const tasaEditadaManual = body.tasaEditadaManual === true || body.tasaEditadaManual === 'true';
  let tasaFuente = body.tasaFuente?.toString().trim() || null;
  const metodoPago = body.metodoPago?.toString().trim().toUpperCase() || null;
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
  if (categoria && !MOVIMIENTO_CATEGORIAS.includes(categoria)) errors.push('categoria debe ser valida.');
  if (metodoPago && !METODOS_PAGO.includes(metodoPago)) errors.push('metodoPago debe ser EFECTIVO o TRANSFERENCIA.');

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
      categoria,
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
      metodoPago,
      clienteId: body.clienteId || null,
      proveedorId: body.proveedorId?.toString().trim() || null,
      productoId: body.productoId || null,
      servicioId: body.servicioId || null,
      tipoProductoId: body.tipoProductoId || null,
      tipoServicioId: body.tipoServicioId || null,
      referencia: body.referencia?.toString().trim() || null,
      movimientoRelacionadoId: body.movimientoRelacionadoId || null,
    },
  };
};

const calcularResumenContable = (movimientos) => {
  return movimientos.reduce((acc, mov) => {
    if (mov.estado === 'ANULADO') return acc;

    const monto = Number(mov.montoUsd || 0);
    const fecha = new Date(mov.fechaMovimiento);
    const mesActual = new Date();
    const anioActual = new Date();
    const esMesActual = fecha.getMonth() === mesActual.getMonth() && fecha.getFullYear() === mesActual.getFullYear();
    const esAnioActual = fecha.getFullYear() === anioActual.getFullYear();
    const ingresoReal = (mov.tipo === 'INGRESO' || mov.tipo === 'CUENTA_POR_COBRAR') && mov.estado === 'PAGADO';
    const egresoReal = (mov.tipo === 'EGRESO' || mov.tipo === 'CUENTA_POR_PAGAR') && mov.estado === 'PAGADO';

    if (ingresoReal) {
      acc.totalIngresos += monto;
      acc.balance += monto;
      if (esMesActual) acc.ingresosMes += monto;
      if (esAnioActual) acc.ingresosAnio += monto;
      acc.facturasPagadas += 1;
    }

    if (egresoReal) {
      acc.totalEgresos += monto;
      acc.balance -= monto;
      if (esMesActual) acc.egresosMes += monto;
      if (esAnioActual) acc.egresosAnio += monto;
      acc.facturasPagadas += 1;
    }

    if (mov.tipo === 'CUENTA_POR_COBRAR' && PENDIENTE_ESTADOS.includes(mov.estado)) {
      acc.pendientePorCobrar += monto;
      acc.cuentasPorCobrarPendientes += 1;
      acc.facturasPendientes += 1;
    }

    if (mov.tipo === 'CUENTA_POR_PAGAR' && PENDIENTE_ESTADOS.includes(mov.estado)) {
      acc.pendientePorPagar += monto;
      acc.cuentasPorPagarPendientes += 1;
      acc.facturasPendientes += 1;
    }

    return acc;
  }, {
    totalIngresos: 0,
    totalEgresos: 0,
    ingresosMes: 0,
    egresosMes: 0,
    ingresosAnio: 0,
    egresosAnio: 0,
    balance: 0,
    pendientePorCobrar: 0,
    pendientePorPagar: 0,
    cuentasPorCobrarPendientes: 0,
    cuentasPorPagarPendientes: 0,
    facturasPagadas: 0,
    facturasPendientes: 0,
  });
};

const buildContabilidadWhere = (query) => {
  const filters = [];

  if (query.tipo && MOVIMIENTO_TIPOS.includes(query.tipo)) filters.push({ tipo: query.tipo });
  if (query.estado && MOVIMIENTO_ESTADOS.includes(query.estado)) filters.push({ estado: query.estado });
  if (query.categoria && MOVIMIENTO_CATEGORIAS.includes(query.categoria)) filters.push({ categoria: query.categoria });
  if (query.clienteId) filters.push({ clienteId: query.clienteId.toString() });
  if (query.proveedorId) filters.push({ proveedorId: { contains: query.proveedorId.toString().trim(), mode: 'insensitive' } });
  if (query.productoId) filters.push({ productoId: query.productoId.toString() });
  if (query.servicioId) filters.push({ servicioId: query.servicioId.toString() });

  const desde = parseDate(query.desde);
  const hasta = parseDate(query.hasta);
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(query.hasta?.toString() || '')) {
    hasta.setHours(23, 59, 59, 999);
  }
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
        { categoria: { contains: buscar, mode: 'insensitive' } },
      ],
    });
  }

  return filters.length ? { AND: filters } : {};
};

const movimientoInclude = {
  cliente: true,
  producto: { include: { tipoProducto: true } },
  servicio: { include: { tipoServicio: true } },
  tipoProducto: true,
  tipoServicio: true,
  movimientoRelacionado: {
    include: {
      cliente: true,
      producto: true,
    },
  },
};

const cotizacionInclude = {
  cliente: true,
  asociaciones: {
    include: {
      producto: true,
      servicio: true,
    },
    orderBy: { createdAt: 'asc' },
  },
};

const reemplazarAsociacionesCotizacion = async (tx, cotizacionId, asociaciones = []) => {
  await tx.cotizacionAsociacion.deleteMany({ where: { cotizacionId } });
  if (!asociaciones.length) return;
  await tx.cotizacionAsociacion.createMany({
    data: asociaciones.map((asociacion) => ({ ...asociacion, cotizacionId })),
  });
};

const generarCodigoCliente = async (tx, fecha = new Date()) => {
  const year = fecha.getFullYear();
  const prefix = `CLI-${year}-`;
  const clientes = await tx.cliente.findMany({
    where: { codigoCliente: { startsWith: prefix } },
    select: { codigoCliente: true },
  });

  const ultimo = clientes.reduce((acc, cliente) => {
    const secuencia = Number.parseInt(cliente.codigoCliente?.split('-').at(-1), 10);
    return Number.isFinite(secuencia) && secuencia > acc ? secuencia : acc;
  }, 0);

  return `${prefix}${String(ultimo + 1).padStart(4, '0')}`;
};

const normalizeClientePayload = (body) => {
  const errors = [];
  const data = {
    codigoCliente: body.codigoCliente?.toString().trim() || null,
    nombre: body.nombre?.toString().trim() || '',
    alias: body.alias?.toString().trim() || null,
    rif: body.rif?.toString().trim() || '',
    direccion: body.direccion?.toString().trim() || null,
    telefono: body.telefono?.toString().trim() || null,
    email: body.email?.toString().trim() || null,
  };

  if (!data.nombre) errors.push('nombre es obligatorio.');
  if (!data.rif) errors.push('rif es obligatorio.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('email debe ser valido.');

  return errors.length ? { errors } : { data };
};

const completarSnapshotsCotizacion = async (tx, data) => {
  const cliente = await tx.cliente.findUnique({ where: { id: data.clienteId } });
  const datosPdf = data.datosPdf && typeof data.datosPdf === 'object' ? data.datosPdf : {};

  return {
    ...data,
    clienteCodigoSnapshot: data.clienteCodigoSnapshot || datosPdf.clienteCodigo || cliente?.codigoCliente || null,
    clienteNombreSnapshot: data.clienteNombreSnapshot || datosPdf.clienteNombre || cliente?.nombre || null,
    clienteRifSnapshot: data.clienteRifSnapshot || datosPdf.clienteRif || cliente?.rif || null,
    clienteDireccionSnapshot: data.clienteDireccionSnapshot || datosPdf.clienteDireccion || cliente?.direccion || null,
    clienteTelefonoSnapshot: data.clienteTelefonoSnapshot || datosPdf.clienteTelefono || cliente?.telefono || null,
    clienteEmailSnapshot: data.clienteEmailSnapshot || datosPdf.clienteEmail || cliente?.email || null,
  };
};

const periodoRango = (periodo) => {
  const now = new Date();
  const start = new Date(now);
  if (periodo === 'diario') start.setDate(now.getDate() - 6);
  else if (periodo === 'semanal') start.setDate(now.getDate() - 27);
  else if (periodo === 'anual') start.setMonth(0, 1);
  else start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
};

const balanceLabel = (date, periodo) => {
  const d = new Date(date);
  if (periodo === 'anual') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return d.toISOString().slice(0, 10);
};

const calcularBalancePorPeriodo = (movimientos, periodo) => {
  const buckets = new Map();

  movimientos.forEach((mov) => {
    if (mov.estado === 'ANULADO') return;
    const label = balanceLabel(mov.fechaMovimiento, periodo);
    const monto = Number(mov.montoUsd || 0);
    const current = buckets.get(label) || { label, ingresos: 0, egresos: 0, balance: 0, porCobrar: 0, porPagar: 0 };
    const ingresoReal = (mov.tipo === 'INGRESO' || mov.tipo === 'CUENTA_POR_COBRAR') && mov.estado === 'PAGADO';
    const egresoReal = (mov.tipo === 'EGRESO' || mov.tipo === 'CUENTA_POR_PAGAR') && mov.estado === 'PAGADO';

    if (ingresoReal) current.ingresos += monto;
    if (egresoReal) current.egresos += monto;
    if (mov.tipo === 'CUENTA_POR_COBRAR' && PENDIENTE_ESTADOS.includes(mov.estado)) current.porCobrar += monto;
    if (mov.tipo === 'CUENTA_POR_PAGAR' && PENDIENTE_ESTADOS.includes(mov.estado)) current.porPagar += monto;
    current.balance = current.ingresos - current.egresos;
    buckets.set(label, current);
  });

  return Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const calcularComparativoMensual = (movimientos, meses = 12) => {
  const limite = Math.min(Math.max(Number.parseInt(meses, 10) || 12, 2), 24);
  const fechasValidas = movimientos
    .map((movimiento) => new Date(movimiento.fechaMovimiento))
    .filter((fecha) => !Number.isNaN(fecha.getTime()));
  const fechaFinal = fechasValidas.length
    ? new Date(Math.max(...fechasValidas.map((fecha) => fecha.getTime())))
    : new Date();
  fechaFinal.setDate(1);
  fechaFinal.setHours(0, 0, 0, 0);

  const buckets = new Map();
  for (let offset = limite - 1; offset >= 0; offset -= 1) {
    const fecha = new Date(fechaFinal.getFullYear(), fechaFinal.getMonth() - offset, 1);
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { mes: key, ingresos: 0, egresos: 0, porCobrar: 0, porPagar: 0, balance: 0 });
  }

  movimientos.forEach((mov) => {
    if (mov.estado === 'ANULADO') return;
    const fecha = new Date(mov.fechaMovimiento);
    if (Number.isNaN(fecha.getTime())) return;
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) return;

    const monto = Number(mov.montoUsd || 0);
    const ingresoReal = (mov.tipo === 'INGRESO' || mov.tipo === 'CUENTA_POR_COBRAR') && mov.estado === 'PAGADO';
    const egresoReal = (mov.tipo === 'EGRESO' || mov.tipo === 'CUENTA_POR_PAGAR') && mov.estado === 'PAGADO';
    if (ingresoReal) bucket.ingresos += monto;
    if (egresoReal) bucket.egresos += monto;
    if (mov.tipo === 'CUENTA_POR_COBRAR' && PENDIENTE_ESTADOS.includes(mov.estado)) bucket.porCobrar += monto;
    if (mov.tipo === 'CUENTA_POR_PAGAR' && PENDIENTE_ESTADOS.includes(mov.estado)) bucket.porPagar += monto;
    bucket.balance = bucket.ingresos - bucket.egresos;
  });

  return Array.from(buckets.values());
};

const buildReporteContable = (movimientos, mesesComparativo = 12) => {
  const empty = () => ({ items: [], subtotalUsd: 0, subtotalBs: 0 });
  const secciones = {
    ingresos: empty(),
    egresos: empty(),
    cuentasPorCobrar: empty(),
    cuentasPorPagar: empty(),
    facturasPagadas: empty(),
    facturasPendientes: empty(),
  };

  movimientos.forEach((mov) => {
    if (mov.estado === 'ANULADO') return;
    const montoUsd = Number(mov.montoUsd || 0);
    const montoBs = Number(mov.montoBs || 0);
    const add = (key) => {
      secciones[key].items.push(mov);
      secciones[key].subtotalUsd += montoUsd;
      secciones[key].subtotalBs += montoBs;
    };

    if ((mov.tipo === 'INGRESO' || mov.tipo === 'CUENTA_POR_COBRAR') && mov.estado === 'PAGADO') add('ingresos');
    if ((mov.tipo === 'EGRESO' || mov.tipo === 'CUENTA_POR_PAGAR') && mov.estado === 'PAGADO') add('egresos');
    if (mov.tipo === 'CUENTA_POR_COBRAR' && PENDIENTE_ESTADOS.includes(mov.estado)) add('cuentasPorCobrar');
    if (mov.tipo === 'CUENTA_POR_PAGAR' && PENDIENTE_ESTADOS.includes(mov.estado)) add('cuentasPorPagar');
    if (mov.estado === 'PAGADO') add('facturasPagadas');
    if (PENDIENTE_ESTADOS.includes(mov.estado)) add('facturasPendientes');
  });

  const resumen = calcularResumenContable(movimientos);
  return { secciones, resumen, comparativoMensual: calcularComparativoMensual(movimientos, mesesComparativo) };
};

// AUTH
app.get('/api/auth/setup-status', async (req, res) => {
  try {
    const totalUsuarios = await prisma.usuario.count();
    res.json({ requiresSetup: totalUsuarios === 0, allowRegister: totalUsuarios === 0 });
  } catch (error) {
    serializeError(res, 500, 'No se pudo revisar la configuracion de usuarios.');
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const totalUsuarios = await prisma.usuario.count();
    if (totalUsuarios > 0) {
      return serializeError(res, 403, 'Registro público deshabilitado. Un administrador debe crear usuarios.');
    }

    const nombre = req.body.nombre?.toString().trim();
    const email = req.body.email?.toString().trim().toLowerCase();
    const password = req.body.password?.toString() || '';
    if (!nombre || !email || password.length < 8) {
      return serializeError(res, 400, 'Nombre, email y password de al menos 8 caracteres son obligatorios.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        rol: totalUsuarios === 0 ? 'ADMIN' : 'USUARIO',
      },
    });
    await logAudit(req, {
      usuarioId: usuario.id,
      accion: 'AUTH_REGISTER',
      entidad: 'Usuario',
      entidadId: usuario.id,
      descripcion: totalUsuarios === 0 ? 'Primer usuario administrador creado.' : 'Usuario registrado.',
    });

    res.status(201).json({ user: publicUser(usuario), token: signAuthToken(usuario) });
  } catch (error) {
    if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un usuario con ese email.');
    serializeError(res, 500, 'No se pudo registrar el usuario.');
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = req.body.email?.toString().trim().toLowerCase();
  const password = req.body.password?.toString() || '';

  try {
    const usuario = email ? await prisma.usuario.findUnique({ where: { email } }) : null;
    const ok = usuario && usuario.activo && await bcrypt.compare(password, usuario.passwordHash);

    if (!ok) {
      await logAudit(req, {
        accion: 'AUTH_LOGIN_FAILED',
        entidad: 'Usuario',
        descripcion: `Login fallido para ${email || 'email vacio'}.`,
        metadata: { email },
      });
      return serializeError(res, 401, 'Credenciales invalidas.');
    }

    await logAudit(req, {
      usuarioId: usuario.id,
      accion: 'AUTH_LOGIN',
      entidad: 'Usuario',
      entidadId: usuario.id,
      descripcion: 'Login exitoso.',
    });
    res.json({ user: publicUser(usuario), token: signAuthToken(usuario) });
  } catch (error) {
    serializeError(res, 500, 'No se pudo iniciar sesion.');
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  await logAudit(req, {
    accion: 'AUTH_LOGOUT',
    entidad: 'Usuario',
    entidadId: req.user.id,
    descripcion: 'Logout.',
  });
  res.json({ success: true });
});

app.use('/api', authenticateToken);

registerEnterpriseRoutes(app, { prisma, logAudit, serializeError });

// USUARIOS
const parseActivoUsuario = (value) => {
  if (value === undefined) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return !['false', '0', 'no', 'inactivo'].includes(value.trim().toLowerCase());
  return Boolean(value);
};

const normalizeUsuarioPayload = (body, { requirePassword = false } = {}) => {
  const nombre = body.nombre?.toString().trim();
  const email = body.email?.toString().trim().toLowerCase();
  const password = body.password?.toString() || '';
  const rol = (body.rol?.toString().trim().toUpperCase() || 'USUARIO');
  const activo = parseActivoUsuario(body.activo);
  const errors = {};

  if (!nombre) errors.nombre = 'El nombre es obligatorio.';
  if (!email || !email.includes('@')) errors.email = 'El email es obligatorio y debe ser válido.';
  if (!USUARIO_ROLES.includes(rol)) errors.rol = 'Rol inválido.';
  if ((requirePassword || password) && password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.';

  if (Object.keys(errors).length) return { errors };
  return { data: { nombre, email, rol, activo, password } };
};

app.get('/api/usuarios', requireAdmin, async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    });
    res.json(usuarios.map(adminUserView));
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar los usuarios.');
  }
});

app.post('/api/usuarios', requireAdmin, async (req, res) => {
  try {
    const normalized = normalizeUsuarioPayload(req.body, { requirePassword: true });
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const { password, ...data } = normalized.data;
    const usuario = await prisma.usuario.create({
      data: {
        ...data,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    await logAudit(req, {
      accion: 'USUARIO_CREATE',
      entidad: 'Usuario',
      entidadId: usuario.id,
      descripcion: `Usuario creado por administrador: ${usuario.email}.`,
      metadata: { rol: usuario.rol, activo: usuario.activo },
    });
    res.status(201).json(adminUserView(usuario));
  } catch (error) {
    if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un usuario con ese email.');
    serializeError(res, 500, 'No se pudo crear el usuario.');
  }
});

app.put('/api/usuarios/:id', requireAdmin, async (req, res) => {
  try {
    const normalized = normalizeUsuarioPayload(req.body, { requirePassword: false });
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const actual = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!actual) return serializeError(res, 404, 'Usuario no encontrado.');

    const { password, ...data } = normalized.data;
    const quedariaSinAdmin = actual.rol === 'ADMIN' && (data.rol !== 'ADMIN' || !data.activo);
    if (quedariaSinAdmin) {
      const otrosAdmins = await prisma.usuario.count({
        where: { id: { not: actual.id }, rol: 'ADMIN', activo: true },
      });
      if (otrosAdmins === 0) return serializeError(res, 400, 'Debe existir al menos un administrador activo.');
    }

    const updateData = { ...data };
    if (password) updateData.passwordHash = await bcrypt.hash(password, 12);

    const usuario = await prisma.usuario.update({
      where: { id: req.params.id },
      data: updateData,
    });
    await logAudit(req, {
      accion: 'USUARIO_UPDATE',
      entidad: 'Usuario',
      entidadId: usuario.id,
      descripcion: `Usuario actualizado por administrador: ${usuario.email}.`,
      metadata: { rol: usuario.rol, activo: usuario.activo },
    });
    res.json(adminUserView(usuario));
  } catch (error) {
    if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un usuario con ese email.');
    serializeError(res, 500, 'No se pudo actualizar el usuario.');
  }
});

app.patch('/api/usuarios/:id/estado', requireAdmin, async (req, res) => {
  try {
    const actual = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!actual) return serializeError(res, 404, 'Usuario no encontrado.');

    const activo = parseActivoUsuario(req.body.activo);
    if (actual.rol === 'ADMIN' && !activo) {
      const otrosAdmins = await prisma.usuario.count({
        where: { id: { not: actual.id }, rol: 'ADMIN', activo: true },
      });
      if (otrosAdmins === 0) return serializeError(res, 400, 'Debe existir al menos un administrador activo.');
    }

    const usuario = await prisma.usuario.update({
      where: { id: actual.id },
      data: { activo },
    });
    await logAudit(req, {
      accion: activo ? 'USUARIO_ACTIVATE' : 'USUARIO_DEACTIVATE',
      entidad: 'Usuario',
      entidadId: usuario.id,
      descripcion: `Usuario ${activo ? 'activado' : 'desactivado'} por administrador: ${usuario.email}.`,
      metadata: { rol: usuario.rol, activo },
    });
    res.json(adminUserView(usuario));
  } catch (error) {
    serializeError(res, 500, 'No se pudo cambiar el estado del usuario.');
  }
});

// CLIENTES
app.get('/api/clientes/siguiente-codigo', async (req, res) => {
  try {
    const codigoCliente = await prisma.$transaction((tx) => generarCodigoCliente(tx));
    res.json({ codigoCliente });
  } catch (error) {
    serializeError(res, 500, 'No se pudo generar el codigo de cliente.');
  }
});

app.get('/api/clientes', async (req, res) => {
  try {
    res.json(await prisma.cliente.findMany({ orderBy: { nombre: 'asc' } }));
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar los clientes.');
  }
});

app.get('/api/clientes/:id/productos-adquiridos', async (req, res) => {
  try {
    const movimientos = await prisma.movimientoContable.findMany({
      where: {
        clienteId: req.params.id,
        productoId: { not: null },
        estado: { not: 'ANULADO' },
      },
      include: {
        producto: true,
      },
      orderBy: [{ fechaMovimiento: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(movimientos);
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar los productos adquiridos por el cliente.');
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const normalized = normalizeClientePayload(req.body);
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const cliente = await prisma.$transaction(async (tx) => {
      const codigoCliente = normalized.data.codigoCliente || await generarCodigoCliente(tx);
      return tx.cliente.create({ data: { ...normalized.data, codigoCliente } });
    });
    await logAudit(req, {
      accion: 'CLIENTE_CREATE',
      entidad: 'Cliente',
      entidadId: cliente.id,
      descripcion: `Cliente creado: ${cliente.nombre}.`,
      metadata: { codigoCliente: cliente.codigoCliente, rif: cliente.rif },
    });
    res.status(201).json(cliente);
  } catch (error) {
    if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un cliente con ese RIF o codigo.');
    serializeError(res, 400, 'No se pudo crear el cliente.');
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const normalized = normalizeClientePayload(req.body);
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data: normalized.data });
    await logAudit(req, {
      accion: 'CLIENTE_UPDATE',
      entidad: 'Cliente',
      entidadId: cliente.id,
      descripcion: `Cliente actualizado: ${cliente.nombre}.`,
      metadata: { codigoCliente: cliente.codigoCliente, rif: cliente.rif },
    });
    res.json(cliente);
  } catch (error) {
    if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un cliente con ese RIF o codigo.');
    serializeError(res, 400, 'No se pudo actualizar el cliente.');
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    const cliente = await prisma.cliente.delete({ where: { id: req.params.id } });
    await logAudit(req, {
      accion: 'CLIENTE_DELETE',
      entidad: 'Cliente',
      entidadId: cliente.id,
      descripcion: `Cliente eliminado: ${cliente.nombre}.`,
      metadata: { codigoCliente: cliente.codigoCliente, rif: cliente.rif },
    });
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
      include: cotizacionInclude,
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
      include: cotizacionInclude,
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

const configurarCorrelativoHandler = async (req, res) => {
  try {
    const tipoDocumento = req.body.tipoDocumento || 'PROPUESTA';
    const siguienteNumero = Number.parseInt(req.body.siguienteNumero, 10);
    const ancho = Number.parseInt(req.body.ancho || 7, 10);

    if (!DOCUMENTO_TIPOS.includes(tipoDocumento)) return serializeError(res, 400, 'tipoDocumento debe ser PROPUESTA o PRESUPUESTO.');
    if (!Number.isFinite(siguienteNumero) || siguienteNumero <= 0) return serializeError(res, 400, 'siguienteNumero debe ser positivo.');
    if (!Number.isFinite(ancho) || ancho < 4 || ancho > 8) return serializeError(res, 400, 'ancho debe estar entre 4 y 8.');

    const config = await prisma.configuracionSistema.upsert({
      where: { clave: CORRELATIVO_GLOBAL_KEY },
      update: { valor: { siguienteNumero, ancho } },
      create: { clave: CORRELATIVO_GLOBAL_KEY, valor: { siguienteNumero, ancho } },
    });
    await logAudit(req, {
      accion: 'CORRELATIVO_CONFIG_UPDATE',
      entidad: 'ConfiguracionSistema',
      entidadId: config.clave,
      descripcion: `Correlativo global de documentos configurado desde ${siguienteNumero}.`,
      metadata: { alcance: 'PROPUESTA_Y_PRESUPUESTO', siguienteNumero, ancho },
    });

    res.json(config);
  } catch (error) {
    serializeError(res, 500, 'No se pudo configurar el correlativo.');
  }
};

const crearCotizacion = async (req, res) => {
  const normalized = normalizeCotizacionPayload(req.body);
  if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

  const maxAttempts = normalized.numero ? 1 : 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const cotizacion = await prisma.$transaction(async (tx) => {
        const numero = normalized.numero || await obtenerSiguienteCorrelativo(tx, normalized.data.tipoDocumento);
        const errorNumero = await validarNumeroDisponible(tx, numero);
        if (errorNumero) {
          const error = new Error(errorNumero);
          error.statusCode = 409;
          throw error;
        }

        const data = await completarSnapshotsCotizacion(tx, normalized.data);
        const creada = await tx.cotizacion.create({
          data: { ...data, numero },
        });
        if (normalized.asociacionesProvided) {
          await reemplazarAsociacionesCotizacion(tx, creada.id, normalized.asociaciones);
        }
        return tx.cotizacion.findUnique({ where: { id: creada.id }, include: cotizacionInclude });
      });

      await logAudit(req, {
        accion: 'PROPUESTA_CREATE',
        entidad: 'Cotizacion',
        entidadId: cotizacion.id,
        descripcion: `${cotizacion.tipoDocumento} creada con correlativo ${cotizacion.numero}.`,
        metadata: { numero: cotizacion.numero, tipoDocumento: cotizacion.tipoDocumento },
      });
      return res.status(201).json(cotizacion);
    } catch (error) {
      if (error.statusCode === 409) return serializeError(res, 409, error.message);
      if (error.code === 'P2002' && !normalized.numero) continue;
      if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un documento con ese correlativo.');
      if (error.code === 'P2003') return serializeError(res, 400, 'Cliente, producto o servicio asociado invalido.');
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

    const numeroEnPayload = Object.prototype.hasOwnProperty.call(req.body, 'numero');
    const merged = {
      ...actual,
      ...req.body,
      items: req.body.items === undefined ? actual.items : req.body.items,
    };
    const normalized = normalizeCotizacionPayload(merged);
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);
    const numeroSolicitado = numeroEnPayload ? normalized.numero : null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const cotizacion = await prisma.$transaction(async (tx) => {
          const numero = numeroSolicitado || actual.numero;

          const errorNumero = await validarNumeroDisponible(tx, numero, actual.id);
          if (errorNumero) {
            const error = new Error(errorNumero);
            error.statusCode = 409;
            throw error;
          }

          const data = await completarSnapshotsCotizacion(tx, normalized.data);
          const actualizada = await tx.cotizacion.update({
            where: { id: req.params.id },
            data: { ...data, numero },
          });
          if (normalized.asociacionesProvided) {
            await reemplazarAsociacionesCotizacion(tx, actualizada.id, normalized.asociaciones);
          }
          return tx.cotizacion.findUnique({ where: { id: actualizada.id }, include: cotizacionInclude });
        });

        await logAudit(req, {
          accion: 'PROPUESTA_UPDATE',
          entidad: 'Cotizacion',
          entidadId: cotizacion.id,
          descripcion: `${cotizacion.tipoDocumento} actualizada con correlativo ${cotizacion.numero}.`,
          metadata: { numero: cotizacion.numero, tipoDocumento: cotizacion.tipoDocumento },
        });
        return res.json(cotizacion);
      } catch (error) {
        if (error.statusCode === 409) return serializeError(res, 409, error.message);
        if (error.code === 'P2002' && !numeroSolicitado) continue;
        if (error.code === 'P2002') return serializeError(res, 409, 'Ya existe un documento con ese correlativo.');
        if (error.code === 'P2003') return serializeError(res, 400, 'Cliente, producto o servicio asociado invalido.');
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

    await logAudit(req, {
      accion: 'PROPUESTA_DELETE',
      entidad: 'Cotizacion',
      entidadId: actual.id,
      descripcion: `${actual.tipoDocumento} eliminada logicamente: ${actual.numero}.`,
      metadata: { numero: actual.numero, tipoDocumento: actual.tipoDocumento },
    });
    res.json({ success: true });
  } catch (error) {
    serializeError(res, 400, 'No se pudo eliminar la propuesta.');
  }
};

const listarPlantillasDocumento = async (req, res) => {
  try {
    const where = { deletedAt: null };
    const tipoDocumento = req.query.tipoDocumento?.toString().trim().toUpperCase();
    if (PLANTILLA_DOCUMENTO_TIPOS.includes(tipoDocumento) && tipoDocumento !== 'AMBOS') {
      where.OR = [{ tipoDocumento }, { tipoDocumento: 'AMBOS' }];
    }
    if (req.query.activas === '1') where.activo = true;

    const plantillas = await prisma.plantillaDocumento.findMany({
      where,
      orderBy: [{ activo: 'desc' }, { updatedAt: 'desc' }, { nombre: 'asc' }],
    });
    res.json(plantillas);
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar las plantillas.');
  }
};

const obtenerPlantillaDocumento = async (req, res) => {
  try {
    const plantilla = await prisma.plantillaDocumento.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!plantilla) return serializeError(res, 404, 'Plantilla no encontrada.');
    res.json(plantilla);
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar la plantilla.');
  }
};

const crearPlantillaDocumento = async (req, res) => {
  const normalized = normalizePlantillaDocumentoPayload(req.body);
  if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

  try {
    const plantilla = await prisma.plantillaDocumento.create({ data: normalized.data });
    await logAudit(req, {
      accion: 'PLANTILLA_DOCUMENTO_CREATE',
      entidad: 'PlantillaDocumento',
      entidadId: plantilla.id,
      descripcion: `Plantilla creada: ${plantilla.nombre}.`,
      metadata: { tipoDocumento: plantilla.tipoDocumento, activo: plantilla.activo },
    });
    res.status(201).json(plantilla);
  } catch (error) {
    serializeError(res, 500, 'No se pudo crear la plantilla.');
  }
};

const actualizarPlantillaDocumento = async (req, res) => {
  try {
    const actual = await prisma.plantillaDocumento.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!actual) return serializeError(res, 404, 'Plantilla no encontrada.');

    const normalized = normalizePlantillaDocumentoPayload({ ...actual, ...req.body });
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const plantilla = await prisma.plantillaDocumento.update({
      where: { id: req.params.id },
      data: normalized.data,
    });
    await logAudit(req, {
      accion: 'PLANTILLA_DOCUMENTO_UPDATE',
      entidad: 'PlantillaDocumento',
      entidadId: plantilla.id,
      descripcion: `Plantilla actualizada: ${plantilla.nombre}.`,
      metadata: { tipoDocumento: plantilla.tipoDocumento, activo: plantilla.activo },
    });
    res.json(plantilla);
  } catch (error) {
    serializeError(res, 500, 'No se pudo actualizar la plantilla.');
  }
};

const eliminarPlantillaDocumento = async (req, res) => {
  try {
    const actual = await prisma.plantillaDocumento.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!actual) return serializeError(res, 404, 'Plantilla no encontrada.');

    await prisma.plantillaDocumento.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), activo: false },
    });
    await logAudit(req, {
      accion: 'PLANTILLA_DOCUMENTO_DELETE',
      entidad: 'PlantillaDocumento',
      entidadId: actual.id,
      descripcion: `Plantilla eliminada logicamente: ${actual.nombre}.`,
      metadata: { tipoDocumento: actual.tipoDocumento },
    });
    res.json({ success: true });
  } catch (error) {
    serializeError(res, 400, 'No se pudo eliminar la plantilla.');
  }
};

const cambiarEstadoPlantillaDocumento = async (req, res) => {
  try {
    const actual = await prisma.plantillaDocumento.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!actual) return serializeError(res, 404, 'Plantilla no encontrada.');

    const activo = parseActivoPlantilla(req.body.activo);
    const plantilla = await prisma.plantillaDocumento.update({
      where: { id: actual.id },
      data: { activo },
    });
    await logAudit(req, {
      accion: activo ? 'PLANTILLA_DOCUMENTO_ACTIVATE' : 'PLANTILLA_DOCUMENTO_DEACTIVATE',
      entidad: 'PlantillaDocumento',
      entidadId: plantilla.id,
      descripcion: `Plantilla ${activo ? 'activada' : 'desactivada'}: ${plantilla.nombre}.`,
      metadata: { tipoDocumento: plantilla.tipoDocumento, activo },
    });
    res.json(plantilla);
  } catch (error) {
    serializeError(res, 400, 'No se pudo cambiar el estado de la plantilla.');
  }
};

app.get('/api/plantillas-documento', listarPlantillasDocumento);
app.get('/api/plantillas-documento/:id', obtenerPlantillaDocumento);
app.post('/api/plantillas-documento', crearPlantillaDocumento);
app.put('/api/plantillas-documento/:id', actualizarPlantillaDocumento);
app.patch('/api/plantillas-documento/:id/estado', cambiarEstadoPlantillaDocumento);
app.delete('/api/plantillas-documento/:id', eliminarPlantillaDocumento);

app.get('/api/propuestas/siguiente-correlativo', obtenerSiguienteCorrelativoHandler);
app.post('/api/propuestas/configurar-correlativo', requireAdmin, configurarCorrelativoHandler);
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

app.get('/api/tasas/actuales', async (req, res) => {
  try {
    res.json(await consultarTasasActuales());
  } catch (error) {
    serializeError(res, 500, 'No se pudieron sincronizar las tasas actuales.');
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
    const tasa = await prisma.tasa.create({ data: req.body });
    await logAudit(req, {
      accion: 'TASA_MANUAL_UPDATE',
      entidad: 'Tasa',
      entidadId: tasa.id,
      descripcion: 'Tasa BCV/paralelo guardada manualmente.',
      metadata: { bcv: tasa.bcv, paralelo: tasa.paralelo },
    });
    res.json(tasa);
  } catch (error) {
    serializeError(res, 400, 'No se pudo guardar la tasa.');
  }
});

// DASHBOARD
app.get('/api/dashboard/resumen', async (req, res) => {
  try {
    const [totalClientes, totalProveedores, totalProductos, totalCotizaciones, ventas, movimientos, ultimosMovimientos] = await Promise.all([
      prisma.cliente.count(),
      prisma.proveedor.count({ where: { activo: true } }),
      prisma.producto.count({ where: { activo: true } }),
      prisma.cotizacion.count({ where: { deletedAt: null } }),
      prisma.venta.findMany(),
      prisma.movimientoContable.findMany(),
      prisma.movimientoContable.findMany({
        include: movimientoInclude,
        orderBy: { fechaMovimiento: 'desc' },
        take: 6,
      }),
    ]);

    const resumen = calcularResumenContable(movimientos);

    res.json({
      kpis: {
        totalClientes,
        totalProveedores,
        totalProductos,
        totalCotizaciones,
        totalVentas: ventas.length,
        ingresosMes: resumen.ingresosMes,
        egresosMes: resumen.egresosMes,
        ingresosAnio: resumen.ingresosAnio,
        egresosAnio: resumen.egresosAnio,
        totalMensual: resumen.ingresosMes - resumen.egresosMes,
        totalAnual: resumen.ingresosAnio - resumen.egresosAnio,
        balanceActual: resumen.balance,
        cuentasPorCobrarPendientes: resumen.cuentasPorCobrarPendientes,
        cuentasPorPagarPendientes: resumen.cuentasPorPagarPendientes,
        montoPorCobrar: resumen.pendientePorCobrar,
        montoPorPagar: resumen.pendientePorPagar,
        facturasPagadas: resumen.facturasPagadas,
        facturasPendientes: resumen.facturasPendientes,
        ingresosReales: resumen.totalIngresos,
        egresosReales: resumen.totalEgresos,
      },
      ultimosMovimientos,
    });
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar el resumen del dashboard.');
  }
});

app.get('/api/dashboard/balance', async (req, res) => {
  try {
    const periodo = ['diario', 'semanal', 'mensual', 'anual'].includes(req.query.periodo) ? req.query.periodo : 'mensual';
    const movimientos = await prisma.movimientoContable.findMany({
      where: { fechaMovimiento: { gte: periodoRango(periodo) } },
      orderBy: { fechaMovimiento: 'asc' },
    });

    res.json({ periodo, data: calcularBalancePorPeriodo(movimientos, periodo) });
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar la grafica de balance.');
  }
});

app.get('/api/reportes/contabilidad', async (req, res) => {
  try {
    const where = buildContabilidadWhere(req.query);
    const mesesComparativo = Math.min(Math.max(Number.parseInt(req.query.mesesComparativo, 10) || 12, 2), 24);
    const movimientos = await prisma.movimientoContable.findMany({
      where,
      include: movimientoInclude,
      orderBy: [{ fechaMovimiento: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(buildReporteContable(movimientos, mesesComparativo));
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar el reporte contable.');
  }
});

app.get('/api/audit-logs', requireAdmin, async (req, res) => {
  try {
    const filters = [];
    const desde = parseDate(req.query.desde);
    const hasta = parseDate(req.query.hasta);
    if (desde || hasta) filters.push({ createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } });
    if (req.query.usuarioId) filters.push({ usuarioId: req.query.usuarioId.toString() });
    if (req.query.accion) filters.push({ accion: { contains: req.query.accion.toString().trim(), mode: 'insensitive' } });
    if (req.query.entidad) filters.push({ entidad: { contains: req.query.entidad.toString().trim(), mode: 'insensitive' } });

    const logs = await prisma.auditLog.findMany({
      where: filters.length ? { AND: filters } : {},
      include: { usuario: { select: { id: true, nombre: true, email: true, rol: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    res.json({ logs });
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar los logs de auditoria.');
  }
});

app.post('/api/audit-logs/event', async (req, res) => {
  await logAudit(req, {
    accion: req.body.accion?.toString().trim() || 'UI_EVENT',
    entidad: req.body.entidad?.toString().trim() || 'Frontend',
    entidadId: req.body.entidadId?.toString().trim() || null,
    descripcion: req.body.descripcion?.toString().trim() || 'Evento registrado desde frontend.',
    metadata: req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : null,
  });
  res.json({ success: true });
});

// CONTABILIDAD
app.get('/api/contabilidad', async (req, res) => {
  try {
    const where = buildContabilidadWhere(req.query);
    const movimientos = await prisma.movimientoContable.findMany({
      where,
      include: movimientoInclude,
      orderBy: { fechaMovimiento: 'desc' },
    });

    res.json({ movimientos, resumen: calcularResumenContable(movimientos) });
  } catch (error) {
    serializeError(res, 500, 'No se pudieron cargar los movimientos contables.');
  }
});

app.get('/api/contabilidad/grafica', async (req, res) => {
  try {
    const meses = Math.min(Math.max(Number.parseInt(req.query.meses, 10) || 12, 2), 24);
    const inicio = new Date();
    inicio.setDate(1);
    inicio.setMonth(inicio.getMonth() - (meses - 1));
    inicio.setHours(0, 0, 0, 0);
    const movimientos = await prisma.movimientoContable.findMany({
      where: { fechaMovimiento: { gte: inicio } },
      orderBy: { fechaMovimiento: 'asc' },
    });
    res.json({ meses, data: calcularComparativoMensual(movimientos, meses) });
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar la grafica contable.');
  }
});

app.get('/api/contabilidad/:id', async (req, res) => {
  try {
    const movimiento = await prisma.movimientoContable.findUnique({
      where: { id: req.params.id },
      include: movimientoInclude,
    });

    if (!movimiento) return serializeError(res, 404, 'Movimiento no encontrado.');
    res.json(movimiento);
  } catch (error) {
    serializeError(res, 500, 'No se pudo cargar el movimiento.');
  }
});

app.post('/api/contabilidad/lote', async (req, res) => {
  try {
    const movimientosPayload = Array.isArray(req.body.movimientos) ? req.body.movimientos : [];
    if (!movimientosPayload.length) return serializeError(res, 400, 'Debes enviar al menos un movimiento.');
    if (movimientosPayload.length > 50) return serializeError(res, 400, 'El lote no puede superar 50 movimientos.');

    const normalizados = [];
    const errors = [];
    for (let index = 0; index < movimientosPayload.length; index += 1) {
      const normalized = await normalizeMovimientoPayload(movimientosPayload[index]);
      if (normalized.errors) errors.push(...normalized.errors.map((error) => `movimientos[${index}]: ${error}`));
      else normalizados.push(normalized.data);
    }
    if (errors.length) return serializeError(res, 400, 'Datos invalidos.', errors);

    const movimientos = await prisma.$transaction(async (tx) => {
      const creados = [];
      for (const data of normalizados) {
        creados.push(await tx.movimientoContable.create({ data, include: movimientoInclude }));
      }
      return creados;
    });

    await logAudit(req, {
      accion: 'MOVIMIENTO_BATCH_CREATE',
      entidad: 'MovimientoContable',
      descripcion: `Lote de ${movimientos.length} movimientos contables creado.`,
      metadata: { ids: movimientos.map((movimiento) => movimiento.id), total: movimientos.length },
    });
    res.status(201).json({ movimientos, total: movimientos.length });
  } catch (error) {
    if (error.code === 'P2003') return serializeError(res, 400, 'Cliente, producto, servicio o movimiento relacionado invalido.');
    serializeError(res, 500, 'No se pudo crear el lote contable.');
  }
});

app.post('/api/contabilidad', async (req, res) => {
  try {
    const normalized = await normalizeMovimientoPayload(req.body);
    if (normalized.errors) return serializeError(res, 400, 'Datos invalidos.', normalized.errors);

    const movimiento = await prisma.movimientoContable.create({
      data: normalized.data,
      include: movimientoInclude,
    });

    await logAudit(req, {
      accion: 'MOVIMIENTO_CREATE',
      entidad: 'MovimientoContable',
      entidadId: movimiento.id,
      descripcion: `Movimiento contable creado: ${movimiento.concepto}.`,
      metadata: { tipo: movimiento.tipo, estado: movimiento.estado, montoUsd: movimiento.montoUsd, metodoPago: movimiento.metodoPago, movimientoRelacionadoId: movimiento.movimientoRelacionadoId },
    });
    res.status(201).json(movimiento);
  } catch (error) {
    if (error.code === 'P2003') return serializeError(res, 400, 'Cliente, producto, servicio o movimiento relacionado invalido.');
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
    if (normalized.data.movimientoRelacionadoId === actual.id) {
      return serializeError(res, 400, 'Un movimiento no puede relacionarse consigo mismo.');
    }

    const movimiento = await prisma.movimientoContable.update({
      where: { id: req.params.id },
      data: normalized.data,
      include: movimientoInclude,
    });

    await logAudit(req, {
      accion: actual.estado !== movimiento.estado ? 'MOVIMIENTO_ESTADO_UPDATE' : 'MOVIMIENTO_UPDATE',
      entidad: 'MovimientoContable',
      entidadId: movimiento.id,
      descripcion: actual.estado !== movimiento.estado
        ? `Estado cambiado de ${actual.estado} a ${movimiento.estado}: ${movimiento.concepto}.`
        : `Movimiento contable actualizado: ${movimiento.concepto}.`,
      metadata: {
        tipo: movimiento.tipo,
        estadoAnterior: actual.estado,
        estadoNuevo: movimiento.estado,
        montoUsd: movimiento.montoUsd,
        tasaEditadaManual: movimiento.tasaEditadaManual,
        metodoPago: movimiento.metodoPago,
        movimientoRelacionadoId: movimiento.movimientoRelacionadoId,
      },
    });
    res.json(movimiento);
  } catch (error) {
    if (error.code === 'P2003') return serializeError(res, 400, 'Cliente, producto, servicio o movimiento relacionado invalido.');
    serializeError(res, 500, 'No se pudo actualizar el movimiento contable.');
  }
});

app.delete('/api/contabilidad/:id', async (req, res) => {
  try {
    const movimiento = await prisma.movimientoContable.delete({ where: { id: req.params.id } });
    await logAudit(req, {
      accion: 'MOVIMIENTO_DELETE',
      entidad: 'MovimientoContable',
      entidadId: movimiento.id,
      descripcion: `Movimiento contable eliminado: ${movimiento.concepto}.`,
      metadata: { tipo: movimiento.tipo, estado: movimiento.estado, montoUsd: movimiento.montoUsd },
    });
    res.json({ success: true });
  } catch (error) {
    serializeError(res, 400, 'No se pudo eliminar el movimiento contable.');
  }
});

app.listen(port, () => console.log(`Backend corriendo en ${port}`));
