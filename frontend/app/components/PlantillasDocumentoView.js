"use client";

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(async () => {
  const { default: Quill } = await import('react-quill-new');
  const QuillEditor = ({ forwardedRef, ...props }) => <Quill ref={forwardedRef} {...props} />;
  QuillEditor.displayName = 'QuillEditor';
  return QuillEditor;
}, { ssr: false });

const tipoOptions = [
  { value: 'AMBOS', label: 'Propuestas y presupuestos' },
  { value: 'PROPUESTA', label: 'Solo propuestas' },
  { value: 'PRESUPUESTO', label: 'Solo presupuestos' },
];

const emptyForm = {
  id: null,
  nombre: '',
  tipoDocumento: 'AMBOS',
  descripcion: '',
  titulo: '',
  proyecto: '',
  contenidoPropuesta: '',
  condiciones: '',
  activo: true,
};

const tipoLabel = (value) => tipoOptions.find((option) => option.value === value)?.label || value || 'Plantilla';

const snippets = [
  {
    id: 'cuadro-info',
    label: 'Cuadro info',
    html: '<table style="width:100%; border-collapse:collapse; margin:8px 0;"><tbody><tr><td style="border:1px solid #cbd5e1; background-color:#f8fafc; padding:10px;"><p><strong>Informacion relevante</strong></p><p>Describe aqui el contexto, alcance o consideraciones especiales del documento.</p></td></tr></tbody></table><p><br></p>',
  },
  {
    id: 'tabla-2',
    label: 'Tabla 2 columnas',
    html: '<table style="width:100%; border-collapse:collapse; margin:8px 0;"><tbody><tr><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Concepto</th><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Detalle</th></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">Alcance</td><td style="border:1px solid #cbd5e1; padding:8px;">Describe el alcance del servicio o suministro.</td></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">Tiempo estimado</td><td style="border:1px solid #cbd5e1; padding:8px;">Indica el tiempo de ejecucion.</td></tr></tbody></table><p><br></p>',
  },
  {
    id: 'tabla-3',
    label: 'Tabla 3 columnas',
    html: '<table style="width:100%; border-collapse:collapse; margin:8px 0;"><tbody><tr><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Item</th><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Descripcion</th><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Responsable</th></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">01</td><td style="border:1px solid #cbd5e1; padding:8px;">Actividad principal.</td><td style="border:1px solid #cbd5e1; padding:8px;">Tamika / Cliente</td></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">02</td><td style="border:1px solid #cbd5e1; padding:8px;">Actividad complementaria.</td><td style="border:1px solid #cbd5e1; padding:8px;">Tamika</td></tr></tbody></table><p><br></p>',
  },
  {
    id: 'alcance',
    label: 'Alcance',
    html: '<table style="width:100%; border-collapse:collapse; margin:8px 0;"><tbody><tr><td style="border:1px solid #94a3b8; background-color:#f1f5f9; padding:10px;"><p><strong>Alcance del servicio</strong></p><ul><li>Levantamiento y validacion de requerimientos.</li><li>Planificacion de actividades y recursos.</li><li>Ejecucion de los trabajos incluidos en la propuesta.</li><li>Pruebas funcionales, entrega y cierre documentado.</li></ul></td></tr></tbody></table><p><br></p>',
  },
  {
    id: 'entregables',
    label: 'Entregables',
    html: '<table style="width:100%; border-collapse:collapse; margin:8px 0;"><tbody><tr><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Entregable</th><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Criterio de aceptacion</th></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">Configuracion implementada</td><td style="border:1px solid #cbd5e1; padding:8px;">Servicio operativo y validado por el cliente.</td></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">Documentacion de cierre</td><td style="border:1px solid #cbd5e1; padding:8px;">Registro de actividades, evidencias y recomendaciones.</td></tr></tbody></table><p><br></p>',
  },
  {
    id: 'cronograma',
    label: 'Cronograma',
    html: '<table style="width:100%; border-collapse:collapse; margin:8px 0;"><tbody><tr><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Fase</th><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Actividad</th><th style="border:1px solid #cbd5e1; background-color:#e2e8f0; padding:8px; text-align:left;">Duracion</th></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">01</td><td style="border:1px solid #cbd5e1; padding:8px;">Inicio, levantamiento y coordinacion.</td><td style="border:1px solid #cbd5e1; padding:8px;">1 dia habil</td></tr><tr><td style="border:1px solid #cbd5e1; padding:8px;">02</td><td style="border:1px solid #cbd5e1; padding:8px;">Ejecucion tecnica y pruebas.</td><td style="border:1px solid #cbd5e1; padding:8px;">Segun alcance</td></tr></tbody></table><p><br></p>',
  },
];

