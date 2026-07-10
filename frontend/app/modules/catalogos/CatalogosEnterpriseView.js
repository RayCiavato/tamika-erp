"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const emptyServicio = {
  id: '',
  codigoServicio: '',
  nombre: '',
  descripcion: '',
  tipoServicioId: '',
  tipoServicioNombre: '',
  precioUsd: '',
  activo: true,
};

const emptyProducto = {
  id: '',
  codigoProducto: '',
  nombre: '',
  descripcion: '',
  tipoProductoId: '',
  tipoProductoNombre: '',
  precioUsd: '',
  stock: '',
  activo: true,
};

const emptyAsignacion = () => ({
  clienteId: '',
  itemId: '',
  cantidad: '1',
  precioUsd: '',
  estado: 'PAGADO',
  metodoPago: 'TRANSFERENCIA',
  fechaMovimiento: today(),
  fechaVencimiento: '',
  referencia: '',
  descripcion: '',
  tasaBcv: '',
  tipoContratacionStarlink: 'SOLO_ANTENA',
  cuentaStarlinkId: '',
  antenaStarlinkId: '',
  nombreCuenta: '',
  correoCuenta: '',
  montoMensualUsd: '',
  fechaCorte: '',
  periodo: currentMonth(),
  fechaPago: '',
  estadoPago: 'PENDIENTE',
  nombreAntena: '',
  numeroKit: '',
  numeroSerie: '',
  ubicacion: '',
  fechaRegistro: today(),
  observacionesStarlink: '',
});

