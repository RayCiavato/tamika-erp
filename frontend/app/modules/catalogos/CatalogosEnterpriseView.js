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
  const [tasaEditadaManual, setTasaEditadaManual] = useState(false);

  const catalogItems = isProductModule ? productos : servicios;
  const selectedItem = catalogItems.find((item) => item.id === asignacion.itemId);
  const selectedCliente = clientes.find((cliente) => cliente.id === asignacion.clienteId);
  const cantidad = Math.max(toNumber(asignacion.cantidad, 1), 1);
  const precioUnitario = toNumber(asignacion.precioUsd, 0);
  const totalAsignacion = Number((cantidad * precioUnitario).toFixed(2));
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
    return {
      servicios: filterRows(servicios, ['codigoServicio', 'nombre', 'descripcion']),
      productos: filterRows(productos, ['codigoProducto', 'nombre', 'descripcion']),
    };
  }, [buscar, servicios, productos]);

  useEffect(() => {
    setViewMode('registro');
    setAsignacion({ ...emptyAsignacion(), tasaBcv: tasaBcvSincronizada });
    setTasaEditadaManual(false);
    setMensaje('');
  }, [activeModule]);

  useEffect(() => {
    if (!tasaBcvActual?.tasa) return;
    setAsignacion((prev) => ({
      ...prev,
      tasaBcv: tasaEditadaManual ? prev.tasaBcv : tasaBcvActual.tasa.toString(),
    }));
  }, [tasaBcvActual?.version, tasaEditadaManual]);

  const readJson = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallback);
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

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const resetForms = () => {
    setServicioForm(emptyServicio);
    setProductoForm(emptyProducto);
    setAsignacion({ ...emptyAsignacion(), tasaBcv: tasaBcvSincronizada });
    setTasaEditadaManual(false);
  };

  const updateAsignacion = (field, value) => setAsignacion((prev) => ({ ...prev, [field]: value }));
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
      const payload = {
        ...servicioForm,
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
      const payload = {
        ...productoForm,
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

  const deactivate = async (endpoint, label) => {
    if (!confirm(`Desactivar ${label}?`)) return;
    try {
      const res = await apiFetch(endpoint, { method: 'DELETE' });
      await readJson(res, 'No se pudo desactivar.');
      await cargarCatalogos();
      setMensaje(`${label} desactivado.`);
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const autoCode = async (kind) => {
    const endpoint = kind === 'servicio'
      ? '/api/servicios/siguiente-codigo'
      : '/api/productos/siguiente-codigo';
    const res = await apiFetch(endpoint);
    const data = await readJson(res, 'No se pudo generar el codigo.');
    if (kind === 'servicio') setServicioForm((prev) => ({ ...prev, codigoServicio: data.codigoServicio || '' }));
    if (kind === 'producto') setProductoForm((prev) => ({ ...prev, codigoProducto: data.codigoProducto || '' }));
  };

  const crearMovimientoAdquisicion = async () => {
    const payload = {
      tipo: asignacion.estado === 'PAGADO' ? 'INGRESO' : 'CUENTA_POR_COBRAR',
      estado: asignacion.estado,
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
    };
    const res = await apiFetch('/api/contabilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return readJson(res, 'No se pudo registrar la adquisicion en contabilidad.');
  };

  const registrarStarlink = async () => {
    if (!isStarlinkSelection) return null;
    if (!asignacion.nombreAntena.trim()) throw new Error('El nombre de la antena Starlink es obligatorio.');

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
      numeroSerie: asignacion.numeroSerie || null,
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
    if (!asignacion.itemId) return setMensaje(`Selecciona un ${singularTitle}.`);

    setSaving(true);
    try {
      await registrarStarlink();
      await crearMovimientoAdquisicion();
      await cargarCatalogos();
      onChanged?.();
      setAsignacion((prev) => ({
        ...emptyAsignacion(),
        tasaBcv: tasaBcvSincronizada || prev.tasaBcv,
      }));
      setTasaEditadaManual(false);
      setMensaje(isStarlinkSelection
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
                      step="0.01"
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
                {selectedCliente?.nombre || 'Sin cliente'} / {selectedItem?.nombre || `Sin ${singularTitle}`} / {formatUsd(totalAsignacion)}
              </p>
            </div>
            <button disabled={saving} className="rounded-lg bg-teal-700 px-5 py-3 text-sm font-extrabold text-white shadow hover:bg-teal-600 disabled:opacity-60 sm:min-w-[180px]">
              {saving ? 'Guardando...' : 'Registrar venta'}
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
          form={(
            <CatalogForm onSubmit={saveProducto}>
              <CodeField label="Codigo producto" value={productoForm.codigoProducto} onChange={(value) => setProductoForm((prev) => ({ ...prev, codigoProducto: value }))} onAuto={() => autoCode('producto')} />
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
                  <td className="p-3 text-right"><RowActions onEdit={() => setProductoForm({ ...emptyProducto, ...producto })} onDelete={() => deactivate(`/api/productos/${producto.id}`, producto.nombre)} /></td>
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
          form={(
            <CatalogForm onSubmit={saveServicio}>
              <CodeField label="Codigo servicio" value={servicioForm.codigoServicio} onChange={(value) => setServicioForm((prev) => ({ ...prev, codigoServicio: value }))} onAuto={() => autoCode('servicio')} />
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
                  <td className="p-3 text-right"><RowActions onEdit={() => setServicioForm({ ...emptyServicio, ...servicio })} onDelete={() => deactivate(`/api/servicios/${servicio.id}`, servicio.nombre)} /></td>
                </tr>
              ))}
            </DataTable>
          )}
        />
      )}
    </section>
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
        <Field label="Numero serie">
          <input value={form.numeroSerie} onChange={(event) => update('numeroSerie', event.target.value)} className="input" />
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

function CatalogManager({ title, search, setSearch, onClear, form, table }) {
  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-slate-50 p-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase text-teal-700">Alta de registro</p>
          <h3 className="text-lg font-extrabold text-slate-950">{title}</h3>
          <p className="text-sm text-slate-500">Crea registros base. El precio y la cantidad se cargan al registrar la venta.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="input min-w-[220px]" />
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

function CodeField({ label, value, onChange, onAuto }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input value={value} onChange={(event) => onChange(event.target.value)} className="input font-mono" />
        <button type="button" onClick={onAuto} className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100">Auto</button>
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

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onEdit} className="text-xs font-bold text-blue-600">Editar</button>
      <button type="button" onClick={onDelete} className="text-xs font-bold text-red-600">Desactivar</button>
    </div>
  );
}
