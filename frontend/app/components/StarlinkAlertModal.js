"use client";

const formatDate = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-VE', { timeZone: 'UTC' });
};

const dayLabel = (diasRestantes) => {
  const days = Number(diasRestantes);
  if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `Vence en ${days} días`;
};

export default function StarlinkAlertModal({ alertas = [], onClose, onOpenStarlink }) {
  const proximas = alertas
    .filter((alerta) => Number(alerta.diasRestantes) <= 10)
    .sort((a, b) => Number(a.diasRestantes) - Number(b.diasRestantes));

  if (!proximas.length) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-[min(720px,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase text-red-700">Alertas Starlink</p>
              <h3 className="text-xl font-extrabold text-slate-950">Cortes críticos</h3>
              <p className="text-sm text-slate-500">Antenas vencidas o con corte dentro de los próximos 10 días.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">
              Cerrar
            </button>
          </div>
        </div>

        <div className="max-h-[54vh] overflow-y-auto p-5">
          <div className="space-y-3">
            {proximas.map((alerta) => (
              <div key={alerta.cuentaId} className="rounded-xl border border-red-400 bg-red-100 p-4 text-red-950 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-extrabold text-slate-950">{alerta.nombreCuenta}</p>
                    <p className="text-sm text-slate-600">{alerta.cliente?.nombre || 'Sin cliente'} / {alerta.correoCuenta || 'Sin correo asociado'}</p>
                  </div>
                  <span className="rounded-full bg-red-700 px-3 py-1 text-xs font-extrabold text-white">{dayLabel(alerta.diasRestantes)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <Info label="Fecha corte" value={formatDate(alerta.fechaCorte)} />
                  <Info label="Antenas" value={alerta.cantidadAntenas || 0} />
                  <Info label="Estado pago" value={alerta.estadoPago || 'PENDIENTE'} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
            Recordar luego
          </button>
          <button type="button" onClick={onOpenStarlink} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-slate-800">
            Ver Starlink
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2">
      <p className="text-[10px] font-extrabold uppercase text-slate-400">{label}</p>
      <p className="truncate font-bold text-slate-800">{value}</p>
    </div>
  );
}
