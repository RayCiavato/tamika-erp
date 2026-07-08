"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const emptyCuenta = {
  id: '',
  clienteId: '',
  nombreCuenta: '',
  correoCuenta: '',
  referencia: '',
  tipoServicio: 'SERVICIO_COMPLETO',
  montoMensualUsd: '',
  fechaCorte: '',
  estado: 'ACTIVA',
  observaciones: '',
};

const emptyAntena = {
  id: '',
  clienteId: '',
  cuentaStarlinkId: '',
  numeroKit: '',
  numeroSerie: '',
  nombreAntena: '',
  ubicacion: '',
  fechaRegistro: new Date().toISOString().slice(0, 10),
  fechaCorte: '',
  tipoServicio: 'SERVICIO_COMPLETO',
  estado: 'ACTIVA',
  observaciones: '',
};

const emptyPago = {
  id: '',
  cuentaStarlinkId: '',
  periodo: new Date().toISOString().slice(0, 7),
  montoUsd: '',
  tasaBcv: '',
  fechaPago: '',
  fechaCorte: '',
  estado: 'PENDIENTE',
  referencia: '',
};

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '-');
const toInputDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export default function StarlinkView({ clientes = [], apiFetch = fetch, onChanged }) {
  const [cuentas, setCuentas] = useState([]);
  const [antenas, setAntenas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [cuentaForm, setCuentaForm] = useState(emptyCuenta);
  const [antenaForm, setAntenaForm] = useState(emptyAntena);
  const [pagoForm, setPagoForm] = useState(emptyPago);
  const [tab, setTab] = useState('dashboard');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  const readJson = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallback);
    return data;
  };

  const cargarDatos = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const [cuentasRes, antenasRes, pagosRes, alertasRes] = await Promise.all([
        apiFetch('/api/starlink/cuentas'),
        apiFetch('/api/starlink/antenas'),
        apiFetch('/api/starlink/pagos'),
        apiFetch('/api/starlink/alertas'),
      ]);
      const [cuentasData, antenasData, pagosData, alertasData] = await Promise.all([
        readJson(cuentasRes, 'No se pudieron cargar las cuentas Starlink.'),
        readJson(antenasRes, 'No se pudieron cargar las antenas.'),
        readJson(pagosRes, 'No se pudieron cargar los pagos.'),
        readJson(alertasRes, 'No se pudieron cargar las alertas.'),
      ]);
      setCuentas(Array.isArray(cuentasData) ? cuentasData : []);
      setAntenas(Array.isArray(antenasData) ? antenasData : []);
      setPagos(Array.isArray(pagosData) ? pagosData : []);
      setAlertas(Array.isArray(alertasData.alertas) ? alertasData.alertas : []);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const resumen = useMemo(() => ({
    cuentasActivas: cuentas.filter((cuenta) => cuenta.estado === 'ACTIVA').length,
    antenasActivas: antenas.filter((antena) => antena.estado === 'ACTIVA').length,
    pagosPendientes: pagos.filter((pago) => pago.estado === 'PENDIENTE' || pago.estado === 'VENCIDO').length,
    alertasRojas: alertas.filter((alerta) => alerta.semaforo === 'ROJO').length,
  }), [cuentas, antenas, pagos, alertas]);

  const guardarCuenta = async (event) => {
    event.preventDefault();
    try {
      const res = await apiFetch(cuentaForm.id ? `/api/starlink/cuentas/${cuentaForm.id}` : '/api/starlink/cuentas', {
        method: cuentaForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuentaForm),
      });
      await readJson(res, 'No se pudo guardar la cuenta.');
      setCuentaForm(emptyCuenta);
      await cargarDatos();
      setMensaje('Cuenta Starlink guardada.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const guardarAntena = async (event) => {
    event.preventDefault();
    const cuenta = cuentas.find((item) => item.id === antenaForm.cuentaStarlinkId);
    const payload = {
      ...antenaForm,
      clienteId: antenaForm.clienteId || cuenta?.clienteId || '',
    };
    try {
      const res = await apiFetch(antenaForm.id ? `/api/starlink/antenas/${antenaForm.id}` : '/api/starlink/antenas', {
        method: antenaForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJson(res, 'No se pudo guardar la antena.');
      setAntenaForm(emptyAntena);
      await cargarDatos();
      setMensaje('Antena guardada.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const guardarPago = async (event) => {
    event.preventDefault();
    const cuenta = cuentas.find((item) => item.id === pagoForm.cuentaStarlinkId);
    const payload = {
      ...pagoForm,
      montoUsd: pagoForm.montoUsd || cuenta?.montoMensualUsd || '',
      fechaCorte: pagoForm.fechaCorte || toInputDate(cuenta?.fechaCorte),
    };
    try {
      const res = await apiFetch(pagoForm.id ? `/api/starlink/pagos/${pagoForm.id}` : '/api/starlink/pagos', {
        method: pagoForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJson(res, 'No se pudo guardar el pago.');
      setPagoForm(emptyPago);
      await cargarDatos();
      onChanged?.();
      setMensaje('Pago Starlink guardado e integrado con contabilidad.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const desactivar = async (endpoint, label) => {
    if (!confirm(`Desactivar/anular ${label}?`)) return;
    try {
      const res = await apiFetch(endpoint, { method: 'DELETE' });
      await readJson(res, 'No se pudo completar la accion.');
      await cargarDatos();
      onChanged?.();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const cuentaOptions = cuentas.map((cuenta) => (
    <option key={cuenta.id} value={cuenta.id}>{cuenta.nombreCuenta} - {cuenta.cliente?.nombre || 'Sin cliente'}</option>
  ));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950">Starlink</h2>
          <p className="text-sm text-slate-500">Cuentas, antenas, pagos mensuales y alertas de corte.</p>
        </div>
        <button onClick={cargarDatos} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Actualizar</button>
      </div>

      {mensaje && <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 shadow-sm">{mensaje}</div>}
      {loading && <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700">Cargando Starlink...</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Cuentas activas" value={resumen.cuentasActivas} tone="emerald" />
        <Metric title="Antenas activas" value={resumen.antenasActivas} tone="blue" />
        <Metric title="Pagos pendientes" value={resumen.pagosPendientes} tone="amber" />
        <Metric title="Alertas rojas" value={resumen.alertasRojas} tone="red" />
      </div>

      <div className="flex flex-wrap gap-2">
        {['dashboard', 'cuentas', 'antenas', 'pagos'].map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-4 py-2 text-sm font-bold capitalize ${tab === item ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{item}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold text-slate-950">Alertas de corte</h3>
            <div className="space-y-3">
              {alertas.length === 0 && <p className="text-sm text-slate-500">No hay alertas pendientes.</p>}
              {alertas.map((alerta) => <AlertaCard key={alerta.cuentaId} alerta={alerta} />)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold text-slate-950">Cuentas recientes</h3>
            <div className="space-y-3">
              {cuentas.slice(0, 5).map((cuenta) => (
                <div key={cuenta.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-bold">{cuenta.nombreCuenta}</p>
                  <p className="text-sm text-slate-500">{cuenta.cliente?.nombre || '-'} · {cuenta.antenas?.length || 0} antenas</p>
                  <p className="text-xs text-slate-500">Corte: {formatDate(cuenta.fechaCorte)} · {formatUsd(cuenta.montoMensualUsd)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'cuentas' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <PanelForm title={cuentaForm.id ? 'Editar cuenta' : 'Nueva cuenta Starlink'} onSubmit={guardarCuenta}>
            <Field label="Cliente">
              <select required value={cuentaForm.clienteId} onChange={(e) => setCuentaForm((prev) => ({ ...prev, clienteId: e.target.value }))} className="input">
                <option value="">Selecciona cliente</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.codigoCliente ? `${cliente.codigoCliente} - ` : ''}{cliente.nombre}</option>)}
              </select>
            </Field>
            <Field label="Nombre cuenta"><input required value={cuentaForm.nombreCuenta} onChange={(e) => setCuentaForm((prev) => ({ ...prev, nombreCuenta: e.target.value }))} className="input" /></Field>
            <Field label="Correo cuenta"><input type="email" value={cuentaForm.correoCuenta} onChange={(e) => setCuentaForm((prev) => ({ ...prev, correoCuenta: e.target.value }))} className="input" /></Field>
            <Field label="Tipo de servicio">
              <select value={cuentaForm.tipoServicio} onChange={(e) => setCuentaForm((prev) => ({ ...prev, tipoServicio: e.target.value }))} className="input">
                <option value="SERVICIO_COMPLETO">Servicio completo</option>
                <option value="SOLO_ANTENAS">Solo antenas</option>
              </select>
            </Field>
            <Field label="Monto mensual USD"><input type="number" min="0" step="0.01" value={cuentaForm.montoMensualUsd} onChange={(e) => setCuentaForm((prev) => ({ ...prev, montoMensualUsd: e.target.value }))} className="input" /></Field>
            <Field label="Fecha de corte"><input type="date" value={cuentaForm.fechaCorte} onChange={(e) => setCuentaForm((prev) => ({ ...prev, fechaCorte: e.target.value }))} className="input" /></Field>
            <Field label="Referencia"><input value={cuentaForm.referencia} onChange={(e) => setCuentaForm((prev) => ({ ...prev, referencia: e.target.value }))} className="input" /></Field>
            <Field label="Observaciones"><textarea value={cuentaForm.observaciones} onChange={(e) => setCuentaForm((prev) => ({ ...prev, observaciones: e.target.value }))} rows={3} className="input resize-y" /></Field>
          </PanelForm>
          <DataTable headers={['Cuenta', 'Cliente', 'Antenas', 'Corte', 'Monto', 'Acciones']}>
            {cuentas.map((cuenta) => (
              <tr key={cuenta.id} className="border-b last:border-b-0">
                <td className="p-3 font-bold">{cuenta.nombreCuenta}<p className="text-xs text-slate-500">{cuenta.correoCuenta || '-'}</p></td>
                <td className="p-3">{cuenta.cliente?.nombre || '-'}</td>
                <td className="p-3">{cuenta.antenas?.length || 0}</td>
                <td className="p-3">{formatDate(cuenta.fechaCorte)}</td>
                <td className="p-3 font-bold">{formatUsd(cuenta.montoMensualUsd)}</td>
                <td className="p-3 text-right"><Actions onEdit={() => setCuentaForm({ ...emptyCuenta, ...cuenta, fechaCorte: toInputDate(cuenta.fechaCorte), montoMensualUsd: cuenta.montoMensualUsd?.toString() || '' })} onDelete={() => desactivar(`/api/starlink/cuentas/${cuenta.id}`, cuenta.nombreCuenta)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {tab === 'antenas' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <PanelForm title={antenaForm.id ? 'Editar antena' : 'Agregar antena'} onSubmit={guardarAntena}>
            <Field label="Cuenta Starlink">
              <select value={antenaForm.cuentaStarlinkId} onChange={(e) => {
                const cuenta = cuentas.find((item) => item.id === e.target.value);
                setAntenaForm((prev) => ({ ...prev, cuentaStarlinkId: e.target.value, clienteId: cuenta?.clienteId || prev.clienteId, tipoServicio: cuenta?.tipoServicio || prev.tipoServicio, fechaCorte: toInputDate(cuenta?.fechaCorte) || prev.fechaCorte }));
              }} className="input">
                <option value="">Sin cuenta</option>
                {cuentaOptions}
              </select>
            </Field>
            <Field label="Cliente">
              <select required value={antenaForm.clienteId} onChange={(e) => setAntenaForm((prev) => ({ ...prev, clienteId: e.target.value }))} className="input">
                <option value="">Selecciona cliente</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
              </select>
            </Field>
            <Field label="Nombre antena"><input required value={antenaForm.nombreAntena} onChange={(e) => setAntenaForm((prev) => ({ ...prev, nombreAntena: e.target.value }))} className="input" /></Field>
            <Field label="Número kit"><input value={antenaForm.numeroKit} onChange={(e) => setAntenaForm((prev) => ({ ...prev, numeroKit: e.target.value }))} className="input" /></Field>
            <Field label="Número serie"><input value={antenaForm.numeroSerie} onChange={(e) => setAntenaForm((prev) => ({ ...prev, numeroSerie: e.target.value }))} className="input" /></Field>
            <Field label="Ubicación"><input value={antenaForm.ubicacion} onChange={(e) => setAntenaForm((prev) => ({ ...prev, ubicacion: e.target.value }))} className="input" /></Field>
            <Field label="Fecha corte"><input type="date" value={antenaForm.fechaCorte} onChange={(e) => setAntenaForm((prev) => ({ ...prev, fechaCorte: e.target.value }))} className="input" /></Field>
            <Field label="Observaciones"><textarea value={antenaForm.observaciones} onChange={(e) => setAntenaForm((prev) => ({ ...prev, observaciones: e.target.value }))} rows={3} className="input resize-y" /></Field>
          </PanelForm>
          <DataTable headers={['Antena', 'Cliente', 'Cuenta', 'Kit', 'Corte', 'Acciones']}>
            {antenas.map((antena) => (
              <tr key={antena.id} className="border-b last:border-b-0">
                <td className="p-3 font-bold">{antena.nombreAntena}<p className="text-xs text-slate-500">{antena.ubicacion || '-'}</p></td>
                <td className="p-3">{antena.cliente?.nombre || '-'}</td>
                <td className="p-3">{antena.cuentaStarlink?.nombreCuenta || '-'}</td>
                <td className="p-3 font-mono text-xs">{antena.numeroKit || '-'}</td>
                <td className="p-3">{formatDate(antena.fechaCorte)}</td>
                <td className="p-3 text-right"><Actions onEdit={() => setAntenaForm({ ...emptyAntena, ...antena, fechaRegistro: toInputDate(antena.fechaRegistro), fechaCorte: toInputDate(antena.fechaCorte) })} onDelete={() => desactivar(`/api/starlink/antenas/${antena.id}`, antena.nombreAntena)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {tab === 'pagos' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <PanelForm title={pagoForm.id ? 'Editar pago' : 'Registrar pago mensual'} onSubmit={guardarPago}>
            <Field label="Cuenta Starlink">
              <select required value={pagoForm.cuentaStarlinkId} onChange={(e) => {
                const cuenta = cuentas.find((item) => item.id === e.target.value);
                setPagoForm((prev) => ({ ...prev, cuentaStarlinkId: e.target.value, montoUsd: cuenta?.montoMensualUsd?.toString() || prev.montoUsd, fechaCorte: toInputDate(cuenta?.fechaCorte) || prev.fechaCorte }));
              }} className="input">
                <option value="">Selecciona cuenta</option>
                {cuentaOptions}
              </select>
            </Field>
            <Field label="Periodo"><input type="month" value={pagoForm.periodo} onChange={(e) => setPagoForm((prev) => ({ ...prev, periodo: e.target.value }))} className="input" /></Field>
            <Field label="Monto USD"><input type="number" min="0" step="0.01" value={pagoForm.montoUsd} onChange={(e) => setPagoForm((prev) => ({ ...prev, montoUsd: e.target.value }))} className="input" /></Field>
            <Field label="Tasa BCV"><input type="number" min="0" step="0.01" value={pagoForm.tasaBcv} onChange={(e) => setPagoForm((prev) => ({ ...prev, tasaBcv: e.target.value }))} className="input" /></Field>
            <Field label="Fecha pago"><input type="date" value={pagoForm.fechaPago} onChange={(e) => setPagoForm((prev) => ({ ...prev, fechaPago: e.target.value }))} className="input" /></Field>
            <Field label="Fecha corte"><input required type="date" value={pagoForm.fechaCorte} onChange={(e) => setPagoForm((prev) => ({ ...prev, fechaCorte: e.target.value }))} className="input" /></Field>
            <Field label="Estado">
              <select value={pagoForm.estado} onChange={(e) => setPagoForm((prev) => ({ ...prev, estado: e.target.value }))} className="input">
                {['PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO'].map((estado) => <option key={estado}>{estado}</option>)}
              </select>
            </Field>
            <Field label="Referencia"><input value={pagoForm.referencia} onChange={(e) => setPagoForm((prev) => ({ ...prev, referencia: e.target.value }))} className="input" /></Field>
          </PanelForm>
          <DataTable headers={['Periodo', 'Cuenta', 'Estado', 'Monto', 'Corte', 'Acciones']}>
            {pagos.map((pago) => (
              <tr key={pago.id} className="border-b last:border-b-0">
                <td className="p-3 font-bold">{pago.periodo}</td>
                <td className="p-3">{pago.cuentaStarlink?.nombreCuenta || '-'}</td>
                <td className="p-3"><Estado estado={pago.estado} /></td>
                <td className="p-3 font-bold">{formatUsd(pago.montoUsd)}</td>
                <td className="p-3">{formatDate(pago.fechaCorte)}</td>
                <td className="p-3 text-right"><Actions onEdit={() => setPagoForm({ ...emptyPago, ...pago, fechaPago: toInputDate(pago.fechaPago), fechaCorte: toInputDate(pago.fechaCorte), montoUsd: pago.montoUsd?.toString() || '', tasaBcv: pago.tasaBcv?.toString() || '' })} onDelete={() => desactivar(`/api/starlink/pagos/${pago.id}`, pago.periodo)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </section>
  );
}

function Metric({ title, value, tone }) {
  const colors = {
    emerald: 'border-emerald-200 text-emerald-700',
    blue: 'border-blue-200 text-blue-700',
    amber: 'border-amber-200 text-amber-700',
    red: 'border-red-200 text-red-700',
  };
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${colors[tone] || colors.blue}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function AlertaCard({ alerta }) {
  const color = alerta.semaforo === 'ROJO' ? 'border-red-200 bg-red-50 text-red-800' : alerta.semaforo === 'AMARILLO' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-extrabold">{alerta.nombreCuenta}</p>
          <p className="text-sm">{alerta.cliente?.nombre || '-'} · {alerta.cantidadAntenas} antenas</p>
        </div>
        <div className="text-sm font-bold md:text-right">
          <p>{alerta.diasRestantes < 0 ? `${Math.abs(alerta.diasRestantes)} días vencido` : `${alerta.diasRestantes} días restantes`}</p>
          <p>{formatDate(alerta.fechaCorte)} · {formatUsd(alerta.montoMensualUsd)}</p>
        </div>
      </div>
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
    VENCIDO: 'bg-red-100 text-red-800',
    ANULADO: 'bg-slate-200 text-slate-700',
  };
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${styles[estado] || styles.PENDIENTE}`}>{estado}</span>;
}

function Actions({ onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onEdit} className="text-xs font-bold text-blue-600">Editar</button>
      <button type="button" onClick={onDelete} className="text-xs font-bold text-red-600">Desactivar</button>
    </div>
  );
}
