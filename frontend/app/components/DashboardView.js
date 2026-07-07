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

const toneStyles = {
  slate: {
    card: 'border-slate-200 bg-white text-slate-950',
    accent: 'text-slate-950',
    label: 'text-slate-500',
  },
  indigo: {
    card: 'border-indigo-200 bg-indigo-50/40 text-indigo-800',
    accent: 'text-indigo-700',
    label: 'text-indigo-700',
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/50 text-emerald-800',
    accent: 'text-emerald-700',
    label: 'text-emerald-700',
  },
  red: {
    card: 'border-red-200 bg-red-50/50 text-red-800',
    accent: 'text-red-700',
    label: 'text-red-700',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/60 text-amber-800',
    accent: 'text-amber-700',
    label: 'text-amber-700',
  },
};

const valueSizeClass = (value, compact = false) => {
  const length = String(value ?? '').replace(/\s/g, '').length;
  if (compact) {
    if (length > 16) return 'text-[0.95rem]';
    if (length > 12) return 'text-[1.05rem]';
    if (length > 8) return 'text-[1.2rem]';
    return 'text-2xl';
  }

  if (length > 18) return 'text-[1rem]';
  if (length > 15) return 'text-[1.12rem]';
  if (length > 12) return 'text-[1.32rem]';
  if (length > 9) return 'text-[1.55rem]';
  return 'text-3xl';
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

  const balanceTone = kpis.balanceActual >= 0 ? 'emerald' : 'red';
  const mensualTone = kpis.totalMensual >= 0 ? 'emerald' : 'red';
  const anualTone = kpis.totalAnual >= 0 ? 'emerald' : 'red';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Panel ejecutivo</p>
          <h2 className="text-2xl font-extrabold text-slate-950">Dashboard</h2>
          <p className="text-sm text-slate-500">Resumen operativo, comercial y contable del ERP.</p>
        </div>
        <div className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm lg:w-auto lg:min-w-[260px]">
          <p className="text-xs font-bold uppercase text-slate-500">Balance actual</p>
          <p className={`${valueSizeClass(formatUsd(kpis.balanceActual), true)} mt-1 max-w-full font-extrabold leading-tight tabular-nums ${toneStyles[balanceTone].accent}`}>
            {formatUsd(kpis.balanceActual)}
          </p>
        </div>
      </div>

      {loading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando indicadores...</div>}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <KpiCard title="Balance actual" value={formatUsd(kpis.balanceActual)} detail="Ingresos reales menos egresos reales." tone={balanceTone} featured />
        <KpiCard title="Ingresos reales" value={formatUsd(kpis.ingresosReales)} detail="Movimientos pagados de ingreso." tone="emerald" featured />
        <KpiCard title="Egresos reales" value={formatUsd(kpis.egresosReales)} detail="Movimientos pagados de egreso." tone="red" featured />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard title="Clientes" value={kpis.totalClientes || 0} tone="slate" compact />
        <KpiCard title="Propuestas" value={kpis.totalCotizaciones || 0} tone="indigo" compact />
        <KpiCard title="Ventas" value={kpis.totalVentas || 0} tone="indigo" compact />
        <KpiCard title="Pagadas" value={kpis.facturasPagadas || 0} tone="emerald" compact />
        <KpiCard title="Pendientes" value={kpis.facturasPendientes || 0} tone="amber" compact />
        <KpiCard title="Vencidas" value={kpis.facturasVencidas || 0} tone="red" compact />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
          <div className="space-y-4">
            {balanceData.map((item) => (
              <div key={item.label} className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-[100px_minmax(0,1fr)]">
                <div className="font-bold text-slate-500">{item.label}</div>
                <div className="min-w-0 space-y-2">
                  <ChartBar label="Ingresos" value={item.ingresos} max={maxChartValue} tone="bg-emerald-500" />
                  <ChartBar label="Egresos" value={item.egresos} max={maxChartValue} tone="bg-red-500" />
                  <ChartBar label="Por cobrar" value={item.porCobrar} max={maxChartValue} tone="bg-amber-500" />
                  <ChartBar label="Por pagar" value={item.porPagar} max={maxChartValue} tone="bg-slate-500" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <KpiCard title="Total mensual" value={formatUsd(kpis.totalMensual)} detail="Resultado del mes en curso." tone={mensualTone} />
          <KpiCard title="Total anual" value={formatUsd(kpis.totalAnual)} detail="Resultado acumulado del año." tone={anualTone} />
          <KpiCard title="Flujo neto del mes" value={formatUsd((kpis.ingresosMes || 0) - (kpis.egresosMes || 0))} detail="Ingresos menos egresos del período actual." tone={((kpis.ingresosMes || 0) - (kpis.egresosMes || 0)) >= 0 ? 'emerald' : 'red'} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KpiCard title="Cuentas por cobrar" value={formatUsd(kpis.montoPorCobrar)} detail={`${kpis.cuentasPorCobrarPendientes || 0} pendientes o vencidas`} tone="amber" />
        <KpiCard title="Cuentas por pagar" value={formatUsd(kpis.montoPorPagar)} detail={`${kpis.cuentasPorPagarPendientes || 0} pendientes o vencidas`} tone="slate" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950">Últimos movimientos contables</h3>
            <p className="text-sm text-slate-500">Actividad reciente registrada en contabilidad.</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{ultimosMovimientos.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
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
                  <td colSpan={5} className="p-6 text-center text-slate-500">Aún no hay movimientos contables.</td>
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
                  <td className="p-3 text-right font-bold tabular-nums">{formatUsd(mov.montoUsd)}</td>
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
  const safeValue = Math.abs(Number(value || 0));
  const width = Math.max(safeValue > 0 ? 4 : 0, Math.round((safeValue / max) * 100));
  const formatted = formatUsd(value);

  return (
    <div className="grid grid-cols-[74px_minmax(0,1fr)_minmax(86px,auto)] items-center gap-2">
      <span className="text-slate-500">{label}</span>
      <div className="h-3 min-w-0 overflow-hidden rounded bg-slate-100">
        <div className={`h-full rounded ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`${valueSizeClass(formatted, true)} text-right font-bold leading-none text-slate-700 tabular-nums`}>{formatted}</span>
    </div>
  );
}

function KpiCard({ title, value, detail, tone = 'slate', featured = false, compact = false }) {
  const styles = toneStyles[tone] || toneStyles.slate;

  return (
    <div className={`min-w-0 rounded-lg border p-4 shadow-sm ${featured ? 'min-h-[132px]' : compact ? 'min-h-[104px]' : 'min-h-[120px]'} ${styles.card}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className={`min-w-0 text-xs font-bold uppercase tracking-wide ${styles.label}`}>{title}</p>
        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : tone === 'indigo' ? 'bg-indigo-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      </div>
      <p className={`${valueSizeClass(value, compact)} mt-3 max-w-full font-extrabold leading-tight tracking-normal tabular-nums ${styles.accent}`}>
        {value}
      </p>
      {detail && <p className="mt-2 text-xs leading-snug text-slate-500">{detail}</p>}
    </div>
  );
}