const emptyServiceLine = (tasaBcv = '') => ({
  id: `${Date.now()}-${Math.random()}`,
  itemId: '',
  cantidad: '1',
  precioUsd: '',
  estado: 'PAGADO',
  metodoPago: 'TRANSFERENCIA',
  fechaMovimiento: today(),
  fechaVencimiento: '',
  referencia: '',
  descripcion: '',
  tasaBcv,
  tasaEditadaManual: false,
  movimientoRelacionadoId: '',
});

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export default function CatalogosEnterpriseView({
  apiFetch = fetch,
  clientes = [],
  initialTab = 'servicios',
  compact = false,
  onChanged,
  tasaBcvActual,
}) {
  const activeModule = initialTab === 'productos' ? 'productos' : 'servicios';
  const isProductModule = activeModule === 'productos';
  const moduleTitle = isProductModule ? 'Productos' : 'Servicios';
  const singularTitle = isProductModule ? 'producto' : 'servicio';
  const itemTitle = isProductModule ? 'Producto' : 'Servicio';
  const moduleDescription = isProductModule
    ? 'Registra productos adquiridos por clientes y administra el inventario comercial.'
    : 'Registra servicios adquiridos por clientes y administra el portafolio comercial.';

  const [viewMode, setViewMode] = useState('registro');
  const [servicios, setServicios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cuentasStarlink, setCuentasStarlink] = useState([]);
  const [servicioForm, setServicioForm] = useState(emptyServicio);
  const [productoForm, setProductoForm] = useState(emptyProducto);
  const [asignacion, setAsignacion] = useState(emptyAsignacion);
  const [buscar, setBuscar] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientesOpen, setClientesOpen] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoCodeLoading, setAutoCodeLoading] = useState('');
  const [tasaEditadaManual, setTasaEditadaManual] = useState(false);
  const [serviceLines, setServiceLines] = useState([emptyServiceLine()]);
  const [productosCliente, setProductosCliente] = useState([]);
  const [loadingProductosCliente, setLoadingProductosCliente] = useState(false);
  const [ordenCatalogo, setOrdenCatalogo] = useState('codigo');
  const [direccionOrden, setDireccionOrden] = useState('asc');

  const catalogItems = isProductModule ? productos : servicios;
  const selectedItem = catalogItems.find((item) => item.id === asignacion.itemId);
  const selectedCliente = clientes.find((cliente) => cliente.id === asignacion.clienteId);
  const cantidad = Math.max(toNumber(asignacion.cantidad, 1), 1);
  const precioUnitario = toNumber(asignacion.precioUsd, 0);
  const totalAsignacion = Number((cantidad * precioUnitario).toFixed(2));
  const totalServicios = serviceLines.reduce((total, line) => (
    total + (Math.max(toNumber(line.cantidad, 1), 1) * toNumber(line.precioUsd, 0))
  ), 0);
  const selectedItemText = [
    selectedItem?.nombre,
    selectedItem?.descripcion,
    selectedItem?.tipoProducto?.nombre,
  ].filter(Boolean).join(' ').toLowerCase();
  const isStarlinkSelection = isProductModule && selectedItemText.includes('starlink');
  const isServicioCompleto = asignacion.tipoContratacionStarlink === 'SERVICIO_COMPLETO';
  const tasaBcvSincronizada = tasaBcvActual?.tasa ? tasaBcvActual.tasa.toString() : '';

  const filteredClientes = useMemo(() => {
    const term = clienteSearch.trim().toLowerCase();
    if (!term) return clientes;
    return clientes.filter((cliente) => (
      [cliente.codigoCliente, cliente.nombre, cliente.rif, cliente.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    ));
  }, [clientes, clienteSearch]);

  const filtered = useMemo(() => {
    const term = buscar.trim().toLowerCase();
    const match = (value) => (value || '').toString().toLowerCase().includes(term);
    const filterRows = (rows, fields) => !term ? rows : rows.filter((row) => fields.some((field) => match(row[field])));
    const sortRows = (rows, codeField) => [...rows].sort((a, b) => {
      const values = {
        codigo: [a[codeField] || '', b[codeField] || ''],
        nombre: [a.nombre || '', b.nombre || ''],
        estado: [a.activo ? 'ACTIVO' : 'INACTIVO', b.activo ? 'ACTIVO' : 'INACTIVO'],
      };
      const [left, right] = values[ordenCatalogo] || values.codigo;
      const result = left.toString().localeCompare(right.toString(), 'es', { numeric: true, sensitivity: 'base' });
      return direccionOrden === 'asc' ? result : -result;
    });
    return {
      servicios: sortRows(filterRows(servicios, ['codigoServicio', 'nombre', 'descripcion']), 'codigoServicio'),
      productos: sortRows(filterRows(productos, ['codigoProducto', 'nombre', 'descripcion']), 'codigoProducto'),
    };
  }, [buscar, servicios, productos, ordenCatalogo, direccionOrden]);

  const buildLocalCatalogCode = (kind) => {
    const rows = kind === 'servicio' ? servicios : productos;
    const field = kind === 'servicio' ? 'codigoServicio' : 'codigoProducto';
    const prefix = kind === 'servicio' ? 'SERV' : 'PROD';
    const year = new Date().getFullYear();
    const base = `${prefix}-${year}-`;
    const ultimo = rows.reduce((acc, row) => {
      const value = row[field] || '';
      if (!value.startsWith(base)) return acc;
      const secuencia = Number.parseInt(value.split('-').at(-1), 10);
      return Number.isFinite(secuencia) && secuencia > acc ? secuencia : acc;
    }, 0);

    return `${base}${String(ultimo + 1).padStart(4, '0')}`;
  };

  useEffect(() => {
    setViewMode('registro');
    setAsignacion({ ...emptyAsignacion(), tasaBcv: tasaBcvSincronizada });
    setServiceLines([emptyServiceLine(tasaBcvSincronizada)]);
    setProductosCliente([]);
    setTasaEditadaManual(false);
    setMensaje('');
  }, [activeModule]);

  useEffect(() => {
    if (!tasaBcvActual?.tasa) return;
    setAsignacion((prev) => ({
      ...prev,
      tasaBcv: tasaEditadaManual ? prev.tasaBcv : tasaBcvActual.tasa.toString(),
    }));
    setServiceLines((prev) => prev.map((line) => (
      line.tasaEditadaManual ? line : { ...line, tasaBcv: tasaBcvActual.tasa.toString() }
    )));
  }, [tasaBcvActual?.version, tasaEditadaManual]);

  const readJson = async (res, fallback) => {
    const raw = await res.text().catch(() => '');
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        data = { error: raw };
      }
    }

    if (!res.ok) {
      const details = typeof data.details === 'string'
        ? data.details
        : data.details?.message || '';
      const message = data.error || fallback;
      throw new Error(details ? `${message} ${details}` : message);
    }
    return data;
  };

  const cargarCatalogos = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const [serviciosRes, productosRes, cuentasRes] = await Promise.all([
        apiFetch('/api/servicios'),
        apiFetch('/api/productos'),
        apiFetch('/api/starlink/cuentas'),
      ]);
      const [serviciosData, productosData, cuentasData] = await Promise.all([
        readJson(serviciosRes, 'No se pudieron cargar los servicios.'),
        readJson(productosRes, 'No se pudieron cargar los productos.'),
        readJson(cuentasRes, 'No se pudieron cargar las cuentas Starlink.'),
      ]);
      setServicios(Array.isArray(serviciosData) ? serviciosData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      setCuentasStarlink(Array.isArray(cuentasData) ? cuentasData : []);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarProductosCliente = async (clienteId) => {
    if (!clienteId || isProductModule) {
      setProductosCliente([]);
      return;
    }
    setLoadingProductosCliente(true);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/productos-adquiridos`);
      const data = await readJson(res, 'No se pudieron cargar los productos asociados al cliente.');
      setProductosCliente(Array.isArray(data) ? data : []);
    } catch (error) {
      setProductosCliente([]);
      setMensaje(error.message);
    } finally {
      setLoadingProductosCliente(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarProductosCliente(asignacion.clienteId);
  }, [asignacion.clienteId, isProductModule]);

  const resetForms = () => {
    setServicioForm(emptyServicio);
    setProductoForm(emptyProducto);
    setAsignacion({ ...emptyAsignacion(), tasaBcv: tasaBcvSincronizada });
    setServiceLines([emptyServiceLine(tasaBcvSincronizada)]);
    setTasaEditadaManual(false);
  };

  const updateAsignacion = (field, value) => setAsignacion((prev) => ({ ...prev, [field]: value }));
  const updateServiceLine = (lineId, field, value) => {
    setServiceLines((prev) => prev.map((line) => {
      if (line.id !== lineId) return line;
      if (field === 'itemId') {
        const servicio = servicios.find((item) => item.id === value);
        return {
          ...line,
          itemId: value,
          descripcion: servicio?.descripcion || '',
          precioUsd: '',
        };
      }
      if (field === 'tasaBcv') return { ...line, tasaBcv: value, tasaEditadaManual: true };
      return { ...line, [field]: value };
    }));
  };
  const addServiceLine = () => setServiceLines((prev) => [...prev, emptyServiceLine(tasaBcvSincronizada)]);
  const removeServiceLine = (lineId) => setServiceLines((prev) => (
    prev.length === 1 ? prev : prev.filter((line) => line.id !== lineId)
  ));
  const syncServiceLineRate = (lineId) => setServiceLines((prev) => prev.map((line) => (
    line.id === lineId ? { ...line, tasaBcv: tasaBcvSincronizada || line.tasaBcv, tasaEditadaManual: false } : line
  )));
  const sincronizarTasaFormulario = () => {
    setTasaEditadaManual(false);
    if (tasaBcvSincronizada) updateAsignacion('tasaBcv', tasaBcvSincronizada);
  };
  const cambiarModo = (mode) => {
    setViewMode(mode);
    setMensaje('');
  };

  const selectCliente = (clienteId) => {
    setAsignacion((prev) => ({
      ...prev,
      clienteId,
      cuentaStarlinkId: '',
    }));
    setServiceLines((prev) => prev.map((line) => ({ ...line, movimientoRelacionadoId: '' })));
    setClientesOpen(false);
  };

  const selectItem = (itemId) => {
    const item = catalogItems.find((entry) => entry.id === itemId);
    setAsignacion((prev) => ({
      ...prev,
      itemId,
      antenaStarlinkId: '',
      precioUsd: '',
      descripcion: item?.descripcion || '',
      nombreAntena: isProductModule && item?.nombre?.toLowerCase().includes('starlink') ? item.nombre : prev.nombreAntena,
      montoMensualUsd: isProductModule && item?.nombre?.toLowerCase().includes('starlink') ? prev.montoMensualUsd : prev.montoMensualUsd,
    }));
  };

  const saveServicio = async (event) => {
    event.preventDefault();
    setMensaje('');
    try {
      const codigoServicio = servicioForm.codigoServicio.trim()
        || await generarCodigoCatalogo('servicio', { silent: true });
      const payload = {
        ...servicioForm,
        codigoServicio,
        tipoServicioId: null,
        tipoServicioNombre: '',
        precioUsd: 0,
      };
      const url = servicioForm.id ? `/api/servicios/${servicioForm.id}` : '/api/servicios';
      const res = await apiFetch(url, {
        method: servicioForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJson(res, 'No se pudo guardar el servicio.');
      setServicioForm(emptyServicio);
      await cargarCatalogos();
      setMensaje('Servicio guardado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const saveProducto = async (event) => {
    event.preventDefault();
    setMensaje('');
    try {
      const codigoProducto = productoForm.codigoProducto.trim()
        || await generarCodigoCatalogo('producto', { silent: true });
      const payload = {
        ...productoForm,
        codigoProducto,
        tipoProductoId: null,
        tipoProductoNombre: '',
        precioUsd: 0,
        stock: null,
      };
      const url = productoForm.id ? `/api/productos/${productoForm.id}` : '/api/productos';
      const res = await apiFetch(url, {
        method: productoForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJson(res, 'No se pudo guardar el producto.');
      setProductoForm(emptyProducto);
      await cargarCatalogos();
      setMensaje('Producto guardado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const toggleCatalogState = async (endpoint, item, label) => {
    const nextActive = !item.activo;
    const action = nextActive ? 'activar' : 'desactivar';
    if (!confirm(`¿Deseas ${action} ${label}?`)) return;
    try {
      const res = await apiFetch(`${endpoint}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: nextActive }),
      });
      await readJson(res, `No se pudo ${action}.`);
      await cargarCatalogos();
      setMensaje(`${label} ${nextActive ? 'activado' : 'desactivado'}.`);
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const generarCodigoCatalogo = async (kind, options = {}) => {
    const endpoint = kind === 'servicio'
      ? '/api/servicios/siguiente-codigo'
      : '/api/productos/siguiente-codigo';
    const responseKey = kind === 'servicio' ? 'codigoServicio' : 'codigoProducto';

    if (!options.silent) {
      setAutoCodeLoading(kind);
      setMensaje('');
    }

    try {
      const res = await apiFetch(endpoint);
      const data = await readJson(res, 'No se pudo generar el codigo.');
      return data[responseKey] || buildLocalCatalogCode(kind);
    } catch (error) {
      const fallbackCode = buildLocalCatalogCode(kind);
      if (!options.silent) {
        setMensaje(`Codigo generado localmente porque la API no respondio: ${fallbackCode}`);
      }
      return fallbackCode;
    } finally {
      if (!options.silent) setAutoCodeLoading('');
    }
  };

  const autoCode = async (kind) => {
    const code = await generarCodigoCatalogo(kind);
    if (kind === 'servicio') setServicioForm((prev) => ({ ...prev, codigoServicio: code }));
    if (kind === 'producto') setProductoForm((prev) => ({ ...prev, codigoProducto: code }));
  };

  const crearMovimientoAdquisicion = async () => {
    const payload = {
      tipo: asignacion.estado === 'PAGADO' ? 'INGRESO' : 'CUENTA_POR_COBRAR',
      estado: asignacion.estado,
      metodoPago: asignacion.estado === 'PAGADO' ? asignacion.metodoPago : null,
      concepto: `${isProductModule ? 'Producto' : 'Servicio'} adquirido: ${selectedItem?.nombre || singularTitle}`,
      descripcion: asignacion.descripcion || selectedItem?.descripcion || null,
      montoUsd: totalAsignacion,
      tasaBcv: asignacion.tasaBcv || undefined,
      fechaMovimiento: asignacion.fechaMovimiento,
      fechaVencimiento: asignacion.fechaVencimiento || undefined,
      clienteId: asignacion.clienteId,
      categoria: isProductModule ? 'Producto' : 'Servicio',
      productoId: isProductModule ? asignacion.itemId : null,
      servicioId: isProductModule ? null : asignacion.itemId,
      tipoProductoId: isProductModule ? selectedItem?.tipoProductoId || null : null,
      tipoServicioId: isProductModule ? null : selectedItem?.tipoServicioId || null,
      referencia: asignacion.referencia || `${selectedCliente?.codigoCliente || 'CLI'}-${Date.now()}`,
      movimientoRelacionadoId: null,
    };
    const res = await apiFetch('/api/contabilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return readJson(res, 'No se pudo registrar la adquisicion en contabilidad.');
  };

  const crearLoteServicios = async () => {
    const movimientos = serviceLines.map((line, index) => {
      const servicio = servicios.find((item) => item.id === line.itemId);
      if (!servicio) throw new Error(`Selecciona el servicio de la línea ${index + 1}.`);
      const cantidadLinea = Math.max(toNumber(line.cantidad, 1), 1);
      const precioLinea = toNumber(line.precioUsd, 0);
      return {
        tipo: line.estado === 'PAGADO' ? 'INGRESO' : 'CUENTA_POR_COBRAR',
        estado: line.estado,
        metodoPago: line.estado === 'PAGADO' ? line.metodoPago : null,
        concepto: `Servicio adquirido: ${servicio.nombre}`,
        descripcion: line.descripcion || servicio.descripcion || null,
        montoUsd: Number((cantidadLinea * precioLinea).toFixed(2)),
        tasaBcv: line.tasaBcv || undefined,
        fechaMovimiento: line.fechaMovimiento,
        fechaVencimiento: line.fechaVencimiento || undefined,
        clienteId: asignacion.clienteId,
        categoria: 'Servicio',
        productoId: null,
        servicioId: servicio.id,
        tipoProductoId: null,
        tipoServicioId: servicio.tipoServicioId || null,
        referencia: line.referencia || `${selectedCliente?.codigoCliente || 'CLI'}-SERV-${Date.now()}-${index + 1}`,
        movimientoRelacionadoId: line.movimientoRelacionadoId || null,
      };
    });

    const res = await apiFetch('/api/contabilidad/lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movimientos }),
    });
    return readJson(res, 'No se pudo registrar el lote de servicios.');
  };

  const registrarStarlink = async () => {
    if (!isStarlinkSelection) return null;
    if (!asignacion.nombreAntena.trim()) throw new Error('El nombre de la antena Starlink es obligatorio.');
    if (!asignacion.numeroSerie.trim()) throw new Error('El S/N de la antena Starlink es obligatorio.');

    let cuentaId = asignacion.cuentaStarlinkId;
    let cuenta = cuentasStarlink.find((item) => item.id === cuentaId);

    if (isServicioCompleto && !asignacion.fechaCorte) {
      throw new Error('La fecha de corte es obligatoria para servicio completo.');
    }

    if (!cuentaId && (isServicioCompleto || asignacion.correoCuenta || asignacion.nombreCuenta)) {
      const cuentaRes = await apiFetch('/api/starlink/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: asignacion.clienteId,
          nombreCuenta: asignacion.nombreCuenta || `${selectedCliente?.nombre || 'Cliente'} - Starlink`,
          correoCuenta: asignacion.correoCuenta || null,
          referencia: asignacion.referencia || null,
          tipoServicio: isServicioCompleto ? 'SERVICIO_COMPLETO' : 'SOLO_ANTENAS',
          montoMensualUsd: asignacion.montoMensualUsd || null,
          fechaCorte: asignacion.fechaCorte,
          estado: 'ACTIVA',
          observaciones: asignacion.observacionesStarlink || null,
        }),
      });
      cuenta = await readJson(cuentaRes, 'No se pudo crear la cuenta Starlink.');
      cuentaId = cuenta.id;
    }

    const antenaPayload = {
      clienteId: asignacion.clienteId,
      cuentaStarlinkId: cuentaId || null,
      numeroKit: asignacion.numeroKit || null,
      numeroSerie: asignacion.numeroSerie.trim(),
      nombreAntena: asignacion.nombreAntena,
      ubicacion: asignacion.ubicacion || null,
      fechaRegistro: asignacion.fechaRegistro || today(),
      fechaCorte: isServicioCompleto ? asignacion.fechaCorte : null,
      tipoServicio: isServicioCompleto ? 'SERVICIO_COMPLETO' : 'SOLO_ANTENAS',
      estado: 'ACTIVA',
      observaciones: asignacion.observacionesStarlink || null,
    };

    const antenaRes = await apiFetch(asignacion.antenaStarlinkId ? `/api/starlink/antenas/${asignacion.antenaStarlinkId}` : '/api/starlink/antenas', {
      method: asignacion.antenaStarlinkId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(antenaPayload),
    });
    const antena = await readJson(antenaRes, 'No se pudo registrar la antena Starlink.');

    if (isServicioCompleto && cuentaId && asignacion.montoMensualUsd && asignacion.fechaCorte) {
      const pagoRes = await apiFetch('/api/starlink/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuentaStarlinkId: cuentaId,
          periodo: asignacion.periodo || currentMonth(),
          montoUsd: asignacion.montoMensualUsd,
          tasaBcv: asignacion.tasaBcv || undefined,
          fechaPago: asignacion.fechaPago || undefined,
          fechaCorte: asignacion.fechaCorte,
          estado: asignacion.estadoPago,
          referencia: asignacion.referencia || `STARLINK-${selectedCliente?.codigoCliente || selectedCliente?.id || ''}`,
        }),
      });
      await readJson(pagoRes, 'No se pudo registrar el pago Starlink.');
    }

    return antena;
  };

  const guardarAdquisicion = async (event) => {
    event.preventDefault();
    setMensaje('');
    if (!asignacion.clienteId) return setMensaje('Selecciona un cliente registrado.');
    if (isProductModule && !asignacion.itemId) return setMensaje(`Selecciona un ${singularTitle}.`);
    if (!isProductModule && serviceLines.some((line) => !line.itemId)) return setMensaje('Selecciona el servicio en todas las líneas.');

    setSaving(true);
    try {
      if (isProductModule) {
        await registrarStarlink();
        await crearMovimientoAdquisicion();
      } else {
        await crearLoteServicios();
      }
      await cargarCatalogos();
      onChanged?.();
      setAsignacion((prev) => ({
        ...emptyAsignacion(),
        tasaBcv: tasaBcvSincronizada || prev.tasaBcv,
      }));
      setServiceLines([emptyServiceLine(tasaBcvSincronizada)]);
      setTasaEditadaManual(false);
      setMensaje(!isProductModule
        ? `${serviceLines.length} servicio${serviceLines.length === 1 ? '' : 's'} registrado${serviceLines.length === 1 ? '' : 's'} en contabilidad.`
        : isStarlinkSelection
        ? 'Adquisicion registrada con datos Starlink y contabilidad.'
        : 'Adquisicion registrada en contabilidad.');
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">{moduleTitle}</h2>
          <p className="text-sm text-slate-500">{moduleDescription}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => cambiarModo('registro')} className={`rounded-lg px-4 py-2 text-sm font-bold ${viewMode === 'registro' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Registrar venta
          </button>
          <button type="button" onClick={() => cambiarModo('nuevo')} className={`rounded-lg px-4 py-2 text-sm font-bold ${viewMode === 'nuevo' ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            Nuevo {singularTitle}
          </button>
        </div>
      </div>

      {mensaje && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{mensaje}</div>}
      {loading && <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700">Cargando {moduleTitle.toLowerCase()}...</div>}

      {viewMode === 'registro' && (
        <form onSubmit={guardarAdquisicion} className="mt-5 space-y-5">
          <section className="grid grid-cols-1 gap-5 2xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold uppercase text-slate-600">Cliente</h3>
                  <p className="text-xs text-slate-500">Selecciona un cliente existente para asociar la venta.</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">{clientes.length}</span>
              </div>

              <Field label="Cliente registrado">
                <select value={asignacion.clienteId} onChange={(event) => selectCliente(event.target.value)} className="input">
                  <option value="">Selecciona cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.codigoCliente ? `${cliente.codigoCliente} - ` : ''}{cliente.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              {selectedCliente && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-sm font-extrabold text-emerald-950">{selectedCliente.nombre}</p>
                  <p className="text-xs text-emerald-800">{selectedCliente.codigoCliente || selectedCliente.id}</p>
                  <p className="mt-1 text-xs text-emerald-700">{selectedCliente.rif || 'Sin RIF'} / {selectedCliente.telefono || 'Sin telefono'}</p>
                </div>
              )}

              <button type="button" onClick={() => setClientesOpen((prev) => !prev)} className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                <span>Clientes registrados</span>
                <span>{clientesOpen ? 'Ocultar' : 'Mostrar'}</span>
              </button>

              {clientesOpen && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <input value={clienteSearch} onChange={(event) => setClienteSearch(event.target.value)} placeholder="Buscar cliente..." className="input mb-3" />
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {filteredClientes.map((cliente) => (
                      <button key={cliente.id} type="button" onClick={() => selectCliente(cliente.id)} className={`w-full rounded-lg border px-3 py-2 text-left hover:border-emerald-300 hover:bg-emerald-50 ${cliente.id === asignacion.clienteId ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                        <p className="text-sm font-bold text-slate-900">{cliente.nombre}</p>
                        <p className="text-xs text-slate-500">{cliente.codigoCliente || cliente.id}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isProductModule ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase text-teal-700">Detalle comercial</p>
                  <h3 className="text-base font-extrabold text-slate-950">Registrar {singularTitle}</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                  <MiniSummary label="Cliente" value={selectedCliente?.codigoCliente || selectedCliente?.nombre || 'Pendiente'} />
                  <MiniSummary label={itemTitle} value={selectedItem?.codigoProducto || selectedItem?.codigoServicio || selectedItem?.nombre || 'Pendiente'} />
                  <MiniSummary label="Total" value={formatUsd(totalAsignacion)} strong />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <Field label={itemTitle} className="md:col-span-3">
                  <select value={asignacion.itemId} onChange={(event) => selectItem(event.target.value)} className="input">
                    <option value="">Selecciona {singularTitle}</option>
                    {catalogItems.filter((item) => item.activo).map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.codigoProducto || item.codigoServicio) ? `${item.codigoProducto || item.codigoServicio} - ` : ''}{item.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cantidad" className="md:col-span-1">
                  <input type="number" min="1" step="1" value={asignacion.cantidad} onChange={(event) => updateAsignacion('cantidad', event.target.value)} className="input" />
                </Field>
                <Field label="Precio USD" className="md:col-span-1">
                  <input type="number" min="0" step="0.01" value={asignacion.precioUsd} onChange={(event) => updateAsignacion('precioUsd', event.target.value)} className="input" />
                </Field>
                <Field label="Total" className="md:col-span-1">
                  <input readOnly value={formatUsd(totalAsignacion)} className="input bg-slate-100 font-extrabold text-slate-700" />
                </Field>
                <Field label="Estado" className="md:col-span-2">
                  <select value={asignacion.estado} onChange={(event) => updateAsignacion('estado', event.target.value)} className="input">
                    <option value="PAGADO">Pagado</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="VENCIDO">Vencido</option>
                  </select>
                </Field>
                {asignacion.estado === 'PAGADO' && (
                  <Field label="Método de pago" className="md:col-span-2">
                    <select value={asignacion.metodoPago} onChange={(event) => updateAsignacion('metodoPago', event.target.value)} className="input">
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </Field>
                )}
                <Field label="Fecha" className="md:col-span-2">
                  <input type="date" value={asignacion.fechaMovimiento} onChange={(event) => updateAsignacion('fechaMovimiento', event.target.value)} className="input" />
                </Field>
                <Field label="Vencimiento" className="md:col-span-2">
                  <input type="date" value={asignacion.fechaVencimiento} onChange={(event) => updateAsignacion('fechaVencimiento', event.target.value)} className="input" />
                </Field>
                <Field label="Tasa BCV" className="md:col-span-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      readOnly={!tasaEditadaManual}
                      value={asignacion.tasaBcv}
                      onChange={(event) => updateAsignacion('tasaBcv', event.target.value)}
                      className={`input min-w-0 ${tasaEditadaManual ? '' : 'bg-slate-100 font-bold text-slate-600'}`}
                    />
                    <button
                      type="button"
                      onClick={() => (tasaEditadaManual ? sincronizarTasaFormulario() : setTasaEditadaManual(true))}
                      className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      {tasaEditadaManual ? 'Sync' : 'Editar'}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    {tasaEditadaManual ? 'Tasa manual para este registro.' : 'Sincronizada con la BCV actual.'}
                  </p>
                </Field>
                <Field label="Referencia" className="md:col-span-2">
                  <input value={asignacion.referencia} onChange={(event) => updateAsignacion('referencia', event.target.value)} placeholder="Orden, factura o nota interna" className="input" />
                </Field>
                <Field label="Descripcion" className="md:col-span-4">
                  <textarea value={asignacion.descripcion} onChange={(event) => updateAsignacion('descripcion', event.target.value)} rows={3} className="input min-h-[78px] resize-y" />
                </Field>
              </div>
              </div>
            ) : (
              <ServiceLinesPanel
                lines={serviceLines}
                servicios={servicios}
                productosCliente={productosCliente}
                loadingProductosCliente={loadingProductosCliente}
                updateLine={updateServiceLine}
                addLine={addServiceLine}
                removeLine={removeServiceLine}
                syncRate={syncServiceLineRate}
                total={totalServicios}
              />
            )}
          </section>

          {isStarlinkSelection && (
            <StarlinkEnterpriseBlock
              form={asignacion}
              update={updateAsignacion}
              cuentasStarlink={cuentasStarlink}
              clientes={clientes}
              isServicioCompleto={isServicioCompleto}
              selectedCliente={selectedCliente}
            />
          )}

          <div className="flex flex-col gap-4 rounded-xl border border-teal-100 bg-teal-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-extrabold text-slate-950">Resumen de registro</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {isProductModule
                  ? `${selectedCliente?.nombre || 'Sin cliente'} / ${selectedItem?.nombre || `Sin ${singularTitle}`} / ${formatUsd(totalAsignacion)}`
                  : `${selectedCliente?.nombre || 'Sin cliente'} / ${serviceLines.length} servicio${serviceLines.length === 1 ? '' : 's'} / ${formatUsd(totalServicios)}`}
              </p>
            </div>
            <button disabled={saving} className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-extrabold text-white shadow hover:bg-teal-600 disabled:opacity-60 sm:min-w-[180px]">
              {saving ? 'Guardando...' : isProductModule ? 'Registrar venta' : 'Registrar servicios'}
            </button>
          </div>
        </form>
      )}

      {viewMode === 'nuevo' && isProductModule && (
        <CatalogManager
          title={productoForm.id ? 'Editar producto' : 'Nuevo producto'}
          search={buscar}
          setSearch={setBuscar}
          onClear={resetForms}
          order={ordenCatalogo}
          setOrder={setOrdenCatalogo}
          direction={direccionOrden}
          setDirection={setDireccionOrden}
          nameOrderLabel="Producto"
          form={(
            <CatalogForm onSubmit={saveProducto}>
              <CodeField label="Codigo producto" value={productoForm.codigoProducto} onChange={(value) => setProductoForm((prev) => ({ ...prev, codigoProducto: value }))} onAuto={() => autoCode('producto')} loading={autoCodeLoading === 'producto'} />
              <Field label="Nombre"><input required value={productoForm.nombre} onChange={(event) => setProductoForm((prev) => ({ ...prev, nombre: event.target.value }))} className="input" /></Field>
              <Field label="Descripcion"><textarea value={productoForm.descripcion} onChange={(event) => setProductoForm((prev) => ({ ...prev, descripcion: event.target.value }))} rows={3} className="input resize-y" /></Field>
              <CheckField label="Activo" checked={productoForm.activo} onChange={(value) => setProductoForm((prev) => ({ ...prev, activo: value }))} />
            </CatalogForm>
          )}
          table={(
            <DataTable headers={['Codigo', 'Producto', 'Estado', 'Acciones']}>
              {filtered.productos.map((producto) => (
                <tr key={producto.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs font-bold text-slate-600">{producto.codigoProducto || '-'}</td>
                  <td className="p-3"><p className="font-bold">{producto.nombre}</p><p className="text-xs text-slate-500">{producto.descripcion || '-'}</p></td>
                  <td className="p-3"><Status active={producto.activo} /></td>
                  <td className="p-3 text-right"><RowActions active={producto.activo} onEdit={() => setProductoForm({ ...emptyProducto, ...producto })} onToggle={() => toggleCatalogState(`/api/productos/${producto.id}`, producto, producto.nombre)} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        />
      )}

      {viewMode === 'nuevo' && !isProductModule && (
        <CatalogManager
          title={servicioForm.id ? 'Editar servicio' : 'Nuevo servicio'}
          search={buscar}
          setSearch={setBuscar}
          onClear={resetForms}
          order={ordenCatalogo}
          setOrder={setOrdenCatalogo}
          direction={direccionOrden}
          setDirection={setDireccionOrden}
          nameOrderLabel="Servicio"
          form={(
            <CatalogForm onSubmit={saveServicio}>
              <CodeField label="Codigo servicio" value={servicioForm.codigoServicio} onChange={(value) => setServicioForm((prev) => ({ ...prev, codigoServicio: value }))} onAuto={() => autoCode('servicio')} loading={autoCodeLoading === 'servicio'} />
              <Field label="Nombre"><input required value={servicioForm.nombre} onChange={(event) => setServicioForm((prev) => ({ ...prev, nombre: event.target.value }))} className="input" /></Field>
              <Field label="Descripcion"><textarea value={servicioForm.descripcion} onChange={(event) => setServicioForm((prev) => ({ ...prev, descripcion: event.target.value }))} rows={3} className="input resize-y" /></Field>
              <CheckField label="Activo" checked={servicioForm.activo} onChange={(value) => setServicioForm((prev) => ({ ...prev, activo: value }))} />
            </CatalogForm>
          )}
          table={(
            <DataTable headers={['Codigo', 'Servicio', 'Estado', 'Acciones']}>
              {filtered.servicios.map((servicio) => (
                <tr key={servicio.id} className="border-b last:border-b-0">
                  <td className="p-3 font-mono text-xs font-bold text-slate-600">{servicio.codigoServicio || '-'}</td>
                  <td className="p-3"><p className="font-bold">{servicio.nombre}</p><p className="text-xs text-slate-500">{servicio.descripcion || '-'}</p></td>
                  <td className="p-3"><Status active={servicio.activo} /></td>
                  <td className="p-3 text-right"><RowActions active={servicio.activo} onEdit={() => setServicioForm({ ...emptyServicio, ...servicio })} onToggle={() => toggleCatalogState(`/api/servicios/${servicio.id}`, servicio, servicio.nombre)} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        />
      )}
    </section>
  );
}

function ServiceLinesPanel({
  lines,
  servicios,
  productosCliente,
  loadingProductosCliente,
  updateLine,
  addLine,
  removeLine,
  syncRate,
  total,
}) {
  const productMovementLabel = (movement) => {
    const product = movement.producto;
    const productName = product?.nombre || movement.concepto || 'Producto';
    const code = product?.codigoProducto || 'Sin código';
    const date = movement.fechaMovimiento ? new Date(movement.fechaMovimiento).toLocaleDateString('es-VE') : 'Sin fecha';
    return `${code} - ${productName} / ${date}${movement.referencia ? ` / ${movement.referencia}` : ''}`;
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase text-teal-700">Detalle comercial</p>
          <h3 className="text-base font-extrabold text-slate-950">Servicios del cliente</h3>
          <p className="mt-1 text-xs text-slate-500">Cada línea conserva su precio, fechas, pago y producto relacionado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MiniSummary label="Servicios" value={String(lines.length)} />
          <MiniSummary label="Total" value={formatUsd(total)} strong />
          <button
            type="button"
            onClick={addLine}
            className="h-10 rounded-lg bg-slate-950 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800"
          >
            + Añadir servicio
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {lines.map((line, index) => {
          const service = servicios.find((item) => item.id === line.itemId);
          const lineTotal = Math.max(toNumber(line.cantidad, 1), 1) * toNumber(line.precioUsd, 0);
          return (
            <fieldset key={line.id} className="min-w-0 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-extrabold text-white">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <legend className="truncate text-sm font-extrabold text-slate-900">{service?.nombre || `Servicio ${index + 1}`}</legend>
                    <p className="truncate text-xs text-slate-500">{service?.codigoServicio || 'Selecciona un registro del portafolio'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length === 1}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                >
                  Eliminar línea
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12">
                <Field label="Servicio" className="md:col-span-3 xl:col-span-5">
                  <select value={line.itemId} onChange={(event) => updateLine(line.id, 'itemId', event.target.value)} className="input">
                    <option value="">Selecciona servicio</option>
                    {servicios.filter((item) => item.activo).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.codigoServicio ? `${item.codigoServicio} - ` : ''}{item.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Cantidad" className="md:col-span-1 xl:col-span-2">
                  <input type="number" min="1" step="1" value={line.cantidad} onChange={(event) => updateLine(line.id, 'cantidad', event.target.value)} className="input" />
                </Field>
                <Field label="Precio USD" className="md:col-span-1 xl:col-span-2">
                  <input type="number" min="0" step="0.01" value={line.precioUsd} onChange={(event) => updateLine(line.id, 'precioUsd', event.target.value)} className="input" />
                </Field>
                <Field label="Total" className="md:col-span-1 xl:col-span-3">
                  <input readOnly value={formatUsd(lineTotal)} className="input bg-slate-100 font-extrabold text-slate-700" />
                </Field>

                <Field label="Estado" className="md:col-span-2 xl:col-span-2">
                  <select value={line.estado} onChange={(event) => updateLine(line.id, 'estado', event.target.value)} className="input">
                    <option value="PAGADO">Pagado</option>
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="VENCIDO">Vencido</option>
                  </select>
                </Field>
                {line.estado === 'PAGADO' && (
                  <Field label="Método de pago" className="md:col-span-2 xl:col-span-2">
                    <select value={line.metodoPago} onChange={(event) => updateLine(line.id, 'metodoPago', event.target.value)} className="input">
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="EFECTIVO">Efectivo</option>
                    </select>
                  </Field>
                )}
                <Field label="Fecha" className="md:col-span-2 xl:col-span-2">
                  <input type="date" value={line.fechaMovimiento} onChange={(event) => updateLine(line.id, 'fechaMovimiento', event.target.value)} className="input" />
                </Field>
                <Field label="Vencimiento" className="md:col-span-2 xl:col-span-2">
                  <input type="date" value={line.fechaVencimiento} onChange={(event) => updateLine(line.id, 'fechaVencimiento', event.target.value)} className="input" />
                </Field>
                <Field label="Tasa BCV" className="md:col-span-2 xl:col-span-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      readOnly={!line.tasaEditadaManual}
                      value={line.tasaBcv}
                      onChange={(event) => updateLine(line.id, 'tasaBcv', event.target.value)}
                      className={`input min-w-0 ${line.tasaEditadaManual ? '' : 'bg-slate-100 font-bold text-slate-600'}`}
                    />
                    <button
                      type="button"
                      onClick={() => (line.tasaEditadaManual ? syncRate(line.id) : updateLine(line.id, 'tasaBcv', line.tasaBcv))}
                      className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      {line.tasaEditadaManual ? 'Sync' : 'Editar'}
                    </button>
                  </div>
                </Field>
                <Field label="Producto adquirido relacionado" className="md:col-span-4 xl:col-span-4">
                  <select
                    value={line.movimientoRelacionadoId}
                    onChange={(event) => updateLine(line.id, 'movimientoRelacionadoId', event.target.value)}
                    disabled={loadingProductosCliente}
                    className="input"
                  >
                    <option value="">{loadingProductosCliente ? 'Cargando productos...' : 'Sin producto asociado'}</option>
                    {productosCliente.map((movement) => (
                      <option key={movement.id} value={movement.id}>{productMovementLabel(movement)}</option>
                    ))}
                  </select>
                  {!loadingProductosCliente && productosCliente.length === 0 && (
                    <p className="mt-1 text-[11px] font-medium text-slate-400">El cliente no tiene ventas de producto registradas.</p>
                  )}
                </Field>
                <Field label="Referencia" className="md:col-span-2 xl:col-span-3">
                  <input value={line.referencia} onChange={(event) => updateLine(line.id, 'referencia', event.target.value)} placeholder="Orden, factura o nota interna" className="input" />
                </Field>
                <Field label="Descripción" className="md:col-span-6 xl:col-span-5">
                  <textarea value={line.descripcion} onChange={(event) => updateLine(line.id, 'descripcion', event.target.value)} rows={2} className="input min-h-[66px] resize-y" />
                </Field>
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

function StarlinkEnterpriseBlock({
  form,
  update,
  cuentasStarlink = [],
  clientes = [],
  isServicioCompleto,
  selectedCliente,
}) {
  const clientesById = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes]);
  const cuentasActivas = useMemo(
    () => cuentasStarlink.filter((cuenta) => cuenta.estado !== 'INACTIVA'),
    [cuentasStarlink],
  );

  const selectCuenta = (cuentaId) => {
    const cuenta = cuentasStarlink.find((item) => item.id === cuentaId);
    update('cuentaStarlinkId', cuentaId);
    update('antenaStarlinkId', '');

    if (!cuenta) {
      update('nombreCuenta', '');
      update('correoCuenta', '');
      return;
    }

    if (cuenta.clienteId) update('clienteId', cuenta.clienteId);
    update('montoMensualUsd', cuenta.montoMensualUsd?.toString() || form.montoMensualUsd);
    update('fechaCorte', toInputDate(cuenta.fechaCorte) || form.fechaCorte);
    update('nombreCuenta', cuenta.nombreCuenta || '');
    update('correoCuenta', cuenta.correoCuenta || '');
  };

  const cuentaOptionLabel = (cuenta) => {
    const cliente = cuenta.cliente || clientesById.get(cuenta.clienteId);
    const correo = cuenta.correoCuenta || 'Sin correo';
    const nombre = cuenta.nombreCuenta || 'Cuenta Starlink';
    return `${correo} / ${cliente?.nombre || 'Sin cliente'} / ${nombre}`;
  };

  return (
    <section className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
      <div className="flex flex-col gap-2 border-b border-cyan-100 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-sm font-extrabold uppercase text-cyan-950">Datos Starlink</h3>
          <p className="text-xs text-cyan-800">Este bloque aparece al seleccionar un producto Starlink.</p>
        </div>
        <Field label="Modalidad">
          <select value={form.tipoContratacionStarlink} onChange={(event) => update('tipoContratacionStarlink', event.target.value)} className="input min-w-[220px]">
            <option value="SOLO_ANTENA">Solo antena</option>
            <option value="SERVICIO_COMPLETO">Servicio completo</option>
          </select>
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Correo / cuenta Starlink" className="xl:col-span-2">
          <select value={form.cuentaStarlinkId} onChange={(event) => selectCuenta(event.target.value)} className="input">
            <option value="">Registrar nueva cuenta/correo</option>
            {cuentasActivas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>{cuentaOptionLabel(cuenta)}</option>
            ))}
          </select>
        </Field>
        <Field label="Nombre de referencia">
          <input readOnly={Boolean(form.cuentaStarlinkId)} value={form.nombreCuenta} onChange={(event) => update('nombreCuenta', event.target.value)} placeholder={`${selectedCliente?.nombre || 'Cliente'} - Starlink`} className={`input ${form.cuentaStarlinkId ? 'bg-slate-100 font-bold text-slate-600' : ''}`} />
        </Field>
        <Field label="Correo asociado">
          <input readOnly={Boolean(form.cuentaStarlinkId)} type="email" value={form.correoCuenta} onChange={(event) => update('correoCuenta', event.target.value)} placeholder="correo@starlink.com" className={`input ${form.cuentaStarlinkId ? 'bg-slate-100 font-bold text-slate-600' : ''}`} />
        </Field>
      </div>

      {isServicioCompleto && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Monto mensual USD">
            <input type="number" min="0" step="0.01" value={form.montoMensualUsd} onChange={(event) => update('montoMensualUsd', event.target.value)} className="input" />
          </Field>
          <Field label="Fecha de corte">
            <input type="date" value={form.fechaCorte} onChange={(event) => update('fechaCorte', event.target.value)} className="input" />
          </Field>
          <Field label="Periodo">
            <input type="month" value={form.periodo} onChange={(event) => update('periodo', event.target.value)} className="input" />
          </Field>
          <Field label="Fecha de pago">
            <input type="date" value={form.fechaPago} onChange={(event) => update('fechaPago', event.target.value)} className="input" />
          </Field>
          <Field label="Estado pago">
            <select value={form.estadoPago} onChange={(event) => update('estadoPago', event.target.value)} className="input">
              <option value="PENDIENTE">Pendiente</option>
              <option value="PAGADO">Pagado</option>
              <option value="VENCIDO">Vencido</option>
            </select>
          </Field>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Nombre antena">
          <input required value={form.nombreAntena} onChange={(event) => update('nombreAntena', event.target.value)} placeholder="Antena Starlink principal" className="input" />
        </Field>
        <Field label="Numero kit">
          <input value={form.numeroKit} onChange={(event) => update('numeroKit', event.target.value)} className="input" />
        </Field>
        <Field label="S/N (obligatorio)">
          <input required value={form.numeroSerie} onChange={(event) => update('numeroSerie', event.target.value)} placeholder="Serial único de la antena" className="input" />
        </Field>
        <Field label="Fecha registro">
          <input type="date" value={form.fechaRegistro} onChange={(event) => update('fechaRegistro', event.target.value)} className="input" />
        </Field>
        <Field label="Ubicacion">
          <input value={form.ubicacion} onChange={(event) => update('ubicacion', event.target.value)} className="input" />
        </Field>
        <Field label="Observaciones">
          <textarea value={form.observacionesStarlink} onChange={(event) => update('observacionesStarlink', event.target.value)} rows={3} className="input resize-y md:col-span-2 xl:col-span-3" />
        </Field>
      </div>
    </section>
  );
}

function CatalogManager({
  title,
  search,
  setSearch,
  onClear,
  order,
  setOrder,
  direction,
  setDirection,
  nameOrderLabel,
  form,
  table,
}) {
  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-slate-50 p-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase text-teal-700">Alta de registro</p>
          <h3 className="text-lg font-extrabold text-slate-950">{title}</h3>
          <p className="text-sm text-slate-500">Crea registros base. El precio y la cantidad se cargan al registrar la venta.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,auto)_auto_auto]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="input min-w-[220px]" />
          <select value={order} onChange={(event) => setOrder(event.target.value)} className="input" aria-label="Ordenar registros">
            <option value="codigo">Código</option>
            <option value="nombre">{nameOrderLabel}</option>
            <option value="estado">Estado</option>
          </select>
          <button
            type="button"
            onClick={() => setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
            title={direction === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
          >
            {direction === 'asc' ? 'A-Z' : 'Z-A'}
          </button>
          <button type="button" onClick={onClear} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Limpiar</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {form}
        {table}
      </div>
    </div>
  );
}

function CatalogForm({ onSubmit, children }) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-3">{children}</div>
      <button className="mt-4 w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-extrabold text-white shadow hover:bg-teal-600">Guardar registro</button>
    </form>
  );
}

function MiniSummary({ label, value, strong = false }) {
  return (
    <div className={`min-w-0 rounded-lg border px-3 py-2 sm:min-w-[140px] ${strong ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-[10px] font-extrabold uppercase text-slate-500">{label}</p>
      <p className={`truncate text-sm ${strong ? 'font-extrabold text-emerald-800' : 'font-bold text-slate-800'}`}>{value}</p>
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <label className={`block min-w-0 text-xs font-bold text-slate-500 ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function CodeField({ label, value, onChange, onAuto, loading = false }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input value={value} onChange={(event) => onChange(event.target.value)} className="input font-mono" />
        <button type="button" onClick={onAuto} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60">
          {loading ? '...' : 'Auto'}
        </button>
      </div>
    </Field>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
      {label}
    </label>
  );
}

function DataTable({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Status({ active }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{active ? 'Activo' : 'Inactivo'}</span>;
}

function RowActions({ active, onEdit, onToggle }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onEdit} className="text-xs font-bold text-blue-600">Editar</button>
      <button type="button" onClick={onToggle} className={`text-xs font-bold ${active ? 'text-red-600' : 'text-emerald-700'}`}>
        {active ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  );
}
