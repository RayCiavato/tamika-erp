"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();

const tipoLabel = {
  INGRESO: 'Ingreso',
  EGRESO: 'Egreso',
  CUENTA_POR_COBRAR: 'Cuenta por cobrar',
  CUENTA_POR_PAGAR: 'Cuenta por pagar',
};

const estadoStyles = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  PAGADO: 'bg-emerald-100 text-emerald-800',
  VENCIDO: 'bg-red-100 text-red-800',
  ANULADO: 'bg-slate-200 text-slate-700',
};

export default function DashboardView({ resumen, loading, apiFetch }) {
  const kpis = resumen?.kpis || {};
  const ultimosMovimientos = resumen?.ultimosMovimientos || [];
  const [periodo, setPeriodo] = useState('mensual');
  const [balanceData, setBalanceData] = useState([]);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (!apiFetch) return;
    setLoadingBalance(true);
    apiFetch(`/api/dashboard/balance?periodo=${periodo}`)
      .then((res) => res.json())
      .then((data) => setBalanceData(Array.isArray(data.data) ? data.data : []))
      .catch(() => setBalanceData([]))
      .finally(() => setLoadingBalance(false));
  }, [periodo, apiFetch]);

  const maxChartValue = useMemo(() => {
    const values = balanceData.flatMap((item) => [item.ingresos, item.egresos, item.porCobrar, item.porPagar].map((value) => Math.abs(Number(value || 0))));
    return Math.max(...values, 1);
  }, [balanceData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Dashboard</h2>
          <p className="text-sm text-slate-500">Resumen operativo, comercial y contable del ERP.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          Balance actual: <span className="font-extrabold text-slate-950">{formatUsd(kpis.balanceActual)}</span>
        </div>
      </div>

      {loading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando indicadores...</div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Clientes" value={kpis.totalClientes || 0} tone="slate" />
        <KpiCard title="Propuestas" value={kpis.totalCotizaciones || 0} tone="indigo" />
        <KpiCard title="Ventas registradas" value={kpis.totalVentas || 0} tone="indigo" />
        <KpiCard title="Ingresos reales" value={formatUsd(kpis.ingresosReales)} tone="emerald" />
        <KpiCard title="Egresos reales" value={formatUsd(kpis.egresosReales)} tone="red" />
        <KpiCard title="Balance actual" value={formatUsd(kpis.balanceActual)} tone={kpis.balanceActual >= 0 ? 'emerald' : 'red'} />
        <KpiCard title="Facturas pagadas" value={kpis.facturasPagadas || 0} tone="emerald" />
        <KpiCard title="Facturas pendientes" value={kpis.facturasPendientes || 0} tone="red" />
        <KpiCard title="Total mensual" value={formatUsd(kpis.totalMensual)} tone={kpis.totalMensual >= 0 ? 'emerald' : 'red'} />
        <KpiCard title="Total anual" value={formatUsd(kpis.totalAnual)} tone={kpis.totalAnual >= 0 ? 'emerald' : 'red'} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-950">Balance por período</h3>
            <p className="text-sm text-slate-500">Ingresos, egresos y pendientes calculados desde movimientos reales.</p>
          </div>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="input w-full sm:w-44">
            <option value="diario">Diario</option>
            <option value="semanal">Semanal</option>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        {loadingBalance && <p className="text-sm text-slate-500">Cargando gráfica...</p>}
        {!loadingBalance && balanceData.length === 0 && <p className="text-sm text-slate-500">Sin movimientos para graficar.</p>}
        <div className="space-y-3">
          {balanceData.map((item) => (
            <div key={item.label} className="grid grid-cols-[88px_1fr] gap-3 text-xs sm:grid-cols-[110px_1fr]">
              <div className="pt-1 font-bold text-slate-500">{item.label}</div>
              <div className="space-y-1">
                <ChartBar label="Ingresos" value={item.ingresos} max={maxChartValue} tone="bg-emerald-500" />
                <ChartBar label="Egresos" value={item.egresos} max={maxChartValue} tone="bg-red-500" />
                <ChartBar label="Por cobrar" value={item.porCobrar} max={maxChartValue} tone="bg-amber-500" />
                <ChartBar label="Por pagar" value={item.porPagar} max={maxChartValue} tone="bg-slate-500" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cuentas por cobrar</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">{formatUsd(kpis.montoPorCobrar)}</p>
          <p className="mt-1 text-sm text-slate-500">{kpis.cuentasPorCobrarPendientes || 0} pendientes o vencidas</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cuentas por pagar</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-950">{formatUsd(kpis.montoPorPagar)}</p>
          <p className="mt-1 text-sm text-slate-500">{kpis.cuentasPorPagarPendientes || 0} pendientes o vencidas</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Flujo neto del mes</p>
          <p className="mt-2 text-3xl font-extrabold">{formatUsd((kpis.ingresosMes || 0) - (kpis.egresosMes || 0))}</p>
          <p className="mt-1 text-sm text-slate-400">Ingresos menos egresos del periodo actual</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-950">Ultimos movimientos contables</h3>
          <span className="text-xs font-medium text-slate-500">{ultimosMovimientos.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Concepto</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {ultimosMovimientos.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">Aun no hay movimientos contables.</td>
                </tr>
              )}
              {ultimosMovimientos.map((mov) => (
                <tr key={mov.id} className="border-b last:border-b-0 hover:bg-slate-50">
                  <td className="p-3 text-slate-500">{new Date(mov.fechaMovimiento).toLocaleDateString('es-VE', { timeZone: 'UTC' })}</td>
                  <td className="p-3 font-medium">{tipoLabel[mov.tipo] || mov.tipo}</td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-900">{mov.concepto}</p>
                    <p className="text-xs text-slate-500">{mov.cliente?.nombre || mov.referencia || '-'}</p>
                  </td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${estadoStyles[mov.estado] || 'bg-slate-100 text-slate-700'}`}>{mov.estado}</span></td>
                  <td className="p-3 text-right font-bold">{formatUsd(mov.montoUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ChartBar({ label, value, max, tone }) {
  const width = Math.max(4, Math.round((Number(value || 0) / max) * 100));

  return (
    <div className="grid grid-cols-[72px_1fr_86px] items-center gap-2">
      <span className="text-slate-500">{label}</span>
      <div className="h-3 overflow-hidden rounded bg-slate-100">
        <div className={`h-full rounded ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-right font-bold text-slate-700">{formatUsd(value)}</span>
    </div>
  );
}

function KpiCard({ title, value, detail, tone }) {
  const tones = {
    slate: 'border-slate-200 text-slate-950',
    indigo: 'border-indigo-200 text-indigo-700',
    emerald: 'border-emerald-200 text-emerald-700',
    red: 'border-red-200 text-red-700',
  };

  return (
    <div className={`rounded-lg border bg-white p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}
