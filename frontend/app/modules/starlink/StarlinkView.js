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

const statusTone = (diasRestantes) => {
  const days = Number(diasRestantes);
  if (days < 0) return 'border-red-200 bg-red-50 text-red-800';
  if (days === 0) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (days <= 10) return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  return 'border-slate-200 bg-white text-slate-700';
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

  const clientesById = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes]);
  const cuentasById = useMemo(() => new Map(cuentas.map((cuenta) => [cuenta.id, cuenta])), [cuentas]);

  const cargarStarlink = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const [cuentasRes, antenasRes, alertasRes] = await Promise.all([
        apiFetch('/api/starlink/cuentas'),
        apiFetch('/api/starlink/antenas'),
        apiFetch('/api/starlink/alertas'),
      ]);
      const [cuentasData, antenasData, alertasData] = await Promise.all([
        cuentasRes.json().catch(() => []),
        antenasRes.json().catch(() => []),
        alertasRes.json().catch(() => ({ alertas: [] })),
      ]);
      setCuentas(Array.isArray(cuentasData) ? cuentasData : []);
      setAntenas(Array.isArray(antenasData) ? antenasData : []);
      setAlertas(Array.isArray(alertasData?.alertas) ? alertasData.alertas : []);
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
  const alertasProximas = alertas.filter((alerta) => Number(alerta.diasRestantes) >= 0 && Number(alerta.diasRestantes) <= 10);
  const alertasHoy = alertasProximas.filter((alerta) => Number(alerta.diasRestantes) === 0);
  const alertasVencidas = alertas.filter((alerta) => Number(alerta.diasRestantes) < 0);

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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Antenas" value={antenas.length} detail="Registradas en el sistema." tone="slate" />
        <MetricCard title="Cuentas/correos" value={correos.length} detail="Correos Starlink activos." tone="cyan" />
        <MetricCard title="Vencen hoy" value={alertasHoy.length} detail="Cortes del día." tone="amber" />
        <MetricCard title="Próximas" value={alertasProximas.length} detail="Dentro de 10 días." tone="emerald" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-extrabold text-slate-950">Cortes próximos</h3>
            <p className="text-sm text-slate-500">Cuentas que vencen hoy o dentro de los próximos 10 días.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{alertasProximas.length} alertas</span>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {alertasProximas.map((alerta) => (
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
          {!alertasProximas.length && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500 lg:col-span-2">
              No hay cortes próximos dentro de los próximos 10 días.
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
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Antena</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Correo/cuenta</th>
                  <th className="p-3">Kit</th>
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
                    <td className="p-3">{formatDate(antena.fechaCorte || antena.cuenta?.fechaCorte)}</td>
                    <td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{antena.estado || 'ACTIVA'}</span></td>
                  </tr>
                ))}
                {!antenasFiltradas.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">No hay antenas con esos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-extrabold uppercase text-slate-600">Detalle seleccionado</h3>
            {selectedAntena ? (
              <div className="mt-4 space-y-3 text-sm">
                <DetailRow label="Antena" value={selectedAntena.nombreAntena} />
                <DetailRow label="Cliente" value={selectedAntena.cliente?.nombre || '-'} />
                <DetailRow label="Correo asociado" value={selectedAntena.cuenta?.correoCuenta || '-'} />
                <DetailRow label="Cuenta" value={selectedAntena.cuenta?.nombreCuenta || '-'} />
                <DetailRow label="Kit" value={selectedAntena.numeroKit || '-'} />
                <DetailRow label="Serie" value={selectedAntena.numeroSerie || '-'} />
                <DetailRow label="Fecha registro" value={formatDate(selectedAntena.fechaRegistro)} />
                <DetailRow label="Fecha corte" value={formatDate(selectedAntena.fechaCorte || selectedAntena.cuenta?.fechaCorte)} />
                <DetailRow label="Observaciones" value={selectedAntena.observaciones || '-'} />
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
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
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

function DetailRow({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-extrabold uppercase text-slate-400">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-800">{value}</p>
    </div>
  );
}
