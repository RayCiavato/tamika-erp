"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();
const formatBs = (value) => (value || value === 0 ? currency(value, { symbol: 'Bs ', separator: '.', decimal: ',' }).format() : '-');
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-VE', { timeZone: 'UTC' }) : '-');
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-VE') : '-');

const sectionConfig = [
  { key: 'ingresos', title: 'Ingresos', label: 'Ingresos reales', tone: 'emerald' },
  { key: 'egresos', title: 'Egresos', label: 'Egresos reales', tone: 'red' },
  { key: 'cuentasPorCobrar', title: 'Cuentas por cobrar', label: 'Por cobrar', tone: 'amber' },
  { key: 'cuentasPorPagar', title: 'Cuentas por pagar', label: 'Por pagar', tone: 'slate' },
  { key: 'facturasPagadas', title: 'Facturas pagadas', label: 'Pagadas', tone: 'emerald' },
  { key: 'facturasPendientes', title: 'Facturas pendientes', label: 'Pendientes', tone: 'amber' },
];

const estadoStyles = {
  PENDIENTE: 'bg-amber-100 text-amber-800',
  PAGADO: 'bg-emerald-100 text-emerald-800',
  VENCIDO: 'bg-red-100 text-red-800',
  ANULADO: 'bg-slate-200 text-slate-700',
};

const toneStyles = {
  emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700',
  red: 'border-red-200 bg-red-50/50 text-red-700',
  amber: 'border-amber-200 bg-amber-50/60 text-amber-700',
  slate: 'border-slate-200 bg-white text-slate-950',
  indigo: 'border-indigo-200 bg-indigo-50/50 text-indigo-700',
};

const valueSizeClass = (value) => {
  const length = String(value ?? '').replace(/\s/g, '').length;
  if (length > 18) return 'text-[1rem]';
  if (length > 15) return 'text-[1.12rem]';
  if (length > 12) return 'text-[1.32rem]';
  return 'text-2xl';
};

