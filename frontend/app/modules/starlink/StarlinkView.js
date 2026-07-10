"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-VE', { timeZone: 'UTC' });
};
const toInputDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};
const currentMonth = () => new Date().toISOString().slice(0, 7);
const emptyPagoForm = () => ({
  id: '',
  periodo: currentMonth(),
  montoUsd: '',
  tasaBcv: '',
  fechaPago: '',
  fechaCorte: '',
  estado: 'PENDIENTE',
  referencia: '',
});

const statusTone = (diasRestantes) => {
  const days = Number(diasRestantes);
  if (days <= 10) return 'border-red-400 bg-red-100 text-red-950 shadow-sm';
  if (days <= 20) return 'border-amber-400 bg-amber-100 text-amber-950 shadow-sm';
  return 'border-emerald-400 bg-emerald-100 text-emerald-950 shadow-sm';
};

const dayLabel = (diasRestantes) => {
  const days = Number(diasRestantes);
  if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
};

export default function StarlinkView({ apiFetch = fetch, clientes = [], onChanged }) {
  const [cuentas, setCuentas] = useState([]);
  const [antenas, setAntenas] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [correoFiltro, setCorreoFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [clientBarOpen, setClientBarOpen] = useState(true);
  const [emailBarOpen, setEmailBarOpen] = useState(true);
  const [selectedAntenaId, setSelectedAntenaId] = useState('');
  const [pagos, setPagos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [cuentaForm, setCuentaForm] = useState({
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
  });
  const [antenaForm, setAntenaForm] = useState({
    id: '',
    clienteId: '',
    cuentaStarlinkId: '',
    nombreAntena: '',
    numeroKit: '',
    numeroSerie: '',
    ubicacion: '',
    fechaRegistro: '',
    fechaCorte: '',
    tipoServicio: 'SERVICIO_COMPLETO',
    estado: 'ACTIVA',
    observaciones: '',
  });
  const [pagoForm, setPagoForm] = useState(emptyPagoForm);

  const clientesById = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes]);
  const cuentasById = useMemo(() => new Map(cuentas.map((cuenta) => [cuenta.id, cuenta])), [cuentas]);

  const cargarStarlink = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const [cuentasRes, antenasRes, alertasRes, pagosRes] = await Promise.all([
        apiFetch('/api/starlink/cuentas'),
        apiFetch('/api/starlink/antenas'),
        apiFetch('/api/starlink/alertas'),
        apiFetch('/api/starlink/pagos'),
      ]);
      const [cuentasData, antenasData, alertasData, pagosData] = await Promise.all([
        cuentasRes.json().catch(() => []),
        antenasRes.json().catch(() => []),
        alertasRes.json().catch(() => ({ alertas: [] })),
        pagosRes.json().catch(() => []),
      ]);
      setCuentas(Array.isArray(cuentasData) ? cuentasData : []);
      setAntenas(Array.isArray(antenasData) ? antenasData : []);
      setAlertas(Array.isArray(alertasData?.alertas) ? alertasData.alertas : []);
      setPagos(Array.isArray(pagosData) ? pagosData : []);
      onChanged?.();
    } catch (error) {
      setMensaje(error.message || 'No se pudo cargar Starlink.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarStarlink();
  }, []);

  const clientesConStarlink = useMemo(() => {
    const ids = new Set([
      ...cuentas.map((cuenta) => cuenta.clienteId).filter(Boolean),
      ...antenas.map((antena) => antena.clienteId).filter(Boolean),
    ]);
    return clientes.filter((cliente) => ids.has(cliente.id));
  }, [antenas, clientes, cuentas]);

  const correos = useMemo(() => (
    Array.from(new Set(
      cuentas
        .map((cuenta) => cuenta.correoCuenta)
        .filter(Boolean)
        .map((correo) => correo.trim()),
    )).sort((a, b) => a.localeCompare(b))
  ), [cuentas]);

  const antenasEnriquecidas = useMemo(() => (
    antenas.map((antena) => {
      const cuenta = antena.cuentaStarlink || cuentasById.get(antena.cuentaStarlinkId);
      const cliente = antena.cliente || clientesById.get(antena.clienteId) || clientesById.get(cuenta?.clienteId);
      return { ...antena, cuenta, cliente };
    })
  ), [antenas, clientesById, cuentasById]);

  const antenasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return antenasEnriquecidas.filter((antena) => {
      const correo = antena.cuenta?.correoCuenta || '';
      if (clienteFiltro && antena.clienteId !== clienteFiltro && antena.cuenta?.clienteId !== clienteFiltro) return false;
      if (correoFiltro && correo.toLowerCase() !== correoFiltro.toLowerCase()) return false;
      if (!term) return true;
      return [
        antena.nombreAntena,
        antena.numeroKit,
        antena.numeroSerie,
        antena.ubicacion,
        correo,
        antena.cuenta?.nombreCuenta,
        antena.cliente?.nombre,
        antena.cliente?.codigoCliente,
        antena.cliente?.rif,
      ].filter(Boolean).some((value) => value.toString().toLowerCase().includes(term));
    });
  }, [antenasEnriquecidas, busqueda, clienteFiltro, correoFiltro]);

  const selectedAntena = antenasFiltradas.find((antena) => antena.id === selectedAntenaId) || antenasFiltradas[0];
  const selectedCuenta = selectedAntena?.cuenta;
  const pagosCuenta = useMemo(() => (
    selectedCuenta?.id
      ? pagos
        .filter((pago) => pago.cuentaStarlinkId === selectedCuenta.id)
        .sort((a, b) => new Date(b.fechaCorte || b.createdAt || 0) - new Date(a.fechaCorte || a.createdAt || 0))
      : []
  ), [pagos, selectedCuenta?.id]);
  const alertasOrdenadas = [...alertas].sort((a, b) => Number(a.diasRestantes) - Number(b.diasRestantes));
  const alertasCriticas = alertasOrdenadas.filter((alerta) => Number(alerta.diasRestantes) <= 10);
  const alertasAdvertencia = alertasOrdenadas.filter((alerta) => Number(alerta.diasRestantes) > 10 && Number(alerta.diasRestantes) <= 20);
  const alertasVerdes = alertasOrdenadas.filter((alerta) => Number(alerta.diasRestantes) > 20);
  const alertasOperativas = [...alertasCriticas, ...alertasAdvertencia];
  const alertasVencidas = alertasCriticas.filter((alerta) => Number(alerta.diasRestantes) < 0);

  useEffect(() => {
    if (!selectedAntena) {
      setAntenaForm((prev) => ({ ...prev, id: '' }));
      setCuentaForm((prev) => ({ ...prev, id: '' }));
      setPagoForm(emptyPagoForm());
      return;
    }

    const cuenta = selectedAntena.cuenta;
    setAntenaForm({
      id: selectedAntena.id,
      clienteId: selectedAntena.clienteId || cuenta?.clienteId || '',
      cuentaStarlinkId: selectedAntena.cuentaStarlinkId || cuenta?.id || '',
      nombreAntena: selectedAntena.nombreAntena || '',
      numeroKit: selectedAntena.numeroKit || '',
      numeroSerie: selectedAntena.numeroSerie || '',
      ubicacion: selectedAntena.ubicacion || '',
      fechaRegistro: toInputDate(selectedAntena.fechaRegistro),
      fechaCorte: toInputDate(selectedAntena.fechaCorte || cuenta?.fechaCorte),
      tipoServicio: selectedAntena.tipoServicio || cuenta?.tipoServicio || 'SERVICIO_COMPLETO',
      estado: selectedAntena.estado || 'ACTIVA',
      observaciones: selectedAntena.observaciones || '',
    });

    setCuentaForm({
      id: cuenta?.id || '',
      clienteId: cuenta?.clienteId || selectedAntena.clienteId || '',
      nombreCuenta: cuenta?.nombreCuenta || '',
      correoCuenta: cuenta?.correoCuenta || '',
      referencia: cuenta?.referencia || '',
      tipoServicio: cuenta?.tipoServicio || selectedAntena.tipoServicio || 'SERVICIO_COMPLETO',
      montoMensualUsd: cuenta?.montoMensualUsd?.toString() || '',
      fechaCorte: toInputDate(cuenta?.fechaCorte || selectedAntena.fechaCorte),
      estado: cuenta?.estado || 'ACTIVA',
      observaciones: cuenta?.observaciones || '',
    });

    const ultimoPago = pagosCuenta[0];
    setPagoForm(ultimoPago ? {
      id: ultimoPago.id,
      periodo: ultimoPago.periodo || currentMonth(),
      montoUsd: ultimoPago.montoUsd?.toString() || '',
      tasaBcv: ultimoPago.tasaBcv?.toString() || '',
      fechaPago: toInputDate(ultimoPago.fechaPago),
      fechaCorte: toInputDate(ultimoPago.fechaCorte),
      estado: ultimoPago.estado || 'PENDIENTE',
      referencia: ultimoPago.referencia || '',
    } : {
      ...emptyPagoForm(),
      montoUsd: cuenta?.montoMensualUsd?.toString() || '',
      fechaCorte: toInputDate(cuenta?.fechaCorte || selectedAntena.fechaCorte),
    });
  }, [selectedAntena?.id, selectedCuenta?.id, pagosCuenta.length]);

  const readJson = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallback);
    return data;
  };

  const guardarCuenta = async () => {
    if (!cuentaForm.id) return setMensaje('Selecciona una cuenta Starlink valida.');
    setSaving(true);
    setMensaje('');
    try {
      const res = await apiFetch(`/api/starlink/cuentas/${cuentaForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuentaForm),
      });
      await readJson(res, 'No se pudo actualizar la cuenta Starlink.');
      setMensaje('Cuenta/correo Starlink actualizado.');
      await cargarStarlink();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  const guardarAntena = async () => {
    if (!antenaForm.id) return setMensaje('Selecciona una antena Starlink valida.');
    if (!antenaForm.numeroSerie.trim()) return setMensaje('El S/N de la antena es obligatorio.');
    setSaving(true);
    setMensaje('');
    try {
      const res = await apiFetch(`/api/starlink/antenas/${antenaForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(antenaForm),
      });
      await readJson(res, 'No se pudo actualizar la antena Starlink.');
      setMensaje('Antena Starlink actualizada.');
      await cargarStarlink();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstadoAntena = async () => {
    if (!selectedAntena?.id) return;
    const activar = selectedAntena.estado !== 'ACTIVA';
    if (!confirm(`¿Deseas ${activar ? 'activar' : 'desactivar'} la antena ${selectedAntena.nombreAntena}?`)) return;
    setSaving(true);
    setMensaje('');
    try {
      const res = await apiFetch(`/api/starlink/antenas/${selectedAntena.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: activar ? 'ACTIVA' : 'INACTIVA' }),
      });
      await readJson(res, 'No se pudo cambiar el estado de la antena Starlink.');
      setMensaje(`Antena Starlink ${activar ? 'activada' : 'desactivada'}.`);
      await cargarStarlink();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  const cambiarEstadoCuenta = async () => {
    if (!selectedCuenta?.id) return;
    const activar = selectedCuenta.estado !== 'ACTIVA';
    if (!confirm(`¿Deseas ${activar ? 'activar' : 'desactivar'} la cuenta ${selectedCuenta.nombreCuenta}?`)) return;
    setSaving(true);
    setMensaje('');
    try {
      const res = await apiFetch(`/api/starlink/cuentas/${selectedCuenta.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: activar ? 'ACTIVA' : 'INACTIVA' }),
      });
      await readJson(res, 'No se pudo cambiar el estado de la cuenta Starlink.');
      setMensaje(`Cuenta Starlink ${activar ? 'activada' : 'desactivada'}.`);
      await cargarStarlink();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  const guardarPago = async (event) => {
    event.preventDefault();
    if (!selectedCuenta?.id) return setMensaje('Selecciona una cuenta Starlink para registrar pagos.');
    setSaving(true);
    setMensaje('');
    try {
      const url = pagoForm.id ? `/api/starlink/pagos/${pagoForm.id}` : '/api/starlink/pagos';
      const res = await apiFetch(url, {
        method: pagoForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuentaStarlinkId: selectedCuenta.id,
          ...pagoForm,
          tasaBcv: pagoForm.tasaBcv || undefined,
          fechaPago: pagoForm.fechaPago || undefined,
        }),
      });
      await readJson(res, pagoForm.id ? 'No se pudo actualizar el pago Starlink.' : 'No se pudo registrar el pago Starlink.');
      setMensaje(pagoForm.id ? 'Pago Starlink actualizado.' : 'Pago Starlink registrado.');
      await cargarStarlink();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  const editarPago = (pago) => {
    setPagoForm({
      id: pago.id,
      periodo: pago.periodo || currentMonth(),
      montoUsd: pago.montoUsd?.toString() || '',
      tasaBcv: pago.tasaBcv?.toString() || '',
      fechaPago: toInputDate(pago.fechaPago),
      fechaCorte: toInputDate(pago.fechaCorte),
      estado: pago.estado || 'PENDIENTE',
      referencia: pago.referencia || '',
    });
  };

  const nuevoPago = () => setPagoForm({
    ...emptyPagoForm(),
    montoUsd: selectedCuenta?.montoMensualUsd?.toString() || '',
    fechaCorte: toInputDate(selectedCuenta?.fechaCorte || selectedAntena?.fechaCorte),
  });

  const anularPago = async (pago) => {
    if (!pago?.id || !confirm(`Anular pago ${pago.periodo}?`)) return;
    setSaving(true);
    setMensaje('');
    try {
      const res = await apiFetch(`/api/starlink/pagos/${pago.id}`, { method: 'DELETE' });
      await readJson(res, 'No se pudo anular el pago Starlink.');
      setMensaje('Pago Starlink anulado.');
      await cargarStarlink();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase text-cyan-700">Operación Starlink</p>
          <h2 className="text-2xl font-extrabold text-slate-950">Antenas Starlink</h2>
          <p className="text-sm text-slate-500">Control de cuentas, antenas registradas y próximos cortes de servicio.</p>
        </div>
        <button type="button" onClick={cargarStarlink} className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white shadow hover:bg-slate-800">
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {mensaje && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{mensaje}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Antenas" value={antenas.length} detail="Registradas en el sistema." tone="slate" />
        <MetricCard title="Cuentas/correos" value={correos.length} detail="Correos Starlink activos." tone="cyan" />
        <MetricCard title="Rojo" value={alertasCriticas.length} detail="Vencidas o <= 10 días." tone="red" />
        <MetricCard title="Amarillo" value={alertasAdvertencia.length} detail="De 11 a 20 días." tone="amber" />
        <MetricCard title="Verde" value={alertasVerdes.length} detail="Más de 20 días." tone="emerald" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-extrabold text-slate-950">Semáforo de cortes</h3>
            <p className="text-sm text-slate-500">Rojo hasta 10 días o vencidas. Amarillo de 11 a 20 días.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{alertasOperativas.length} alertas</span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {alertasOperativas.map((alerta) => (
            <div key={alerta.cuentaId} className={`rounded-lg border p-4 ${statusTone(alerta.diasRestantes)}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-extrabold">{alerta.nombreCuenta}</p>
                  <p className="text-xs opacity-80">{alerta.cliente?.nombre || 'Sin cliente'} / {alerta.correoCuenta || 'Sin correo'}</p>
                </div>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold">{dayLabel(alerta.diasRestantes)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <InfoPill label="Corte" value={formatDate(alerta.fechaCorte)} />
                <InfoPill label="Antenas" value={alerta.cantidadAntenas || 0} />
                <InfoPill label="Monto" value={formatUsd(alerta.montoMensualUsd)} />
              </div>
            </div>
          ))}
          {!alertasOperativas.length && (
            <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800 lg:col-span-2">
              No hay cortes rojos ni amarillos.
            </div>
          )}
        </div>
        {alertasVencidas.length > 0 && (
          <p className="mt-3 text-xs font-semibold text-red-700">{alertasVencidas.length} cuenta(s) aparecen vencidas y requieren revisión operativa.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-extrabold text-slate-950">Inventario de antenas</h3>
            <p className="text-sm text-slate-500">Búsqueda rápida por cliente, correo asociado, kit, serie o ubicación.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar antena..." className="input min-w-[240px]" />
            <button type="button" onClick={() => { setClienteFiltro(''); setCorreoFiltro(''); setBusqueda(''); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Limpiar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <FilterPanel title="Filtrar por cliente" open={clientBarOpen} onToggle={() => setClientBarOpen((prev) => !prev)}>
            <select value={clienteFiltro} onChange={(event) => setClienteFiltro(event.target.value)} className="input">
              <option value="">Todos los clientes</option>
              {clientesConStarlink.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.codigoCliente ? `${cliente.codigoCliente} - ` : ''}{cliente.nombre}</option>
              ))}
            </select>
          </FilterPanel>
          <FilterPanel title="Filtrar por correo asociado" open={emailBarOpen} onToggle={() => setEmailBarOpen((prev) => !prev)}>
            <select value={correoFiltro} onChange={(event) => setCorreoFiltro(event.target.value)} className="input">
              <option value="">Todos los correos</option>
              {correos.map((correo) => <option key={correo} value={correo}>{correo}</option>)}
            </select>
          </FilterPanel>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Antena</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Correo/cuenta</th>
                  <th className="p-3">Kit</th>
                  <th className="p-3">S/N</th>
                  <th className="p-3">Corte</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {antenasFiltradas.map((antena) => (
                  <tr key={antena.id} onClick={() => setSelectedAntenaId(antena.id)} className={`cursor-pointer border-b last:border-b-0 hover:bg-cyan-50/50 ${selectedAntena?.id === antena.id ? 'bg-cyan-50' : ''}`}>
                    <td className="p-3">
                      <p className="font-extrabold text-slate-950">{antena.nombreAntena}</p>
                      <p className="text-xs text-slate-500">{antena.ubicacion || 'Sin ubicación'}</p>
                    </td>
                    <td className="p-3">{antena.cliente?.nombre || '-'}</td>
                    <td className="p-3">
                      <p className="font-semibold text-slate-800">{antena.cuenta?.correoCuenta || '-'}</p>
                      <p className="text-xs text-slate-500">{antena.cuenta?.nombreCuenta || '-'}</p>
                    </td>
                    <td className="p-3 font-mono text-xs font-bold text-slate-600">{antena.numeroKit || '-'}</td>
                    <td className="p-3 font-mono text-xs font-bold text-slate-700">{antena.numeroSerie || 'Pendiente'}</td>
                    <td className="p-3">{formatDate(antena.fechaCorte || antena.cuenta?.fechaCorte)}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${antena.estado === 'ACTIVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{antena.estado || 'ACTIVA'}</span></td>
                  </tr>
                ))}
                {!antenasFiltradas.length && (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">No hay antenas con esos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-extrabold uppercase text-slate-600">Detalle seleccionado</h3>
              {selectedAntena && (
                <button type="button" onClick={cambiarEstadoAntena} disabled={saving} className={`rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-60 ${selectedAntena.estado === 'ACTIVA' ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>
                  {selectedAntena.estado === 'ACTIVA' ? 'Desactivar antena' : 'Activar antena'}
                </button>
              )}
            </div>
            {selectedAntena ? (
              <div className="mt-4 space-y-4 text-sm">
                <form onSubmit={(event) => { event.preventDefault(); guardarCuenta(); }} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-slate-950">Cuenta / correo Starlink</h4>
                      <p className="text-xs text-slate-500">Modificar este bloque actualiza la cuenta asociada.</p>
                    </div>
                    <button type="button" onClick={cambiarEstadoCuenta} disabled={!selectedCuenta?.id || saving} className={`rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-50 ${selectedCuenta?.estado === 'ACTIVA' ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>
                      {selectedCuenta?.estado === 'ACTIVA' ? 'Desactivar cuenta' : 'Activar cuenta'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <EditField label="Cliente">
                      <select value={cuentaForm.clienteId} onChange={(event) => setCuentaForm((prev) => ({ ...prev, clienteId: event.target.value }))} className="input">
                        <option value="">Selecciona cliente</option>
                        {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.codigoCliente ? `${cliente.codigoCliente} - ` : ''}{cliente.nombre}</option>)}
                      </select>
                    </EditField>
                    <EditField label="Nombre cuenta">
                      <input value={cuentaForm.nombreCuenta} onChange={(event) => setCuentaForm((prev) => ({ ...prev, nombreCuenta: event.target.value }))} className="input" />
                    </EditField>
                    <EditField label="Correo asociado">
                      <input type="email" value={cuentaForm.correoCuenta} onChange={(event) => setCuentaForm((prev) => ({ ...prev, correoCuenta: event.target.value }))} className="input" />
                    </EditField>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <EditField label="Monto mensual USD">
                        <input type="number" min="0" step="0.01" value={cuentaForm.montoMensualUsd} onChange={(event) => setCuentaForm((prev) => ({ ...prev, montoMensualUsd: event.target.value }))} className="input" />
                      </EditField>
                      <EditField label="Fecha corte">
                        <input type="date" value={cuentaForm.fechaCorte} onChange={(event) => setCuentaForm((prev) => ({ ...prev, fechaCorte: event.target.value }))} className="input" />
                      </EditField>
                    </div>
                    <EditField label="Observaciones">
                      <textarea value={cuentaForm.observaciones} onChange={(event) => setCuentaForm((prev) => ({ ...prev, observaciones: event.target.value }))} rows={2} className="input resize-y" />
                    </EditField>
                  </div>
                  <button disabled={!cuentaForm.id || saving} className="mt-3 w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60">
                    Guardar cuenta
                  </button>
                </form>

                <form onSubmit={(event) => { event.preventDefault(); guardarAntena(); }} className="rounded-lg border border-slate-200 bg-white p-4">
                  <h4 className="font-extrabold text-slate-950">Antena</h4>
                  <p className="mb-3 text-xs text-slate-500">Modificar este bloque actualiza la antena seleccionada.</p>
                  <div className="grid grid-cols-1 gap-3">
                    <EditField label="Nombre antena">
                      <input value={antenaForm.nombreAntena} onChange={(event) => setAntenaForm((prev) => ({ ...prev, nombreAntena: event.target.value }))} className="input" />
                    </EditField>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <EditField label="Numero kit">
                        <input value={antenaForm.numeroKit} onChange={(event) => setAntenaForm((prev) => ({ ...prev, numeroKit: event.target.value }))} className="input" />
                      </EditField>
                      <EditField label="S/N (obligatorio)">
                        <input required value={antenaForm.numeroSerie} onChange={(event) => setAntenaForm((prev) => ({ ...prev, numeroSerie: event.target.value }))} placeholder="Serial único" className="input" />
                      </EditField>
                    </div>
                    <EditField label="Ubicacion">
                      <input value={antenaForm.ubicacion} onChange={(event) => setAntenaForm((prev) => ({ ...prev, ubicacion: event.target.value }))} className="input" />
                    </EditField>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <EditField label="Fecha registro">
                        <input type="date" value={antenaForm.fechaRegistro} onChange={(event) => setAntenaForm((prev) => ({ ...prev, fechaRegistro: event.target.value }))} className="input" />
                      </EditField>
                      <EditField label="Fecha corte">
                        <input type="date" value={antenaForm.fechaCorte} onChange={(event) => setAntenaForm((prev) => ({ ...prev, fechaCorte: event.target.value }))} className="input" />
                      </EditField>
                    </div>
                    <EditField label="Observaciones">
                      <textarea value={antenaForm.observaciones} onChange={(event) => setAntenaForm((prev) => ({ ...prev, observaciones: event.target.value }))} rows={2} className="input resize-y" />
                    </EditField>
                  </div>
                  <button disabled={!antenaForm.id || saving} className="mt-3 w-full rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-cyan-600 disabled:opacity-60">
                    Guardar antena
                  </button>
                </form>

                <form onSubmit={guardarPago} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-slate-950">Pagos / cortes</h4>
                      <p className="text-xs text-slate-500">Editar o anular pagos conserva traza en auditoría.</p>
                    </div>
                    <button type="button" onClick={nuevoPago} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
                      Nuevo pago
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <EditField label="Periodo">
                      <input type="month" value={pagoForm.periodo} onChange={(event) => setPagoForm((prev) => ({ ...prev, periodo: event.target.value }))} className="input" />
                    </EditField>
                    <EditField label="Monto USD">
                      <input type="number" min="0" step="0.01" value={pagoForm.montoUsd} onChange={(event) => setPagoForm((prev) => ({ ...prev, montoUsd: event.target.value }))} className="input" />
                    </EditField>
                    <EditField label="Fecha corte">
                      <input type="date" value={pagoForm.fechaCorte} onChange={(event) => setPagoForm((prev) => ({ ...prev, fechaCorte: event.target.value }))} className="input" />
                    </EditField>
                    <EditField label="Fecha pago">
                      <input type="date" value={pagoForm.fechaPago} onChange={(event) => setPagoForm((prev) => ({ ...prev, fechaPago: event.target.value }))} className="input" />
                    </EditField>
                    <EditField label="Estado">
                      <select value={pagoForm.estado} onChange={(event) => setPagoForm((prev) => ({ ...prev, estado: event.target.value }))} className="input">
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="PAGADO">Pagado</option>
                        <option value="VENCIDO">Vencido</option>
                        <option value="ANULADO">Anulado</option>
                      </select>
                    </EditField>
                    <EditField label="Tasa BCV">
                      <input type="number" min="0" step="0.0001" value={pagoForm.tasaBcv} onChange={(event) => setPagoForm((prev) => ({ ...prev, tasaBcv: event.target.value }))} className="input" />
                    </EditField>
                  </div>
                  <EditField label="Referencia">
                    <input value={pagoForm.referencia} onChange={(event) => setPagoForm((prev) => ({ ...prev, referencia: event.target.value }))} className="input" />
                  </EditField>
                  <button disabled={!selectedCuenta?.id || saving} className="mt-3 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-600 disabled:opacity-60">
                    {pagoForm.id ? 'Guardar pago' : 'Registrar pago'}
                  </button>

                  <div className="mt-4 space-y-2">
                    {pagosCuenta.map((pago) => (
                      <div key={pago.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-bold text-slate-900">{pago.periodo} / {formatUsd(pago.montoUsd)}</p>
                          <p className="text-xs text-slate-500">Corte: {formatDate(pago.fechaCorte)} / Estado: {pago.estado}</p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => editarPago(pago)} className="text-xs font-bold text-blue-600">Editar</button>
                          <button type="button" onClick={() => anularPago(pago)} className="text-xs font-bold text-red-600">Anular</button>
                        </div>
                      </div>
                    ))}
                    {!pagosCuenta.length && <p className="text-xs font-semibold text-slate-500">Sin pagos registrados para esta cuenta.</p>}
                  </div>
                </form>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Selecciona una antena para ver su detalle.</p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}

function MetricCard({ title, value, detail, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    amber: 'border-amber-400 bg-amber-100 text-amber-950',
    emerald: 'border-emerald-400 bg-emerald-100 text-emerald-950',
    red: 'border-red-400 bg-red-100 text-red-950',
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-extrabold uppercase opacity-70">{title}</p>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-2 text-xs opacity-70">{detail}</p>
    </div>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase opacity-60">{label}</p>
      <p className="truncate font-bold">{value}</p>
    </div>
  );
}

function FilterPanel({ title, open, onToggle, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-extrabold text-slate-800">
        <span>{title}</span>
        <span className="text-xs text-slate-500">{open ? 'Ocultar' : 'Abrir'}</span>
      </button>
      {open && <div className="border-t border-slate-200 p-3">{children}</div>}
    </div>
  );
}

function EditField({ label, children }) {
  return (
    <label className="block min-w-0 text-xs font-bold text-slate-500">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-extrabold uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-800">{value}</p>
    </div>
  );
}
