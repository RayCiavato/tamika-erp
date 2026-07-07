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
  clienteId: '',
  proveedorId: '',
  referencia: '',
});

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const formatBs = (value) => currency(value || 0, { symbol: 'Bs ', separator: '.', decimal: ',' }).format();
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '-');
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export default function ContabilidadView({ clientes = [], onChanged, tasaBcvActual, apiFetch = fetch }) {
  const [movimientos, setMovimientos] = useState([]);
  const [resumen, setResumen] = useState({});
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loadingTasa, setLoadingTasa] = useState(false);
  const [tasaMensaje, setTasaMensaje] = useState('');
  const [filters, setFilters] = useState({ tipo: '', estado: '', buscar: '', desde: '', hasta: '' });

  const montoBsCalculado = useMemo(() => {
    const monto = Number(form.montoUsd || 0);
    const tasa = Number(form.tasaBcv || 0);
    return monto > 0 && tasa > 0 ? monto * tasa : 0;
  }, [form.montoUsd, form.tasaBcv]);

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
  }, []);

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
      fechaVencimiento: form.fechaVencimiento || null,
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
      clienteId: mov.clienteId || '',
      proveedorId: mov.proveedorId || '',
      referencia: mov.referencia || '',
    });
    setTasaMensaje(tasaFuenteLabel[mov.tasaFuente] || (mov.tasaBcv ? 'Tasa guardada en el movimiento.' : ''));
  };

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

      {mensaje && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm">{mensaje}</div>}

      <section className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
        <form onSubmit={guardarMovimiento} className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
              </select>
            </Field>
            <Field label="Proveedor ID">
              <input value={form.proveedorId} onChange={(e) => updateForm('proveedorId', e.target.value)} className="input" />
            </Field>
            <Field label="Referencia">
              <input value={form.referencia} onChange={(e) => updateForm('referencia', e.target.value)} className="input" />
            </Field>
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
            <table className="w-full min-w-[760px] text-left text-sm">
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
                      <p className="text-xs text-slate-500">{TIPOS.find((t) => t.value === mov.tipo)?.label || mov.tipo}</p>
                    </td>
                    <td className="p-3 text-slate-600">{mov.cliente?.nombre || mov.referencia || mov.proveedorId || '-'}</td>
                    <td className="p-3 whitespace-nowrap"><span className={`rounded-full px-2 py-1 text-xs font-bold ${estadoStyles[mov.estado] || 'bg-slate-100 text-slate-700'}`}>{mov.estado}</span></td>
                    <td className="p-3 text-right">
                      <p className="font-extrabold">{formatUsd(mov.montoUsd)}</p>
                      {mov.montoBs ? <p className="text-xs font-semibold text-slate-500">{formatBs(mov.montoBs)}</p> : null}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => editarMovimiento(mov)} className="text-xs font-bold text-blue-600">Editar</button>
                        {mov.estado !== 'PAGADO' && <button type="button" onClick={() => cambiarEstado(mov, 'PAGADO')} className="text-xs font-bold text-emerald-600">Pagar</button>}
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