const tableActions = [
  { id: 'row-above', label: 'Fila arriba' },
  { id: 'row-below', label: 'Fila abajo' },
  { id: 'col-left', label: 'Col. izquierda' },
  { id: 'col-right', label: 'Col. derecha' },
  { id: 'delete-row', label: 'Eliminar fila' },
  { id: 'delete-col', label: 'Eliminar col.' },
  { id: 'merge-right', label: 'Unir derecha' },
  { id: 'merge-down', label: 'Unir abajo' },
  { id: 'split-cell', label: 'Dividir celda' },
  { id: 'delete-table', label: 'Eliminar tabla' },
];

const cellStyle = 'border:1px solid #cbd5e1; padding:8px; vertical-align:top;';
const headerCellStyle = `${cellStyle} background-color:#e2e8f0; text-align:left; font-weight:700;`;

const normalizeCell = (cell) => {
  if (!cell) return;
  const header = cell.tagName === 'TH';
  cell.setAttribute('style', header ? headerCellStyle : cellStyle);
  if (!cell.innerHTML.trim()) cell.innerHTML = '<p><br></p>';
};

const createCell = (doc, header = false) => {
  const cell = doc.createElement(header ? 'th' : 'td');
  cell.innerHTML = '<p><br></p>';
  normalizeCell(cell);
  return cell;
};

const selectedCellFromEditor = (editor) => {
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
  const cell = element?.closest?.('td, th');
  return cell && editor.root.contains(cell) ? cell : null;
};

const colStartForCell = (row, targetCell) => {
  let index = 0;
  for (const cell of Array.from(row.cells)) {
    if (cell === targetCell) return index;
    index += Number(cell.colSpan || 1);
  }
  return 0;
};

const cellAtColumn = (row, targetColumn) => {
  let index = 0;
  for (const cell of Array.from(row.cells)) {
    const span = Number(cell.colSpan || 1);
    if (targetColumn >= index && targetColumn < index + span) return { cell, start: index, span };
    index += span;
  }
  return { cell: null, start: index, span: 1 };
};

const tableColumnCount = (table) => Array.from(table.rows).reduce((max, row) => {
  const count = Array.from(row.cells).reduce((total, cell) => total + Number(cell.colSpan || 1), 0);
  return Math.max(max, count);
}, 0);