const getBase64ImageFromURL = (url) => new Promise((resolve) => {
  const img = new Image();
  img.setAttribute('crossOrigin', 'anonymous');
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    resolve(canvas.toDataURL('image/png'));
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

const filterValue = (filters, clientes, field) => {
  if (field === 'clienteId') {
    const cliente = clientes.find((item) => item.id === filters.clienteId);
    return cliente?.nombre || 'Todos';
  }
  if (field === 'desde' || field === 'hasta') return filters[field] || 'Sin límite';
  return filters[field] || 'Todos';
};

export default function ReportesContablesView({ clientes = [], apiFetch }) {
  const [filters, setFilters] = useState({ desde: '', hasta: '', tipo: '', estado: '', clienteId: '', buscar: '' });
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

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
      return data;
    } catch (error) {
      setMensaje(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarReporte();
  }, []);

  const updateFilter = (field, value) => setFilters((prev) => ({ ...prev, [field]: value }));

  const sections = useMemo(() => sectionConfig.map((config) => ({
    ...config,
    ...(reporte?.secciones?.[config.key] || { items: [], subtotalUsd: 0, subtotalBs: 0 }),
  })), [reporte]);

  const generarPdf = async (accion = 'abrir') => {
    const data = reporte || await cargarReporte();
    if (!data) return;

    setPdfLoading(true);
    try {
      const pdfMake = require('pdfmake/build/pdfmake');
      const pdfFonts = require('pdfmake/build/vfs_fonts');
      pdfMake.vfs = (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

      const logoBase64 = await getBase64ImageFromURL('/logo.png');
      const generatedAt = new Date();
      const pdfSections = sectionConfig.map((config) => ({
        ...config,
        ...(data?.secciones?.[config.key] || { items: [], subtotalUsd: 0, subtotalBs: 0 }),
      }));
      const headerCell = (text, alignment = 'left') => ({ text, bold: true, color: '#ffffff', fontSize: 7.5, fillColor: '#1e293b', alignment, margin: [4, 5] });
      const bodyCell = (text, alignment = 'left', bold = false) => ({ text, fontSize: 7, color: '#1f2937', alignment, bold, margin: [4, 4], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] });
      const filterCell = (label, value) => ({
        stack: [
          { text: label, fontSize: 6.5, bold: true, color: '#64748b' },
          { text: value || '-', fontSize: 8, color: '#0f172a', margin: [0, 2, 0, 0] },
        ],
        fillColor: '#f8fafc',
        margin: [6, 5],
      });

      const sectionBlocks = pdfSections.flatMap((section) => {
        const rows = section.items.length
          ? section.items.map((mov) => [
            bodyCell(formatDate(mov.fechaMovimiento)),
            bodyCell(mov.concepto || '-'),
            bodyCell(mov.referencia || mov.cliente?.nombre || '-'),
            bodyCell(mov.estado || '-'),
            bodyCell(formatUsd(mov.montoUsd), 'right', true),
            bodyCell(mov.tasaBcv || '-', 'right'),
            bodyCell(formatBs(mov.montoBs), 'right'),
          ])
          : [[{ text: 'Sin registros.', colSpan: 7, alignment: 'center', fontSize: 8, color: '#64748b', margin: [4, 8] }, {}, {}, {}, {}, {}, {}]];

        return [
          {
            columns: [
              { text: section.title, bold: true, fontSize: 11, color: '#0f172a' },
              { text: formatUsd(section.subtotalUsd), bold: true, fontSize: 10, color: '#0f172a', alignment: 'right' },
            ],
            margin: [0, 12, 0, 5],
          },
          {
            table: {
              headerRows: 1,
              widths: [54, '*', 115, 58, 70, 44, 75],
              body: [
                [
                  headerCell('Fecha'),
                  headerCell('Concepto'),
                  headerCell('Referencia'),
                  headerCell('Estado'),
                  headerCell('USD', 'right'),
                  headerCell('Tasa', 'right'),
                  headerCell('Bs', 'right'),
                ],
                ...rows,
              ],
            },
            layout: {
              hLineColor: () => '#e2e8f0',
              vLineColor: () => '#e2e8f0',
              hLineWidth: (i) => (i === 0 ? 0 : 0.5),
              vLineWidth: () => 0,
            },
          },
        ];
      });

      const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [28, 34, 28, 38],
        footer: (currentPage, pageCount) => ({
          text: `TAMIKA ERP - Reporte contable (${currentPage}/${pageCount})`,
          alignment: 'right',
          margin: [0, 8, 28, 0],
          fontSize: 7,
          color: '#64748b',
        }),
        content: [
          {
            columns: [
              logoBase64 ? { image: logoBase64, width: 42 } : { text: 'TAMIKA', bold: true },
              {
                width: '*',
                stack: [
                  { text: 'Reporte contable', fontSize: 18, bold: true, color: '#0f172a' },
                  { text: 'Totales separados por ingresos, egresos, pendientes y facturas.', fontSize: 8.5, color: '#64748b' },
                ],
                margin: [10, 0, 0, 0],
              },
              {
                width: 180,
                stack: [
                  { text: 'Generado', fontSize: 7, bold: true, color: '#64748b', alignment: 'right' },
                  { text: formatDateTime(generatedAt), fontSize: 8.5, bold: true, color: '#0f172a', alignment: 'right' },
                ],
              },
            ],
            margin: [0, 0, 0, 14],
          },
          {
            table: {
              widths: ['*', '*', '*', '*'],
              body: [
                [
                  filterCell('Desde', filterValue(filters, clientes, 'desde')),
                  filterCell('Hasta', filterValue(filters, clientes, 'hasta')),
                  filterCell('Tipo', filterValue(filters, clientes, 'tipo')),
                  filterCell('Estado', filterValue(filters, clientes, 'estado')),
                ],
                [
                  filterCell('Cliente', filterValue(filters, clientes, 'clienteId')),
                  filterCell('Búsqueda', filters.buscar || 'Sin búsqueda'),
                  filterCell('Moneda', 'USD / Bs'),
                  filterCell('Módulo', 'Contabilidad'),
                ],
              ],
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              widths: ['*', '*', '*'],
              body: [[
                { text: `INGRESOS REALES\n${formatUsd(data?.resumen?.totalIngresos)}`, bold: true, color: '#047857', fillColor: '#ecfdf5', margin: [10, 8] },
                { text: `EGRESOS REALES\n${formatUsd(data?.resumen?.totalEgresos)}`, bold: true, color: '#b91c1c', fillColor: '#fef2f2', margin: [10, 8] },
                { text: `BALANCE GENERAL\n${formatUsd(data?.resumen?.balance)}`, bold: true, color: '#0f172a', fillColor: '#f8fafc', margin: [10, 8] },
              ]],
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 8],
          },
          ...sectionBlocks,
        ],
      };

      const fileName = `Reporte_contable_${generatedAt.toISOString().slice(0, 10)}.pdf`;
      if (accion === 'descargar') pdfMake.createPdf(docDefinition).download(fileName);
      else pdfMake.createPdf(docDefinition).open();
    } catch (error) {
      setMensaje(`No se pudo generar el PDF: ${error.message}`);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Centro de reportes</p>
          <h2 className="text-2xl font-extrabold text-slate-950">Reportes contables</h2>
          <p className="text-sm text-slate-500">Totales separados por ingresos, egresos, pendientes y facturas.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => generarPdf('abrir')} disabled={loading || pdfLoading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50">
            Ver PDF
          </button>
          <button type="button" onClick={() => generarPdf('descargar')} disabled={loading || pdfLoading} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50">
            Descargar PDF
          </button>
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); cargarReporte(); }} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Desde"><input type="date" value={filters.desde} onChange={(e) => updateFilter('desde', e.target.value)} className="input" /></Field>
          <Field label="Hasta"><input type="date" value={filters.hasta} onChange={(e) => updateFilter('hasta', e.target.value)} className="input" /></Field>
          <Field label="Tipo"><select value={filters.tipo} onChange={(e) => updateFilter('tipo', e.target.value)} className="input">
            <option value="">Todos los tipos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
            <option value="CUENTA_POR_COBRAR">Cuenta por cobrar</option>
            <option value="CUENTA_POR_PAGAR">Cuenta por pagar</option>
          </select></Field>
          <Field label="Estado"><select value={filters.estado} onChange={(e) => updateFilter('estado', e.target.value)} className="input">
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
            <option value="VENCIDO">Vencido</option>
            <option value="ANULADO">Anulado</option>
          </select></Field>
          <Field label="Cliente"><select value={filters.clienteId} onChange={(e) => updateFilter('clienteId', e.target.value)} className="input">
            <option value="">Todos los clientes</option>
            {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.codigoCliente ? `${cliente.codigoCliente} - ` : ''}{cliente.nombre}</option>)}
          </select></Field>
          <Field label="Búsqueda"><input placeholder="Concepto, referencia..." value={filters.buscar} onChange={(e) => updateFilter('buscar', e.target.value)} className="input" /></Field>
          <div className="flex items-end">
            <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">Filtrar</button>
          </div>
        </div>
      </form>

      {mensaje && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{mensaje}</div>}
      {loading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando reporte...</div>}
      {pdfLoading && <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700">Generando PDF...</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Metric title="Ingresos reales" value={formatUsd(reporte?.resumen?.totalIngresos)} tone="emerald" />
        <Metric title="Egresos reales" value={formatUsd(reporte?.resumen?.totalEgresos)} tone="red" />
        <Metric title="Balance general" value={formatUsd(reporte?.resumen?.balance)} tone="slate" />
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {sections.map((section) => (
          <SectionTile key={section.key} title={section.label} value={formatUsd(section.subtotalUsd)} count={section.items.length} tone={section.tone} />
        ))}
      </section>

      {sections.map((section) => (
        <ReportSection key={section.key} section={section} />
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Metric({ title, value, tone }) {
  return (
    <div className={`min-w-0 rounded-lg border p-5 shadow-sm ${toneStyles[tone] || toneStyles.slate}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`${valueSizeClass(value)} mt-2 max-w-full font-extrabold leading-tight tabular-nums`}>{value}</p>
    </div>
  );
}

function SectionTile({ title, value, count, tone }) {
  return (
    <div className={`min-w-0 rounded-lg border p-4 shadow-sm ${toneStyles[tone] || toneStyles.slate}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`${valueSizeClass(value)} mt-2 font-extrabold leading-tight tabular-nums`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{count} registros</p>
    </div>
  );
}

function ReportSection({ section }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-950">{section.title}</h3>
          <p className="text-xs text-slate-500">{section.items.length} registros encontrados.</p>
        </div>
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
              <tr key={`${section.key}-${mov.id}`} className="border-t align-top hover:bg-slate-50">
                <td className="p-3 text-slate-500">{formatDate(mov.fechaMovimiento)}</td>
                <td className="p-3 font-semibold text-slate-900">{mov.concepto}</td>
                <td className="p-3 text-slate-600">{mov.referencia || mov.cliente?.nombre || '-'}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${estadoStyles[mov.estado] || 'bg-slate-100 text-slate-700'}`}>{mov.estado}</span></td>
                <td className="p-3 text-right font-bold tabular-nums">{formatUsd(mov.montoUsd)}</td>
                <td className="p-3 text-right">{mov.tasaBcv || '-'}</td>
                <td className="p-3 text-right tabular-nums">{formatBs(mov.montoBs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
