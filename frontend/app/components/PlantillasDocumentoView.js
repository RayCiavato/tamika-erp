"use client";

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

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

export default function PlantillasDocumentoView({ apiFetch = fetch, plantillas = [], onChanged }) {
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
              <ReactQuill theme="snow" value={form.contenidoPropuesta} onChange={(value) => updateForm('contenidoPropuesta', value)} className="bg-white min-h-[220px] pb-10" />
            </EditorBlock>
            <EditorBlock title="Terminos y condiciones" subtitle="Se carga en la seccion final del documento.">
              <ReactQuill theme="snow" value={form.condiciones} onChange={(value) => updateForm('condiciones', value)} className="bg-white min-h-[220px] pb-10" />
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
