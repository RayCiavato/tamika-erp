"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const TIPOS = [
  { value: 'INGRESO', label: 'Ingreso' },
  { value: 'EGRESO', label: 'Egreso' },
  { value: 'CUENTA_POR_COBRAR', label: 'Cuenta por cobrar' },
  { value: 'CUENTA_POR_PAGAR', label: 'Cuenta por pagar' },
];

const ESTADOS = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'PAGADO', label: 'Pagado' },
  { value: 'VENCIDO', label: 'Vencido' },
  { value: 'ANULADO', label: 'Anulado' },
];

const CATEGORIAS = ['Servicio', 'Producto', 'Nomina', 'Pago de factura', 'Suscripcion', 'Otro'];
const METODOS_PAGO = [
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'EFECTIVO', label: 'Efectivo' },
];

const estadoStyles = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  PAGADO: 'bg-emerald-100 text-emerald-800',
  VENCIDO: 'bg-red-100 text-red-800',
  ANULADO: 'bg-slate-200 text-slate-700',
};

const tasaFuenteLabel = {
  BCV_API: 'Tasa actual cargada automáticamente',
  CACHE: 'Tasa cacheada',
  FALLBACK: 'Tasa de respaldo',
  MANUAL: 'Tasa modificada manualmente',
  NO_DISPONIBLE: 'Tasa no disponible',
};

const emptyForm = () => ({
  tipo: 'INGRESO',
  concepto: '',
  descripcion: '',
  montoUsd: '',
  tasaBcv: '',
  tasaFuente: 'NO_DISPONIBLE',
  tasaFecha: '',
  tasaEditadaManual: false,
  fechaMovimiento: new Date().toISOString().slice(0, 10),
  fechaVencimiento: '',
  estado: 'PAGADO',
  metodoPago: 'TRANSFERENCIA',
  clienteId: '',
  categoria: '',
  proveedorId: '',
  productoId: '',
  servicioId: '',
  tipoProductoId: '',
  tipoServicioId: '',
  referencia: '',
  movimientoRelacionadoId: '',
});

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const formatBs = (value) => currency(value || 0, { symbol: 'Bs ', separator: '.', decimal: ',' }).format();
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '-');
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const clienteEtiqueta = (cliente) => cliente?.alias || cliente?.nombre || '';