export default function PlantillasDocumentoView({ apiFetch = fetch, plantillas = [], onChanged }) {
  const contenidoEditorRef = useRef(null);
  const condicionesEditorRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [buscar, setBuscar] = useState('');

  const readJson = async (res, fallback) => {
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.details?.join('\n') || data?.error || fallback);
    return data;
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const insertarBloque = (field, html) => {
    const ref = field === 'condiciones' ? condicionesEditorRef : contenidoEditorRef;
    const editor = ref.current?.getEditor?.();

    if (!editor) {
      updateForm(field, `${form[field] || ''}${html}`);
      return;
    }

    const range = editor.getSelection(true);
    const index = range?.index ?? Math.max(editor.getLength() - 1, 0);
    editor.clipboard.dangerouslyPasteHTML(index, html, 'user');
    updateForm(field, editor.root.innerHTML);
  };

  const ejecutarAccionTabla = (field, action) => {
    const ref = field === 'condiciones' ? condicionesEditorRef : contenidoEditorRef;
    const editor = ref.current?.getEditor?.();
    const cell = editor ? selectedCellFromEditor(editor) : null;

    if (!editor || !cell) {
      setMensaje('Selecciona una celda de una tabla para usar la edicion avanzada.');
      return;
    }

    const table = cell.closest('table');
    const row = cell.closest('tr');
    const doc = cell.ownerDocument;
    const columnIndex = colStartForCell(row, cell);
    const sync = () => {
      table?.querySelectorAll('td, th').forEach(normalizeCell);
      updateForm(field, editor.root.innerHTML);
      editor.focus();
    };

    if (action === 'row-above' || action === 'row-below') {
      const newRow = doc.createElement('tr');
      Array.from(row.cells).forEach((sourceCell) => {
        const newCell = createCell(doc, false);
        const colSpan = Number(sourceCell.colSpan || 1);
        if (colSpan > 1) newCell.colSpan = colSpan;
        newRow.appendChild(newCell);
      });
      row.parentNode.insertBefore(newRow, action === 'row-above' ? row : row.nextSibling);
      sync();
      return;
    }

    if (action === 'col-left' || action === 'col-right') {
      const insertColumn = columnIndex + (action === 'col-right' ? Number(cell.colSpan || 1) : 0);
      Array.from(table.rows).forEach((currentRow) => {
        const info = cellAtColumn(currentRow, insertColumn);
        if (info.cell && insertColumn > info.start && insertColumn < info.start + info.span) {
          info.cell.colSpan = info.span + 1;
          return;
        }

        const header = Array.from(currentRow.cells).every((item) => item.tagName === 'TH');
        const newCell = createCell(doc, header);
        if (info.cell && insertColumn <= info.start) {
          currentRow.insertBefore(newCell, info.cell);
        } else {
          currentRow.appendChild(newCell);
        }
      });
      sync();
      return;
    }

    if (action === 'delete-row') {
      if (table.rows.length <= 1) table.remove();
      else row.remove();
      sync();
      return;
    }

    if (action === 'delete-col') {
      const totalColumns = tableColumnCount(table);
      if (totalColumns <= 1) {
        table.remove();
        sync();
        return;
      }
      Array.from(table.rows).forEach((currentRow) => {
        const info = cellAtColumn(currentRow, columnIndex);
        if (!info.cell) return;
        if (info.span > 1) info.cell.colSpan = info.span - 1;
        else info.cell.remove();
      });
      sync();
      return;
    }

    if (action === 'merge-right') {
      const nextCell = cell.nextElementSibling;
      if (!nextCell) {
        setMensaje('No hay una celda a la derecha para unificar.');
        return;
      }
      cell.colSpan = Number(cell.colSpan || 1) + Number(nextCell.colSpan || 1);
      cell.innerHTML = `${cell.innerHTML}${nextCell.innerHTML}`;
      nextCell.remove();
      sync();
      return;
    }

    if (action === 'merge-down') {
      const nextRow = row.nextElementSibling;
      const target = nextRow ? cellAtColumn(nextRow, columnIndex).cell : null;
      if (!target || Number(target.colSpan || 1) !== Number(cell.colSpan || 1)) {
        setMensaje('No hay una celda compatible debajo para unificar.');
        return;
      }
      cell.rowSpan = Number(cell.rowSpan || 1) + Number(target.rowSpan || 1);
      cell.innerHTML = `${cell.innerHTML}${target.innerHTML}`;
      target.remove();
      sync();
      return;
    }

    if (action === 'split-cell') {
      const colSpan = Number(cell.colSpan || 1);
      const rowSpan = Number(cell.rowSpan || 1);
      if (colSpan <= 1 && rowSpan <= 1) {
        setMensaje('La celda seleccionada no esta unificada.');
        return;
      }
      cell.colSpan = 1;
      cell.rowSpan = 1;
      for (let index = 1; index < colSpan; index += 1) {
        row.insertBefore(createCell(doc, cell.tagName === 'TH'), cell.nextSibling);
      }
      let targetRow = row.nextElementSibling;
      for (let index = 1; index < rowSpan && targetRow; index += 1) {
        const info = cellAtColumn(targetRow, columnIndex);
        targetRow.insertBefore(createCell(doc, cell.tagName === 'TH'), info.cell || null);
        targetRow = targetRow.nextElementSibling;
      }
      sync();
      return;
    }

    if (action === 'delete-table') {
      table.remove();
      sync();
    }
  };

  const limpiar = () => {
    setForm(emptyForm);
    setMensaje('');
  };

  const editar = (plantilla) => {
    setForm({
      id: plantilla.id,
      nombre: plantilla.nombre || '',
      tipoDocumento: plantilla.tipoDocumento || 'AMBOS',
      descripcion: plantilla.descripcion || '',
      titulo: plantilla.titulo || '',
      proyecto: plantilla.datosPdf?.proyecto || '',
      contenidoPropuesta: plantilla.contenidoPropuesta || '',
      condiciones: plantilla.condiciones || '',
      activo: plantilla.activo !== false,
    });
    setMensaje('');
  };

  const guardar = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMensaje('');

    try {
      const payload = {
        nombre: form.nombre,
        tipoDocumento: form.tipoDocumento,
        descripcion: form.descripcion,
        titulo: form.titulo,
        contenidoPropuesta: form.contenidoPropuesta,
        condiciones: form.condiciones,
        datosPdf: form.proyecto?.trim() ? { proyecto: form.proyecto.trim() } : null,
        activo: form.activo,
      };
      const res = await apiFetch(form.id ? `/api/plantillas-documento/${form.id}` : '/api/plantillas-documento', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJson(res, 'No se pudo guardar la plantilla.');
      setMensaje(form.id ? 'Plantilla actualizada.' : 'Plantilla creada.');
      setForm(emptyForm);
      onChanged?.();
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (plantilla) => {
    if (!confirm(`Eliminar la plantilla "${plantilla.nombre}"?`)) return;
    setMensaje('');

    try {
      const res = await apiFetch(`/api/plantillas-documento/${plantilla.id}`, { method: 'DELETE' });
      await readJson(res, 'No se pudo eliminar la plantilla.');
      if (form.id === plantilla.id) limpiar();
      onChanged?.();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const plantillasFiltradas = useMemo(() => {
    const term = buscar.trim().toLowerCase();
    if (!term) return plantillas;
    return plantillas.filter((plantilla) => [
      plantilla.nombre,
      plantilla.descripcion,
      plantilla.titulo,
      plantilla.tipoDocumento,
      plantilla.datosPdf?.proyecto,
    ].filter(Boolean).some((value) => value.toString().toLowerCase().includes(term)));
  }, [buscar, plantillas]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-teal-700">Documentos comerciales</p>
            <h2 className="text-2xl font-extrabold text-slate-950">Plantillas personalizadas</h2>
            <p className="text-sm text-slate-500">Crea bases reutilizables para propuestas y presupuestos.</p>
          </div>
          <button type="button" onClick={limpiar} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">
            Nueva plantilla
          </button>
        </div>

        {mensaje && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{mensaje}</div>}

        <form onSubmit={guardar} className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <p className="text-xs font-extrabold uppercase text-teal-700">Alta y edicion</p>
              <h3 className="text-lg font-extrabold text-slate-950">{form.id ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
            </div>
            <div className="space-y-3">
              <Field label="Nombre">
                <input required value={form.nombre} onChange={(event) => updateForm('nombre', event.target.value)} className="input mt-1" placeholder="Ej: Propuesta de instalacion" />
              </Field>
              <Field label="Aplica a">
                <select value={form.tipoDocumento} onChange={(event) => updateForm('tipoDocumento', event.target.value)} className="input mt-1">
                  {tipoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Titulo sugerido">
                <input value={form.titulo} onChange={(event) => updateForm('titulo', event.target.value)} className="input mt-1" placeholder="Ej: Instalacion y soporte especializado" />
              </Field>
              <Field label="Proyecto PDF">
                <textarea value={form.proyecto} onChange={(event) => updateForm('proyecto', event.target.value)} rows={2} className="input mt-1 resize-y" placeholder="Texto del proyecto que puede cargarse al PDF" />
              </Field>
              <Field label="Descripcion interna">
                <textarea value={form.descripcion} onChange={(event) => updateForm('descripcion', event.target.value)} rows={3} className="input mt-1 resize-y" placeholder="Uso recomendado de esta plantilla" />
              </Field>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={form.activo} onChange={(event) => updateForm('activo', event.target.checked)} className="h-4 w-4 accent-teal-600" />
                Activa para seleccion
              </label>
              <div className="flex gap-2 pt-2">
                <button disabled={saving} className="flex-1 rounded-lg bg-teal-700 px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-teal-600 disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar plantilla'}
                </button>
                {form.id && (
                  <button type="button" onClick={limpiar} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <EditorBlock title="Contenido interno" subtitle="Se aplica al bloque editable de propuestas.">
              <SnippetBar
                onInsert={(html) => insertarBloque('contenidoPropuesta', html)}
                onTableAction={(action) => ejecutarAccionTabla('contenidoPropuesta', action)}
              />
              <ReactQuill forwardedRef={contenidoEditorRef} theme="snow" value={form.contenidoPropuesta} onChange={(value) => updateForm('contenidoPropuesta', value)} className="bg-white min-h-[220px] pb-10" />
            </EditorBlock>
            <EditorBlock title="Terminos y condiciones" subtitle="Se carga en la seccion final del documento.">
              <SnippetBar
                onInsert={(html) => insertarBloque('condiciones', html)}
                onTableAction={(action) => ejecutarAccionTabla('condiciones', action)}
              />
              <ReactQuill forwardedRef={condicionesEditorRef} theme="snow" value={form.condiciones} onChange={(value) => updateForm('condiciones', value)} className="bg-white min-h-[220px] pb-10" />
            </EditorBlock>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-950">Plantillas guardadas</h3>
            <p className="text-sm text-slate-500">{plantillasFiltradas.length} registros disponibles.</p>
          </div>
          <input value={buscar} onChange={(event) => setBuscar(event.target.value)} className="input md:max-w-xs" placeholder="Buscar plantilla..." />
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Nombre</th>
                <th className="p-3">Aplica a</th>
                <th className="p-3">Titulo</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plantillasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">No hay plantillas registradas.</td>
                </tr>
              )}
              {plantillasFiltradas.map((plantilla) => (
                <tr key={plantilla.id} className="border-t align-top hover:bg-slate-50">
                  <td className="p-3">
                    <p className="font-extrabold text-slate-900">{plantilla.nombre}</p>
                    <p className="text-xs text-slate-500">{plantilla.descripcion || 'Sin descripcion'}</p>
                  </td>
                  <td className="p-3 text-slate-600">{tipoLabel(plantilla.tipoDocumento)}</td>
                  <td className="p-3 text-slate-600">{plantilla.titulo || '-'}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${plantilla.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                      {plantilla.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => editar(plantilla)} className="mr-3 text-xs font-bold text-blue-600">Editar</button>
                    <button type="button" onClick={() => eliminar(plantilla)} className="text-xs font-bold text-red-600">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-xs font-bold text-slate-500">
      {label}
      {children}
    </label>
  );
}

function EditorBlock({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-extrabold text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function SnippetBar({ onInsert, onTableAction }) {
  return (
    <div className="mb-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase text-slate-500">Bloques rapidos</p>
        <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-700">PDF ready</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {snippets.map((snippet) => (
          <button
            key={snippet.id}
            type="button"
            onClick={() => onInsert(snippet.html)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
          >
            {snippet.label}
          </button>
        ))}
      </div>
      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 text-xs font-extrabold uppercase text-slate-500">Edicion de tabla</p>
        <div className="flex flex-wrap gap-2">
          {tableActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onTableAction(action.id);
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${action.id === 'delete-table' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800'}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
