"use client";

import { useEffect, useState } from 'react';

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-VE') : '-');

export default function AuditoriaView({ apiFetch }) {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({ desde: '', hasta: '', accion: '', entidad: '' });
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  const cargarLogs = async () => {
    setLoading(true);
    setMensaje('');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    try {
      const res = await apiFetch(`/api/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los logs.');
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarLogs();
  }, []);

  const updateFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Auditoría</h2>
        <p className="text-sm text-slate-500">Registro de accesos, cambios y operaciones sensibles.</p>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); cargarLogs(); }} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <input type="date" value={filters.desde} onChange={(e) => updateFilter('desde', e.target.value)} className="input" />
        <input type="date" value={filters.hasta} onChange={(e) => updateFilter('hasta', e.target.value)} className="input" />
        <input placeholder="Acción" value={filters.accion} onChange={(e) => updateFilter('accion', e.target.value)} className="input" />
        <input placeholder="Entidad" value={filters.entidad} onChange={(e) => updateFilter('entidad', e.target.value)} className="input" />
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Filtrar</button>
      </form>

      {mensaje && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{mensaje}</div>}
      {loading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando auditoría...</div>}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Fecha/hora</th>
                <th className="p-3">Usuario</th>
                <th className="p-3">Acción</th>
                <th className="p-3">Entidad</th>
                <th className="p-3">Descripción</th>
                <th className="p-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={6} className="p-5 text-center text-slate-500">Sin registros.</td></tr>}
              {logs.map((log) => (
                <tr key={log.id} className="border-t align-top">
                  <td className="p-3 text-slate-500">{formatDateTime(log.createdAt)}</td>
                  <td className="p-3">
                    <p className="font-bold text-slate-900">{log.usuario?.nombre || '-'}</p>
                    <p className="text-xs text-slate-500">{log.usuario?.email || ''}</p>
                  </td>
                  <td className="p-3 font-mono text-xs font-bold text-indigo-700">{log.accion}</td>
                  <td className="p-3">{log.entidad}{log.entidadId ? <span className="block text-xs text-slate-400">{log.entidadId}</span> : null}</td>
                  <td className="p-3 text-slate-700">{log.descripcion}</td>
                  <td className="p-3 text-xs text-slate-500">{log.ip || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