export default function ContabilidadView({ clientes = [], onChanged, tasaBcvActual, apiFetch = fetch, focusMovementId = '', onFocusHandled }) {
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState({});
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loadingTasa, setLoadingTasa] = useState(false);
  const [tasaMensaje, setTasaMensaje] = useState('');
  const [filters, setFilters] = useState({ tipo: '', estado: '', buscar: '', desde: '', hasta: '' });
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [tiposProducto, setTiposProducto] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [grafica, setGrafica] = useState([]);
  const [mesesGrafica, setMesesGrafica] = useState('12');
  const [loadingGrafica, setLoadingGrafica] = useState(false);

  const montoBsCalculado = useMemo(() => {
    const monto = Number(form.montoUsd || 0);
    const tasa = Number(form.tasaBcv || 0);
    return monto > 0 && tasa > 0 ? monto * tasa : 0;
  }, [form.montoUsd, form.tasaBcv]);
  const clienteSeleccionado = useMemo(
    () => clientes.find((cliente) => cliente.id === form.clienteId),
    [clientes, form.clienteId],
  );
  const codigoClienteAsociado = clienteSeleccionado?.codigoCliente || clienteSeleccionado?.id || '';

  const cargarMovimientos = async () => {
    setLoading(true);
    setMensaje('');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    try {
      const res = await apiFetch(`/api/contabilidad?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar contabilidad.');
      setMovimientos(Array.isArray(data.movimientos) ? data.movimientos : []);
      setResumen(data.resumen || {});
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  const cargarGrafica = async () => {
    setLoadingGrafica(true);
    try {
      const res = await apiFetch(`/api/contabilidad/grafica?meses=${mesesGrafica}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la gráfica.');
      setGrafica(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      setGrafica([]);
    } finally {
      setLoadingGrafica(false);
    }
  };

  const cargarCatalogos = async () => {
    try {
      const [productosRes, serviciosRes, tiposProductoRes, tiposServicioRes] = await Promise.all([
        apiFetch('/api/productos'),
        apiFetch('/api/servicios'),
        apiFetch('/api/tipos-producto'),
        apiFetch('/api/tipos-servicio'),
      ]);
      const [productosData, serviciosData, tiposProductoData, tiposServicioData] = await Promise.all([
        productosRes.json().catch(() => []),
        serviciosRes.json().catch(() => []),
        tiposProductoRes.json().catch(() => []),
        tiposServicioRes.json().catch(() => []),
      ]);
      setProductos(Array.isArray(productosData) ? productosData : []);
      setServicios(Array.isArray(serviciosData) ? serviciosData : []);
      setTiposProducto(Array.isArray(tiposProductoData) ? tiposProductoData : []);
      setTiposServicio(Array.isArray(tiposServicioData) ? tiposServicioData : []);
    } catch (error) {
      setMensaje('No se pudieron cargar los catálogos contables.');
    }
  };

  const cargarTasaBcv = async ({ skipConfirm = false } = {}) => {
    if (form.tasaEditadaManual && !skipConfirm) {
      const reemplazar = confirm('Ya modificaste la tasa manualmente. ¿Deseas reemplazarla por la tasa actual?');
      if (!reemplazar) return;
    }

    setLoadingTasa(true);
    setTasaMensaje('');

    try {
      const res = await apiFetch('/api/tasas/bcv');
      const data = await res.json();

      if (!data.success || !data.tasa) {
        throw new Error(data.message || 'No se pudo obtener la tasa actual. Puedes ingresarla manualmente.');
      }

      setForm((prev) => ({
        ...prev,
        tasaBcv: data.tasa.toString(),
        tasaFuente: data.fuente || 'BCV_API',
        tasaFecha: data.fecha || '',
        tasaEditadaManual: false,
      }));
      setTasaMensaje(tasaFuenteLabel[data.fuente] || tasaFuenteLabel.BCV_API);
    } catch (error) {
      setForm((prev) => ({
        ...prev,
        tasaFuente: prev.tasaBcv ? 'MANUAL' : 'NO_DISPONIBLE',
      }));
      setTasaMensaje(error.message || 'No se pudo obtener la tasa actual. Puedes ingresarla manualmente.');
    } finally {
      setLoadingTasa(false);
    }
  };

  useEffect(() => {
    cargarMovimientos();
  }, [filters.tipo, filters.estado, filters.desde, filters.hasta]);

  useEffect(() => {
    cargarTasaBcv({ skipConfirm: true });
    cargarCatalogos();
  }, []);

  useEffect(() => {
    cargarGrafica();
  }, [mesesGrafica]);

  useEffect(() => {
    if (!tasaBcvActual?.tasa || editingId || form.tasaEditadaManual) return;

    setForm((prev) => ({
      ...prev,
      tasaBcv: tasaBcvActual.tasa.toString(),
      tasaFuente: tasaBcvActual.fuente || 'BCV_API',
      tasaFecha: tasaBcvActual.fecha || '',
      tasaEditadaManual: false,
    }));
    setTasaMensaje(tasaFuenteLabel[tasaBcvActual.fuente] || tasaFuenteLabel.BCV_API);
  }, [tasaBcvActual?.version]);

  const handleFilterSearch = (event) => {
    event.preventDefault();
    cargarMovimientos();
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateTasaManual = (value) => {
    setForm((prev) => ({
      ...prev,
      tasaBcv: value,
      tasaFuente: value ? 'MANUAL' : 'NO_DISPONIBLE',
      tasaEditadaManual: true,
    }));
    setTasaMensaje(value ? tasaFuenteLabel.MANUAL : 'Puedes ingresar la tasa manualmente.');
  };
  const updateTipo = (value) => {
    setForm((prev) => ({
      ...prev,
      tipo: value,
      estado: value === 'CUENTA_POR_COBRAR' || value === 'CUENTA_POR_PAGAR' ? 'PENDIENTE' : 'PAGADO',
    }));
  };
  const updateCategoria = (value) => {
    setForm((prev) => ({
      ...prev,
      categoria: value,
      productoId: value === 'Producto' ? prev.productoId : '',
      servicioId: value === 'Servicio' || value === 'Suscripcion' ? prev.servicioId : '',
      tipoProductoId: value === 'Producto' ? prev.tipoProductoId : '',
      tipoServicioId: value === 'Servicio' || value === 'Suscripcion' ? prev.tipoServicioId : '',
    }));
  };
  const seleccionarProducto = (id) => {
    const producto = productos.find((item) => item.id === id);
    setForm((prev) => ({
      ...prev,
      productoId: id,
      tipoProductoId: producto?.tipoProductoId || prev.tipoProductoId,
      concepto: prev.concepto || producto?.nombre || '',
      descripcion: prev.descripcion || producto?.descripcion || '',
      montoUsd: prev.montoUsd || producto?.precioUsd?.toString() || '',
    }));
  };
  const seleccionarServicio = (id) => {
    const servicio = servicios.find((item) => item.id === id);
    setForm((prev) => ({
      ...prev,
      servicioId: id,
      tipoServicioId: servicio?.tipoServicioId || prev.tipoServicioId,
      concepto: prev.concepto || servicio?.nombre || '',
      descripcion: prev.descripcion || servicio?.descripcion || '',
      montoUsd: prev.montoUsd || servicio?.precioUsd?.toString() || '',
    }));
  };
  const updateFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    cargarTasaBcv({ skipConfirm: true });
  };

  const guardarMovimiento = async (event) => {
    event.preventDefault();
    setMensaje('');

    const payload = {
      ...form,
      montoBs: montoBsCalculado > 0 ? montoBsCalculado : undefined,
      tasaEditadaManual: Boolean(form.tasaEditadaManual),
      tasaFuente: form.tasaFuente === 'NO_DISPONIBLE' ? null : form.tasaFuente,
      tasaFecha: form.tasaFecha || null,
      clienteId: form.clienteId || null,
      categoria: form.categoria || null,
      fechaVencimiento: form.fechaVencimiento || null,
      proveedorId: form.proveedorId || null,
      productoId: form.productoId || null,
      servicioId: form.servicioId || null,
      tipoProductoId: form.tipoProductoId || null,
      tipoServicioId: form.tipoServicioId || null,
      metodoPago: form.estado === 'PAGADO' ? form.metodoPago || null : null,
      movimientoRelacionadoId: form.movimientoRelacionadoId || null,
    };

    try {
      const res = await apiFetch(editingId ? `/api/contabilidad/${editingId}` : '/api/contabilidad', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.join(' ') || data.error || 'No se pudo guardar.');
      resetForm();
      await cargarMovimientos();
      await cargarGrafica();
      onChanged?.();
      setMensaje(editingId ? 'Movimiento actualizado.' : 'Movimiento creado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const editarMovimiento = (mov) => {
    setEditingId(mov.id);
    setForm({
      tipo: mov.tipo,
      concepto: mov.concepto || '',
      descripcion: mov.descripcion || '',
      montoUsd: mov.montoUsd?.toString() || '',
      tasaBcv: mov.tasaBcv?.toString() || '',
      tasaFuente: mov.tasaFuente || (mov.tasaBcv ? 'MANUAL' : 'NO_DISPONIBLE'),
      tasaFecha: mov.tasaFecha || '',
      tasaEditadaManual: Boolean(mov.tasaEditadaManual),
      fechaMovimiento: toDateInput(mov.fechaMovimiento),
      fechaVencimiento: toDateInput(mov.fechaVencimiento),
      estado: mov.estado,
      metodoPago: mov.metodoPago || 'TRANSFERENCIA',
      clienteId: mov.clienteId || '',
      categoria: mov.categoria || '',
      proveedorId: mov.proveedorId || '',
      productoId: mov.productoId || '',
      servicioId: mov.servicioId || '',
      tipoProductoId: mov.tipoProductoId || '',
      tipoServicioId: mov.tipoServicioId || '',
      referencia: mov.referencia || '',
      movimientoRelacionadoId: mov.movimientoRelacionadoId || '',
    });
    setTasaMensaje(tasaFuenteLabel[mov.tasaFuente] || (mov.tasaBcv ? 'Tasa guardada en el movimiento.' : ''));
  };

  useEffect(() => {
    if (!focusMovementId) return;
    let active = true;
    apiFetch(`/api/contabilidad/${focusMovementId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo abrir el movimiento.');
        if (!active) return;
        editarMovimiento(data);
        setMensaje('Movimiento cargado desde el dashboard.');
        setTimeout(() => document.getElementById('contabilidad-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      })
      .catch((error) => active && setMensaje(error.message))
      .finally(() => active && onFocusHandled?.());
    return () => { active = false; };
  }, [focusMovementId]);

  const cambiarEstado = async (mov, estado) => {
    try {
      const res = await apiFetch(`/api/contabilidad/${mov.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el estado.');
      await cargarMovimientos();
      await cargarGrafica();
      onChanged?.();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const eliminarMovimiento = async (mov) => {
    if (!confirm(`Eliminar movimiento "${mov.concepto}"?`)) return;
    try {
      const res = await apiFetch(`/api/contabilidad/${mov.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar.');
      await cargarMovimientos();
      await cargarGrafica();
      onChanged?.();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Contabilidad</h2>
          <p className="text-sm text-slate-500">Gestión de ingresos, egresos y cuentas pendientes.</p>
        </div>
        <button onClick={resetForm} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow hover:bg-slate-800">Nuevo movimiento</button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <Metric title="Ingresos" value={formatUsd(resumen.totalIngresos)} tone="emerald" />
        <Metric title="Egresos" value={formatUsd(resumen.totalEgresos)} tone="red" />
        <Metric title="Balance" value={formatUsd(resumen.balance)} tone={(resumen.balance || 0) >= 0 ? 'emerald' : 'red'} />
        <Metric title="Por cobrar" value={formatUsd(resumen.pendientePorCobrar)} tone="amber" />
        <Metric title="Por pagar" value={formatUsd(resumen.pendientePorPagar)} tone="slate" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase text-teal-700">Comportamiento financiero</p>
            <h3 className="font-extrabold text-slate-950">Comparativo mensual</h3>
            <p className="text-sm text-slate-500">Ingresos, egresos y cuentas pendientes por mes.</p>
          </div>
          <Field label="Período visible">
            <select value={mesesGrafica} onChange={(event) => setMesesGrafica(event.target.value)} className="input min-w-[170px]">
              <option value="6">Últimos 6 meses</option>
              <option value="12">Últimos 12 meses</option>
              <option value="24">Últimos 24 meses</option>
            </select>
          </Field>
        </div>
        <AccountingBarChart data={grafica} loading={loadingGrafica} />
      </section>

      {mensaje && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm">{mensaje}</div>}

      <section className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <form id="contabilidad-form" onSubmit={guardarMovimiento} className="min-w-0 scroll-mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-950">{editingId ? 'Editar movimiento' : 'Crear movimiento'}</h3>
            {editingId && <button type="button" onClick={resetForm} className="text-xs font-bold text-slate-500 hover:text-slate-900">Cancelar</button>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <select value={form.tipo} onChange={(e) => updateTipo(e.target.value)} className="input">
                {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.estado} onChange={(e) => updateForm('estado', e.target.value)} className="input">
                {ESTADOS.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
              </select>
            </Field>
            {form.estado === 'PAGADO' && (
              <Field label="Método de pago" className="sm:col-span-2">
                <select value={form.metodoPago} onChange={(e) => updateForm('metodoPago', e.target.value)} className="input">
                  {METODOS_PAGO.map((metodo) => <option key={metodo.value} value={metodo.value}>{metodo.label}</option>)}
                </select>
              </Field>
            )}
            <Field label="Concepto" className="sm:col-span-2">
              <input required value={form.concepto} onChange={(e) => updateForm('concepto', e.target.value)} className="input" />
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              <textarea value={form.descripcion} onChange={(e) => updateForm('descripcion', e.target.value)} rows={3} className="input resize-y" />
            </Field>
            <Field label="Monto USD">
              <input required type="number" min="0" step="0.01" value={form.montoUsd} onChange={(e) => updateForm('montoUsd', e.target.value)} className="input" />
            </Field>
            <div className="text-xs font-bold text-slate-500">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span>Tasa BCV</span>
                <button type="button" onClick={() => cargarTasaBcv()} disabled={loadingTasa} className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">
                  {loadingTasa ? 'Consultando...' : 'Actualizar tasa BCV'}
                </button>
              </div>
              <input type="number" min="0" step="0.01" value={form.tasaBcv} onChange={(e) => updateTasaManual(e.target.value)} className="input" />
              <p className={`mt-1 text-[11px] ${form.tasaFuente === 'MANUAL' ? 'text-amber-700' : form.tasaFuente === 'NO_DISPONIBLE' ? 'text-red-600' : 'text-emerald-700'}`}>
                {loadingTasa ? 'Consultando tasa actual...' : tasaMensaje || tasaFuenteLabel[form.tasaFuente] || tasaFuenteLabel.NO_DISPONIBLE}
              </p>
            </div>
            <Field label="Monto Bs calculado" className="sm:col-span-2">
              <input readOnly value={montoBsCalculado > 0 ? formatBs(montoBsCalculado) : '-'} className="input bg-slate-100 font-bold text-slate-600" />
            </Field>
            <Field label="Fecha movimiento">
              <input required type="date" value={form.fechaMovimiento} onChange={(e) => updateForm('fechaMovimiento', e.target.value)} className="input" />
            </Field>
            <Field label="Fecha vencimiento">
              <input type="date" value={form.fechaVencimiento} onChange={(e) => updateForm('fechaVencimiento', e.target.value)} className="input" />
            </Field>
            <Field label="Cliente" className="sm:col-span-2">
              <select value={form.clienteId} onChange={(e) => updateForm('clienteId', e.target.value)} className="input">
                <option value="">Sin cliente asociado</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.codigoCliente ? `${cliente.codigoCliente} - ` : ''}{cliente.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Código cliente" className="sm:col-span-2">
              <input readOnly value={codigoClienteAsociado || '-'} className="input bg-slate-100 font-mono text-xs text-slate-500" />
            </Field>
            <Field label="Categoria">
              <select value={form.categoria} onChange={(e) => updateCategoria(e.target.value)} className="input">
                <option value="">Sin categoria</option>
                {CATEGORIAS.map((categoria) => <option key={categoria} value={categoria}>{categoria}</option>)}
              </select>
            </Field>
            <Field label="Referencia">
              <input value={form.referencia} onChange={(e) => updateForm('referencia', e.target.value)} className="input" />
            </Field>
            {(form.categoria === 'Producto') && (
              <>
                <Field label="Tipo producto">
                  <select value={form.tipoProductoId} onChange={(e) => updateForm('tipoProductoId', e.target.value)} className="input">
                    <option value="">Todos</option>
                    {tiposProducto.filter((tipo) => tipo.activo).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Producto">
                  <select value={form.productoId} onChange={(e) => seleccionarProducto(e.target.value)} className="input">
                    <option value="">Selecciona producto</option>
                    {productos.filter((producto) => producto.activo && (!form.tipoProductoId || producto.tipoProductoId === form.tipoProductoId)).map((producto) => (
                      <option key={producto.id} value={producto.id}>{producto.codigoProducto ? `${producto.codigoProducto} - ` : ''}{producto.nombre}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {(form.categoria === 'Servicio' || form.categoria === 'Suscripcion') && (
              <>
                <Field label="Tipo servicio">
                  <select value={form.tipoServicioId} onChange={(e) => updateForm('tipoServicioId', e.target.value)} className="input">
                    <option value="">Todos</option>
                    {tiposServicio.filter((tipo) => tipo.activo).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Servicio">
                  <select value={form.servicioId} onChange={(e) => seleccionarServicio(e.target.value)} className="input">
                    <option value="">Selecciona servicio</option>
                    {servicios.filter((servicio) => servicio.activo && (!form.tipoServicioId || servicio.tipoServicioId === form.tipoServicioId)).map((servicio) => (
                      <option key={servicio.id} value={servicio.id}>{servicio.codigoServicio ? `${servicio.codigoServicio} - ` : ''}{servicio.nombre}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>

          <button type="submit" className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-emerald-500">
            {editingId ? 'Actualizar movimiento' : 'Guardar movimiento'}
          </button>
        </form>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <form onSubmit={handleFilterSearch} className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            <select value={filters.tipo} onChange={(e) => updateFilter('tipo', e.target.value)} className="input">
              <option value="">Todos los tipos</option>
              {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
            </select>
            <select value={filters.estado} onChange={(e) => updateFilter('estado', e.target.value)} className="input">
              <option value="">Todos los estados</option>
              {ESTADOS.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
            </select>
            <input type="date" value={filters.desde} onChange={(e) => updateFilter('desde', e.target.value)} className="input" />
            <input type="date" value={filters.hasta} onChange={(e) => updateFilter('hasta', e.target.value)} className="input" />
            <div className="flex gap-2 md:col-span-2 xl:col-span-4 2xl:col-span-1">
              <input placeholder="Buscar..." value={filters.buscar} onChange={(e) => updateFilter('buscar', e.target.value)} className="input" />
              <button className="rounded-lg bg-slate-900 px-3 text-sm font-bold text-white">Filtrar</button>
            </div>
          </form>

          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Movimiento</th>
                  <th className="p-3">Cliente/Ref.</th>
                  <th className="p-3 whitespace-nowrap">Estado</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Cargando movimientos...</td></tr>}
                {!loading && movimientos.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No hay movimientos para los filtros seleccionados.</td></tr>}
                {!loading && movimientos.map((mov) => (
                  <tr key={mov.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{formatDate(mov.fechaMovimiento)}</td>
                    <td className="p-3">
                      <p className="font-bold text-slate-950">{mov.concepto}</p>
                       <p className="text-xs text-slate-500">{TIPOS.find((t) => t.value === mov.tipo)?.label || mov.tipo}{mov.categoria ? ` · ${mov.categoria}` : ''}</p>
                       {mov.metodoPago && <p className="text-xs font-semibold text-teal-700">{METODOS_PAGO.find((item) => item.value === mov.metodoPago)?.label || mov.metodoPago}</p>}
                       {(mov.producto || mov.servicio) && <p className="text-xs font-semibold text-indigo-600">{mov.producto?.nombre || mov.servicio?.nombre}</p>}
                    </td>
                    <td className="p-3 text-slate-600">{clienteEtiqueta(mov.cliente) || mov.referencia || mov.producto?.nombre || mov.servicio?.nombre || '-'}</td>
                    <td className="p-3 whitespace-nowrap"><span className={`rounded-full px-2 py-1 text-xs font-bold ${estadoStyles[mov.estado] || 'bg-slate-100 text-slate-700'}`}>{mov.estado}</span></td>
                    <td className="p-3 text-right">
                      <p className="font-extrabold">{formatUsd(mov.montoUsd)}</p>
                      {mov.montoBs ? <p className="text-xs font-semibold text-slate-500">{formatBs(mov.montoBs)}</p> : null}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => editarMovimiento(mov)} className="text-xs font-bold text-blue-600">Editar</button>
                        {mov.estado !== 'PAGADO' && <button type="button" onClick={() => editarMovimiento({ ...mov, estado: 'PAGADO', metodoPago: mov.metodoPago || 'TRANSFERENCIA' })} className="text-xs font-bold text-emerald-600">Registrar pago</button>}
                        {mov.estado !== 'ANULADO' && <button type="button" onClick={() => cambiarEstado(mov, 'ANULADO')} className="text-xs font-bold text-slate-500">Anular</button>}
                        <button type="button" onClick={() => eliminarMovimiento(mov)} className="text-xs font-bold text-red-600">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

function AccountingBarChart({ data = [], loading = false }) {
  if (loading) return <div className="grid h-56 place-items-center text-sm font-semibold text-slate-500">Cargando gráfica...</div>;
  if (!data.length) return <div className="grid h-56 place-items-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">Sin movimientos para graficar.</div>;

  const series = [
    { key: 'ingresos', label: 'Ingresos', color: 'bg-emerald-500' },
    { key: 'egresos', label: 'Egresos', color: 'bg-red-500' },
    { key: 'porCobrar', label: 'Por cobrar', color: 'bg-amber-500' },
    { key: 'porPagar', label: 'Por pagar', color: 'bg-slate-500' },
  ];
  const max = Math.max(...data.flatMap((item) => series.map((serie) => Number(item[serie.key] || 0))), 1);
  const monthLabel = (value) => new Date(`${value}-01T00:00:00Z`).toLocaleDateString('es-VE', { month: 'short', year: '2-digit', timeZone: 'UTC' });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-600">
        {series.map((serie) => <span key={serie.key} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${serie.color}`} />{serie.label}</span>)}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex h-64 min-w-[720px] items-end gap-4 border-b border-slate-200 px-2">
          {data.map((item) => (
            <div key={item.mes} className="flex h-full min-w-[58px] flex-1 flex-col justify-end">
              <div className="flex h-[205px] items-end justify-center gap-1 border-b border-slate-100">
                {series.map((serie) => {
                  const value = Number(item[serie.key] || 0);
                  const height = value > 0 ? Math.max(5, Math.round((value / max) * 190)) : 2;
                  return (
                    <div key={serie.key} className="group relative flex h-full flex-1 items-end justify-center">
                      <div title={`${serie.label}: ${formatUsd(value)}`} className={`w-full max-w-4 rounded-t ${value > 0 ? serie.color : 'bg-slate-100'}`} style={{ height }} />
                    </div>
                  );
                })}
              </div>
              <p className="py-2 text-center text-[11px] font-bold capitalize text-slate-500">{monthLabel(item.mes)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, className = '', children }) {
  return (
    <label className={`text-xs font-bold text-slate-500 ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Metric({ title, value, tone }) {
  const colors = {
    emerald: 'text-emerald-700 border-emerald-200',
    red: 'text-red-700 border-red-200',
    amber: 'text-amber-700 border-amber-200',
    slate: 'text-slate-950 border-slate-200',
  };

  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${colors[tone] || colors.slate}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
