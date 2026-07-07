"use client";

import { useEffect, useState } from 'react';
import currency from 'currency.js';

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '-');

const secciones = [
  ['ingresos', 'Ingresos'],
  ['egresos', 'Egresos'],
  ['cuentasPorCobrar', 'Cuentas por cobrar'],
  ['cuentasPorPagar', 'Cuentas por pagar'],
  ['facturasPagadas', 'Facturas pagadas'],
  ['facturasPendientes', 'Facturas pendientes'],
];

export default function ReportesContablesView({ clientes = [], apiFetch }) {
  const [filters, setFilters] = useState({ desde: '', hasta: '', tipo: '', estado: '', clienteId: '', proveedorId: '', buscar: '' });
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargarReporte = async () => {
    setLoading(true);
    setMensaje('');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    try {
      const res = await apiFetch(`/api/reportes/contabilidad?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el reporte.');
      setReporte(data);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReporte();
  }, []);

  const updateFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Reportes contables</h2>
        <p className="text-sm text-slate-500">Totales separados por ingresos, egresos, pendientes y facturas.</p>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); cargarReporte(); }} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-7">
        <input type="date" value={filters.desde} onChange={(e) => updateFilter('desde', e.target.value)} className="input" />
        <input type="date" value={filters.hasta} onChange={(e) => updateFilter('hasta', e.target.value)} className="input" />
        <select value={filters.tipo} onChange={(e) => updateFilter('tipo', e.target.value)} className="input">
          <option value="">Todos los tipos</option>
          <option value="INGRESO">Ingreso</option>
          <option value="EGRESO">Egreso</option>
          <option value="CUENTA_POR_COBRAR">Cuenta por cobrar</option>
          <option value="CUENTA_POR_PAGAR">Cuenta por pagar</option>
        </select>
        <select value={filters.estado} onChange={(e) => updateFilter('estado', e.target.value)} className="input">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="PAGADO">Pagado</option>
          <option value="VENCIDO">Vencido</option>
          <option value="ANULADO">Anulado</option>
        </select>
        <select value={filters.clienteId} onChange={(e) => updateFilter('clienteId', e.target.value)} className="input">
          <option value="">Todos los clientes</option>
          {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.codigoCliente ? `${cliente.codigoCliente} - ` : ''}{cliente.nombre}</option>)}
        </select>
        <input placeholder="Proveedor" value={filters.proveedorId} onChange={(e) => updateFilter('proveedorId', e.target.value)} className="input" />
        <div className="flex gap-2 md:col-span-3 xl:col-span-1">
          <input placeholder="Buscar..." value={filters.buscar} onChange={(e) => updateFilter('buscar', e.target.value)} className="input" />
          <button className="rounded-lg bg-slate-900 px-4 text-sm font-bold text-white">Filtrar</button>
        </div>
      </form>

      {mensaje && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{mensaje}</div>}
      {loading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando reporte...</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Metric title="Ingresos reales" value={formatUsd(reporte?.resumen?.totalIngresos)} tone="emerald" />
        <Metric title="Egresos reales" value={formatUsd(reporte?.resumen?.totalEgresos)} tone="red" />
        <Metric title="Balance general" value={formatUsd(reporte?.resumen?.balance)} tone="slate" />
      </div>

      {secciones.map(([key, title]) => {
        const section = reporte?.secciones?.[key] || { items: [], subtotalUsd: 0 };
        return (
          <section key={key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-bold text-slate-950">{title}</h3>
              <span className="text-sm font-extrabold text-slate-700">{formatUsd(section.subtotalUsd)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Concepto</th>
                    <th className="p-3">Referencia</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">USD</th>
                    <th className="p-3 text-right">Tasa</th>
                    <th className="p-3 text-right">Bs</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-500">Sin registros.</td></tr>}
                  {section.items.map((mov) => (
                    <tr key={`${key}-${mov.id}`} className="border-t">
                      <td className="p-3 text-slate-500">{formatDate(mov.fechaMovimiento)}</td>
                      <td className="p-3 font-semibold text-slate-900">{mov.concepto}</td>
                      <td className="p-3 text-slate-600">{mov.referencia || mov.cliente?.nombre || mov.proveedorId || '-'}</td>
                      <td className="p-3">{mov.estado}</td>
                      <td className="p-3 text-right font-bold">{formatUsd(mov.montoUsd)}</td>
                      <td className="p-3 text-right">{mov.tasaBcv || '-'}</td>
                      <td className="p-3 text-right">{mov.montoBs ? currency(mov.montoBs, { symbol: 'Bs ', separator: '.', decimal: ',' }).format() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Metric({ title, value, tone }) {
  const tones = {
    emerald: 'border-emerald-200 text-emerald-700',
    red: 'border-red-200 text-red-700',
    slate: 'border-slate-200 text-slate-950',
  };

  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}
