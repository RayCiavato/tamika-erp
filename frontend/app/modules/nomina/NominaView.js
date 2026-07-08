"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const emptyEmpleado = {
  id: '',
  codigoEmpleado: '',
  nombre: '',
  apellido: '',
  cedula: '',
  cargo: '',
  telefono: '',
  email: '',
  fechaIngreso: '',
  salarioBaseUsd: '',
  activo: true,
};

const emptyNomina = {
  id: '',
  empleadoId: '',
  periodo: new Date().toISOString().slice(0, 7),
  salarioBaseUsd: '',
  bonosUsd: '0',
  deduccionesUsd: '0',
  tasaBcv: '',
  fechaPago: '',
  estado: 'PENDIENTE',
  referencia: '',
};

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const formatBs = (value) => currency(value || 0, { symbol: 'Bs ', separator: '.', decimal: ',' }).format();
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '-');
const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export default function NominaView({ apiFetch = fetch, onChanged }) {
  const [empleados, setEmpleados] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [empleadoForm, setEmpleadoForm] = useState(emptyEmpleado);
  const [nominaForm, setNominaForm] = useState(emptyNomina);
  const [tab, setTab] = useState('nomina');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState('');

  const readJson = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallback);
    return data;
  };

  const cargarDatos = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const params = new URLSearchParams();
      if (filtroPeriodo) params.set('periodo', filtroPeriodo);
      const [empleadosRes, nominaRes] = await Promise.all([
        apiFetch('/api/empleados'),
        apiFetch(`/api/nomina?${params.toString()}`),
      ]);
      const [empleadosData, nominaData] = await Promise.all([
        readJson(empleadosRes, 'No se pudieron cargar los empleados.'),
        readJson(nominaRes, 'No se pudo cargar la nomina.'),
      ]);
      setEmpleados(Array.isArray(empleadosData) ? empleadosData : []);
      setNominas(Array.isArray(nominaData) ? nominaData : []);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [filtroPeriodo]);

  const totalNomina = useMemo(() => nominas.reduce((acc, item) => acc + Number(item.totalUsd || 0), 0), [nominas]);
  const totalPendiente = useMemo(() => nominas.filter((item) => item.estado === 'PENDIENTE').reduce((acc, item) => acc + Number(item.totalUsd || 0), 0), [nominas]);
  const totalPagado = useMemo(() => nominas.filter((item) => item.estado === 'PAGADO').reduce((acc, item) => acc + Number(item.totalUsd || 0), 0), [nominas]);

  const totalForm = useMemo(() => {
    const salario = Number(nominaForm.salarioBaseUsd || 0);
    const bonos = Number(nominaForm.bonosUsd || 0);
    const deducciones = Number(nominaForm.deduccionesUsd || 0);
    return salario + bonos - deducciones;
  }, [nominaForm.salarioBaseUsd, nominaForm.bonosUsd, nominaForm.deduccionesUsd]);

  const seleccionarEmpleadoNomina = (empleadoId) => {
    const empleado = empleados.find((item) => item.id === empleadoId);
    setNominaForm((prev) => ({
      ...prev,
      empleadoId,
      salarioBaseUsd: empleado?.salarioBaseUsd?.toString() || prev.salarioBaseUsd,
    }));
  };

  const guardarEmpleado = async (event) => {
    event.preventDefault();
    try {
      const res = await apiFetch(empleadoForm.id ? `/api/empleados/${empleadoForm.id}` : '/api/empleados', {
        method: empleadoForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empleadoForm),
      });
      await readJson(res, 'No se pudo guardar el empleado.');
      setEmpleadoForm(emptyEmpleado);
      await cargarDatos();
      setMensaje('Empleado guardado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const guardarNomina = async (event) => {
    event.preventDefault();
    try {
      const res = await apiFetch(nominaForm.id ? `/api/nomina/${nominaForm.id}` : '/api/nomina', {
        method: nominaForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nominaForm),
      });
      await readJson(res, 'No se pudo guardar la nomina.');
      setNominaForm(emptyNomina);
      await cargarDatos();
      onChanged?.();
      setMensaje('Nomina guardada e integrada con contabilidad.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const autoCodigoEmpleado = async () => {
    try {
      const res = await apiFetch('/api/empleados/siguiente-codigo');
      const data = await readJson(res, 'No se pudo generar el codigo de empleado.');
      setEmpleadoForm((prev) => ({ ...prev, codigoEmpleado: data.codigoEmpleado || '' }));
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const anular = async (endpoint, label) => {
    if (!confirm(`Anular/desactivar ${label}?`)) return;
    try {
      const res = await apiFetch(endpoint, { method: 'DELETE' });
      await readJson(res, 'No se pudo completar la accion.');
      await cargarDatos();
      onChanged?.();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950">Nómina</h2>
          <p className="text-sm text-slate-500">Gestión de empleados y pagos integrados a contabilidad.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="month" value={filtroPeriodo} onChange={(e) => setFiltroPeriodo(e.target.value)} className="input" />
          <button onClick={cargarDatos} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Actualizar</button>
        </div>
      </div>

      {mensaje && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 shadow-sm">{mensaje}</div>}
      {loading && <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700">Cargando nómina...</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Empleados activos" value={empleados.filter((item) => item.activo).length} />
        <Metric title="Total periodo" value={formatUsd(totalNomina)} tone="slate" />
        <Metric title="Pagado" value={formatUsd(totalPagado)} tone="emerald" />
        <Metric title="Pendiente" value={formatUsd(totalPendiente)} tone="amber" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('nomina')} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === 'nomina' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Pagos de nómina</button>
        <button onClick={() => setTab('empleados')} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === 'empleados' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>Empleados</button>
      </div>

      {tab === 'nomina' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <PanelForm title={nominaForm.id ? 'Editar pago de nómina' : 'Registrar nómina'} onSubmit={guardarNomina}>
            <Field label="Empleado">
              <select required value={nominaForm.empleadoId} onChange={(e) => seleccionarEmpleadoNomina(e.target.value)} className="input">
                <option value="">Selecciona empleado</option>
                {empleados.filter((empleado) => empleado.activo).map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>{empleado.codigoEmpleado ? `${empleado.codigoEmpleado} - ` : ''}{empleado.nombre} {empleado.apellido || ''}</option>
                ))}
              </select>
            </Field>
            <Field label="Periodo"><input type="month" value={nominaForm.periodo} onChange={(e) => setNominaForm((prev) => ({ ...prev, periodo: e.target.value }))} className="input" /></Field>
            <Field label="Salario base USD"><input type="number" min="0" step="0.01" value={nominaForm.salarioBaseUsd} onChange={(e) => setNominaForm((prev) => ({ ...prev, salarioBaseUsd: e.target.value }))} className="input" /></Field>
            <Field label="Bonos USD"><input type="number" min="0" step="0.01" value={nominaForm.bonosUsd} onChange={(e) => setNominaForm((prev) => ({ ...prev, bonosUsd: e.target.value }))} className="input" /></Field>
            <Field label="Deducciones USD"><input type="number" min="0" step="0.01" value={nominaForm.deduccionesUsd} onChange={(e) => setNominaForm((prev) => ({ ...prev, deduccionesUsd: e.target.value }))} className="input" /></Field>
            <Field label="Tasa BCV"><input type="number" min="0" step="0.01" value={nominaForm.tasaBcv} onChange={(e) => setNominaForm((prev) => ({ ...prev, tasaBcv: e.target.value }))} className="input" /></Field>
            <Field label="Fecha pago"><input type="date" value={nominaForm.fechaPago} onChange={(e) => setNominaForm((prev) => ({ ...prev, fechaPago: e.target.value }))} className="input" /></Field>
            <Field label="Estado">
              <select value={nominaForm.estado} onChange={(e) => setNominaForm((prev) => ({ ...prev, estado: e.target.value }))} className="input">
                {['PENDIENTE', 'PAGADO', 'ANULADO'].map((estado) => <option key={estado}>{estado}</option>)}
              </select>
            </Field>
            <Field label="Referencia"><input value={nominaForm.referencia} onChange={(e) => setNominaForm((prev) => ({ ...prev, referencia: e.target.value }))} className="input" /></Field>
            <div className="rounded-lg bg-slate-900 p-3 text-sm font-bold text-white">
              Total USD: <span className="text-emerald-300">{formatUsd(totalForm)}</span>
              {Number(nominaForm.tasaBcv || 0) > 0 && <p className="text-xs text-slate-300">Total Bs: {formatBs(totalForm * Number(nominaForm.tasaBcv))}</p>}
            </div>
          </PanelForm>

          <DataTable headers={['Periodo', 'Empleado', 'Estado', 'Total', 'Fecha pago', 'Acciones']}>
            {nominas.map((nomina) => (
              <tr key={nomina.id} className="border-b last:border-b-0">
                <td className="p-3 font-bold">{nomina.periodo}</td>
                <td className="p-3">{nomina.empleado?.nombre} {nomina.empleado?.apellido || ''}<p className="text-xs text-slate-500">{nomina.empleado?.codigoEmpleado || '-'}</p></td>
                <td className="p-3"><Estado estado={nomina.estado} /></td>
                <td className="p-3 font-bold">{formatUsd(nomina.totalUsd)}{nomina.totalBs ? <p className="text-xs text-slate-500">{formatBs(nomina.totalBs)}</p> : null}</td>
                <td className="p-3">{formatDate(nomina.fechaPago)}</td>
                <td className="p-3 text-right"><Actions onEdit={() => setNominaForm({ ...emptyNomina, ...nomina, fechaPago: toInputDate(nomina.fechaPago), salarioBaseUsd: nomina.salarioBaseUsd?.toString() || '', bonosUsd: nomina.bonosUsd?.toString() || '0', deduccionesUsd: nomina.deduccionesUsd?.toString() || '0', tasaBcv: nomina.tasaBcv?.toString() || '' })} onDelete={() => anular(`/api/nomina/${nomina.id}`, nomina.periodo)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {tab === 'empleados' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <PanelForm title={empleadoForm.id ? 'Editar empleado' : 'Crear empleado'} onSubmit={guardarEmpleado}>
            <Field label="Código empleado">
              <div className="flex gap-2">
                <input value={empleadoForm.codigoEmpleado} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, codigoEmpleado: e.target.value }))} className="input font-mono" />
                <button type="button" onClick={autoCodigoEmpleado} className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">Auto</button>
              </div>
            </Field>
            <Field label="Nombre"><input required value={empleadoForm.nombre} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, nombre: e.target.value }))} className="input" /></Field>
            <Field label="Apellido"><input value={empleadoForm.apellido} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, apellido: e.target.value }))} className="input" /></Field>
            <Field label="Cédula"><input value={empleadoForm.cedula} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, cedula: e.target.value }))} className="input" /></Field>
            <Field label="Cargo"><input value={empleadoForm.cargo} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, cargo: e.target.value }))} className="input" /></Field>
            <Field label="Salario base USD"><input type="number" min="0" step="0.01" value={empleadoForm.salarioBaseUsd} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, salarioBaseUsd: e.target.value }))} className="input" /></Field>
            <Field label="Teléfono"><input value={empleadoForm.telefono} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, telefono: e.target.value }))} className="input" /></Field>
            <Field label="Email"><input type="email" value={empleadoForm.email} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, email: e.target.value }))} className="input" /></Field>
            <Field label="Fecha ingreso"><input type="date" value={empleadoForm.fechaIngreso} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, fechaIngreso: e.target.value }))} className="input" /></Field>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={empleadoForm.activo} onChange={(e) => setEmpleadoForm((prev) => ({ ...prev, activo: e.target.checked }))} className="h-4 w-4 accent-emerald-600" />Activo</label>
          </PanelForm>

          <DataTable headers={['Código', 'Empleado', 'Cargo', 'Contacto', 'Salario', 'Acciones']}>
            {empleados.map((empleado) => (
              <tr key={empleado.id} className="border-b last:border-b-0">
                <td className="p-3 font-mono text-xs font-bold text-slate-600">{empleado.codigoEmpleado || '-'}</td>
                <td className="p-3 font-bold">{empleado.nombre} {empleado.apellido || ''}<p className="text-xs text-slate-500">{empleado.cedula || '-'}</p></td>
                <td className="p-3">{empleado.cargo || '-'}</td>
                <td className="p-3">{empleado.telefono || '-'}<p className="text-xs text-slate-500">{empleado.email || ''}</p></td>
                <td className="p-3 font-bold">{formatUsd(empleado.salarioBaseUsd)}</td>
                <td className="p-3 text-right"><Actions onEdit={() => setEmpleadoForm({ ...emptyEmpleado, ...empleado, fechaIngreso: toInputDate(empleado.fechaIngreso), salarioBaseUsd: empleado.salarioBaseUsd?.toString() || '' })} onDelete={() => anular(`/api/empleados/${empleado.id}`, empleado.nombre)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </section>
  );
}

function Metric({ title, value, tone = 'blue' }) {
  const colors = {
    blue: 'border-blue-200 text-blue-700',
    slate: 'border-slate-200 text-slate-950',
    emerald: 'border-emerald-200 text-emerald-700',
    amber: 'border-amber-200 text-amber-700',
  };
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${colors[tone] || colors.blue}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function PanelForm({ title, onSubmit, children }) {
  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-bold text-slate-950">{title}</h3>
      <div className="grid grid-cols-1 gap-3">{children}</div>
      <button className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-emerald-500">Guardar</button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="text-xs font-bold text-slate-500">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function DataTable({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Estado({ estado }) {
  const styles = {
    PENDIENTE: 'bg-amber-100 text-amber-800',
    PAGADO: 'bg-emerald-100 text-emerald-800',
    ANULADO: 'bg-slate-200 text-slate-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${styles[estado] || styles.PENDIENTE}`}>{estado}</span>;
}

function Actions({ onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onEdit} className="text-xs font-bold text-blue-600">Editar</button>
      <button type="button" onClick={onDelete} className="text-xs font-bold text-red-600">Anular</button>
    </div>
  );
}
