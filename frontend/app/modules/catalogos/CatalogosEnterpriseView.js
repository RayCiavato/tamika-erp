"use client";

import { useEffect, useMemo, useState } from 'react';
import currency from 'currency.js';

const emptyServicio = {
  id: '',
  codigoServicio: '',
  nombre: '',
  descripcion: '',
  tipoServicioId: '',
  tipoServicioNombre: '',
  precioUsd: '',
  activo: true,
};

const emptyProducto = {
  id: '',
  codigoProducto: '',
  nombre: '',
  descripcion: '',
  tipoProductoId: '',
  tipoProductoNombre: '',
  precioUsd: '',
  stock: '',
  activo: true,
};

const emptyProveedor = {
  id: '',
  codigoProveedor: '',
  nombre: '',
  rif: '',
  direccion: '',
  telefono: '',
  email: '',
  tipoEmpresa: '',
  activo: true,
};

const formatUsd = (value) => currency(value || 0, { symbol: '$', separator: '.', decimal: ',' }).format();

const tabs = [
  { id: 'servicios', label: 'Servicios' },
  { id: 'productos', label: 'Productos' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'tipos', label: 'Tipos' },
];

export default function CatalogosEnterpriseView({ apiFetch = fetch, initialTab = 'servicios', compact = false }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [servicios, setServicios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [tiposProducto, setTiposProducto] = useState([]);
  const [servicioForm, setServicioForm] = useState(emptyServicio);
  const [productoForm, setProductoForm] = useState(emptyProducto);
  const [proveedorForm, setProveedorForm] = useState(emptyProveedor);
  const [tipoServicioForm, setTipoServicioForm] = useState({ nombre: '', descripcion: '' });
  const [tipoProductoForm, setTipoProductoForm] = useState({ nombre: '', descripcion: '' });
  const [buscar, setBuscar] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => setActiveTab(initialTab), [initialTab]);

  const readJson = async (res, fallback) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || fallback);
    return data;
  };

  const cargarCatalogos = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const [serviciosRes, productosRes, proveedoresRes, tiposServicioRes, tiposProductoRes] = await Promise.all([
        apiFetch('/api/servicios'),
        apiFetch('/api/productos'),
        apiFetch('/api/proveedores'),
        apiFetch('/api/tipos-servicio'),
        apiFetch('/api/tipos-producto'),
      ]);
      const [serviciosData, productosData, proveedoresData, tiposServicioData, tiposProductoData] = await Promise.all([
        readJson(serviciosRes, 'No se pudieron cargar los servicios.'),
        readJson(productosRes, 'No se pudieron cargar los productos.'),
        readJson(proveedoresRes, 'No se pudieron cargar los proveedores.'),
        readJson(tiposServicioRes, 'No se pudieron cargar los tipos de servicio.'),
        readJson(tiposProductoRes, 'No se pudieron cargar los tipos de producto.'),
      ]);
      setServicios(Array.isArray(serviciosData) ? serviciosData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      setProveedores(Array.isArray(proveedoresData) ? proveedoresData : []);
      setTiposServicio(Array.isArray(tiposServicioData) ? tiposServicioData : []);
      setTiposProducto(Array.isArray(tiposProductoData) ? tiposProductoData : []);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCatalogos();
  }, []);

  const filtered = useMemo(() => {
    const term = buscar.trim().toLowerCase();
    const match = (value) => (value || '').toString().toLowerCase().includes(term);
    const filterRows = (rows, fields) => !term ? rows : rows.filter((row) => fields.some((field) => match(row[field])));
    return {
      servicios: filterRows(servicios, ['codigoServicio', 'nombre', 'descripcion']),
      productos: filterRows(productos, ['codigoProducto', 'nombre', 'descripcion']),
      proveedores: filterRows(proveedores, ['codigoProveedor', 'nombre', 'rif', 'tipoEmpresa']),
    };
  }, [buscar, servicios, productos, proveedores]);

  const resetForms = () => {
    setServicioForm(emptyServicio);
    setProductoForm(emptyProducto);
    setProveedorForm(emptyProveedor);
    setTipoServicioForm({ nombre: '', descripcion: '' });
    setTipoProductoForm({ nombre: '', descripcion: '' });
  };

  const saveServicio = async (event) => {
    event.preventDefault();
    setMensaje('');
    try {
      const payload = {
        ...servicioForm,
        tipoServicioId: servicioForm.tipoServicioNombre ? null : servicioForm.tipoServicioId,
      };
      const url = servicioForm.id ? `/api/servicios/${servicioForm.id}` : '/api/servicios';
      const res = await apiFetch(url, {
        method: servicioForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJson(res, 'No se pudo guardar el servicio.');
      setServicioForm(emptyServicio);
      await cargarCatalogos();
      setMensaje('Servicio guardado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const saveProducto = async (event) => {
    event.preventDefault();
    setMensaje('');
    try {
      const payload = {
        ...productoForm,
        tipoProductoId: productoForm.tipoProductoNombre ? null : productoForm.tipoProductoId,
      };
      const url = productoForm.id ? `/api/productos/${productoForm.id}` : '/api/productos';
      const res = await apiFetch(url, {
        method: productoForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await readJson(res, 'No se pudo guardar el producto.');
      setProductoForm(emptyProducto);
      await cargarCatalogos();
      setMensaje('Producto guardado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const saveProveedor = async (event) => {
    event.preventDefault();
    setMensaje('');
    try {
      const url = proveedorForm.id ? `/api/proveedores/${proveedorForm.id}` : '/api/proveedores';
      const res = await apiFetch(url, {
        method: proveedorForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proveedorForm),
      });
      await readJson(res, 'No se pudo guardar el proveedor.');
      setProveedorForm(emptyProveedor);
      await cargarCatalogos();
      setMensaje('Proveedor guardado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const saveTipo = async (kind, event) => {
    event.preventDefault();
    const isServicio = kind === 'servicio';
    const form = isServicio ? tipoServicioForm : tipoProductoForm;
    const endpoint = isServicio ? '/api/tipos-servicio' : '/api/tipos-producto';
    if (!form.nombre.trim()) return setMensaje('El nombre del tipo es obligatorio.');
    try {
      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      await readJson(res, 'No se pudo guardar el tipo.');
      if (isServicio) setTipoServicioForm({ nombre: '', descripcion: '' });
      else setTipoProductoForm({ nombre: '', descripcion: '' });
      await cargarCatalogos();
      setMensaje('Tipo guardado.');
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const deactivate = async (endpoint, label) => {
    if (!confirm(`Desactivar ${label}?`)) return;
    try {
      const res = await apiFetch(endpoint, { method: 'DELETE' });
      await readJson(res, 'No se pudo desactivar.');
      await cargarCatalogos();
      setMensaje(`${label} desactivado.`);
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const autoCode = async (kind) => {
    const endpoint = kind === 'servicio'
      ? '/api/servicios/siguiente-codigo'
      : kind === 'producto'
        ? '/api/productos/siguiente-codigo'
        : '/api/proveedores/siguiente-codigo';
    const res = await apiFetch(endpoint);
    const data = await readJson(res, 'No se pudo generar el codigo.');
    if (kind === 'servicio') setServicioForm((prev) => ({ ...prev, codigoServicio: data.codigoServicio || '' }));
    if (kind === 'producto') setProductoForm((prev) => ({ ...prev, codigoProducto: data.codigoProducto || '' }));
    if (kind === 'proveedor') setProveedorForm((prev) => ({ ...prev, codigoProveedor: data.codigoProveedor || '' }));
  };

  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">Catálogos enterprise</h2>
          <p className="text-sm text-slate-500">Productos, servicios, proveedores y tipos administrables por API.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar..." className="input min-w-[220px]" />
          <button type="button" onClick={resetForms} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Limpiar</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mensaje && <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">{mensaje}</div>}
      {loading && <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm font-semibold text-indigo-700">Cargando catálogos...</div>}

      {activeTab === 'servicios' && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <CatalogForm title={servicioForm.id ? 'Editar servicio' : 'Crear servicio'} onSubmit={saveServicio}>
            <CodeField label="Código servicio" value={servicioForm.codigoServicio} onChange={(value) => setServicioForm((prev) => ({ ...prev, codigoServicio: value }))} onAuto={() => autoCode('servicio')} />
            <Field label="Nombre"><input required value={servicioForm.nombre} onChange={(e) => setServicioForm((prev) => ({ ...prev, nombre: e.target.value }))} className="input" /></Field>
            <Field label="Tipo de servicio">
              <select value={servicioForm.tipoServicioId} onChange={(e) => setServicioForm((prev) => ({ ...prev, tipoServicioId: e.target.value, tipoServicioNombre: '' }))} className="input">
                <option value="">Sin tipo</option>
                {tiposServicio.filter((tipo) => tipo.activo).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
              </select>
            </Field>
            <Field label="Nuevo tipo rápido"><input value={servicioForm.tipoServicioNombre} onChange={(e) => setServicioForm((prev) => ({ ...prev, tipoServicioNombre: e.target.value, tipoServicioId: '' }))} placeholder="Ej: Monitoreo" className="input" /></Field>
            <Field label="Precio USD"><input type="number" min="0" step="0.01" value={servicioForm.precioUsd} onChange={(e) => setServicioForm((prev) => ({ ...prev, precioUsd: e.target.value }))} className="input" /></Field>
            <Field label="Descripción"><textarea value={servicioForm.descripcion} onChange={(e) => setServicioForm((prev) => ({ ...prev, descripcion: e.target.value }))} rows={3} className="input resize-y" /></Field>
            <CheckField label="Activo" checked={servicioForm.activo} onChange={(value) => setServicioForm((prev) => ({ ...prev, activo: value }))} />
          </CatalogForm>

          <DataTable headers={['Código', 'Servicio', 'Tipo', 'Precio', 'Estado', 'Acciones']}>
            {filtered.servicios.map((servicio) => (
              <tr key={servicio.id} className="border-b last:border-b-0">
                <td className="p-3 font-mono text-xs font-bold text-slate-600">{servicio.codigoServicio || '-'}</td>
                <td className="p-3"><p className="font-bold">{servicio.nombre}</p><p className="text-xs text-slate-500">{servicio.descripcion || '-'}</p></td>
                <td className="p-3">{servicio.tipoServicio?.nombre || '-'}</td>
                <td className="p-3 font-bold">{formatUsd(servicio.precioUsd)}</td>
                <td className="p-3"><Status active={servicio.activo} /></td>
                <td className="p-3 text-right"><RowActions onEdit={() => setServicioForm({ ...emptyServicio, ...servicio, tipoServicioId: servicio.tipoServicioId || '', precioUsd: servicio.precioUsd?.toString() || '' })} onDelete={() => deactivate(`/api/servicios/${servicio.id}`, servicio.nombre)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {activeTab === 'productos' && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <CatalogForm title={productoForm.id ? 'Editar producto' : 'Crear producto'} onSubmit={saveProducto}>
            <CodeField label="Código producto" value={productoForm.codigoProducto} onChange={(value) => setProductoForm((prev) => ({ ...prev, codigoProducto: value }))} onAuto={() => autoCode('producto')} />
            <Field label="Nombre"><input required value={productoForm.nombre} onChange={(e) => setProductoForm((prev) => ({ ...prev, nombre: e.target.value }))} className="input" /></Field>
            <Field label="Tipo de producto">
              <select value={productoForm.tipoProductoId} onChange={(e) => setProductoForm((prev) => ({ ...prev, tipoProductoId: e.target.value, tipoProductoNombre: '' }))} className="input">
                <option value="">Sin tipo</option>
                {tiposProducto.filter((tipo) => tipo.activo).map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
              </select>
            </Field>
            <Field label="Nuevo tipo rápido"><input value={productoForm.tipoProductoNombre} onChange={(e) => setProductoForm((prev) => ({ ...prev, tipoProductoNombre: e.target.value, tipoProductoId: '' }))} placeholder="Ej: Firewall" className="input" /></Field>
            <Field label="Precio USD"><input type="number" min="0" step="0.01" value={productoForm.precioUsd} onChange={(e) => setProductoForm((prev) => ({ ...prev, precioUsd: e.target.value }))} className="input" /></Field>
            <Field label="Stock"><input type="number" min="0" step="1" value={productoForm.stock} onChange={(e) => setProductoForm((prev) => ({ ...prev, stock: e.target.value }))} className="input" /></Field>
            <Field label="Descripción"><textarea value={productoForm.descripcion} onChange={(e) => setProductoForm((prev) => ({ ...prev, descripcion: e.target.value }))} rows={3} className="input resize-y" /></Field>
            <CheckField label="Activo" checked={productoForm.activo} onChange={(value) => setProductoForm((prev) => ({ ...prev, activo: value }))} />
          </CatalogForm>

          <DataTable headers={['Código', 'Producto', 'Tipo', 'Precio', 'Stock', 'Acciones']}>
            {filtered.productos.map((producto) => (
              <tr key={producto.id} className="border-b last:border-b-0">
                <td className="p-3 font-mono text-xs font-bold text-slate-600">{producto.codigoProducto || '-'}</td>
                <td className="p-3"><p className="font-bold">{producto.nombre}</p><p className="text-xs text-slate-500">{producto.descripcion || '-'}</p></td>
                <td className="p-3">{producto.tipoProducto?.nombre || '-'}</td>
                <td className="p-3 font-bold">{formatUsd(producto.precioUsd)}</td>
                <td className="p-3">{producto.stock ?? '-'}</td>
                <td className="p-3 text-right"><RowActions onEdit={() => setProductoForm({ ...emptyProducto, ...producto, tipoProductoId: producto.tipoProductoId || '', precioUsd: producto.precioUsd?.toString() || '', stock: producto.stock?.toString() || '' })} onDelete={() => deactivate(`/api/productos/${producto.id}`, producto.nombre)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {activeTab === 'proveedores' && (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <CatalogForm title={proveedorForm.id ? 'Editar proveedor' : 'Crear proveedor'} onSubmit={saveProveedor}>
            <CodeField label="Código proveedor" value={proveedorForm.codigoProveedor} onChange={(value) => setProveedorForm((prev) => ({ ...prev, codigoProveedor: value }))} onAuto={() => autoCode('proveedor')} />
            <Field label="Nombre / empresa"><input required value={proveedorForm.nombre} onChange={(e) => setProveedorForm((prev) => ({ ...prev, nombre: e.target.value }))} className="input" /></Field>
            <Field label="RIF"><input value={proveedorForm.rif} onChange={(e) => setProveedorForm((prev) => ({ ...prev, rif: e.target.value }))} className="input" /></Field>
            <Field label="Tipo empresa"><input value={proveedorForm.tipoEmpresa} onChange={(e) => setProveedorForm((prev) => ({ ...prev, tipoEmpresa: e.target.value }))} placeholder="Ej: Integrador" className="input" /></Field>
            <Field label="Teléfono"><input value={proveedorForm.telefono} onChange={(e) => setProveedorForm((prev) => ({ ...prev, telefono: e.target.value }))} className="input" /></Field>
            <Field label="Email"><input type="email" value={proveedorForm.email} onChange={(e) => setProveedorForm((prev) => ({ ...prev, email: e.target.value }))} className="input" /></Field>
            <Field label="Dirección"><textarea value={proveedorForm.direccion} onChange={(e) => setProveedorForm((prev) => ({ ...prev, direccion: e.target.value }))} rows={3} className="input resize-y" /></Field>
            <CheckField label="Activo" checked={proveedorForm.activo} onChange={(value) => setProveedorForm((prev) => ({ ...prev, activo: value }))} />
          </CatalogForm>

          <DataTable headers={['Código', 'Proveedor', 'RIF', 'Contacto', 'Estado', 'Acciones']}>
            {filtered.proveedores.map((proveedor) => (
              <tr key={proveedor.id} className="border-b last:border-b-0">
                <td className="p-3 font-mono text-xs font-bold text-slate-600">{proveedor.codigoProveedor || '-'}</td>
                <td className="p-3"><p className="font-bold">{proveedor.nombre}</p><p className="text-xs text-slate-500">{proveedor.tipoEmpresa || '-'}</p></td>
                <td className="p-3">{proveedor.rif || '-'}</td>
                <td className="p-3"><p>{proveedor.telefono || '-'}</p><p className="text-xs text-slate-500">{proveedor.email || ''}</p></td>
                <td className="p-3"><Status active={proveedor.activo} /></td>
                <td className="p-3 text-right"><RowActions onEdit={() => setProveedorForm({ ...emptyProveedor, ...proveedor })} onDelete={() => deactivate(`/api/proveedores/${proveedor.id}`, proveedor.nombre)} /></td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      {activeTab === 'tipos' && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <TipoManager title="Tipos de servicio" form={tipoServicioForm} setForm={setTipoServicioForm} rows={tiposServicio} onSubmit={(event) => saveTipo('servicio', event)} onDelete={(row) => deactivate(`/api/tipos-servicio/${row.id}`, row.nombre)} />
          <TipoManager title="Tipos de producto" form={tipoProductoForm} setForm={setTipoProductoForm} rows={tiposProducto} onSubmit={(event) => saveTipo('producto', event)} onDelete={(row) => deactivate(`/api/tipos-producto/${row.id}`, row.nombre)} />
        </div>
      )}
    </section>
  );
}

function CatalogForm({ title, onSubmit, children }) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-4 text-sm font-extrabold uppercase text-slate-600">{title}</h3>
      <div className="grid grid-cols-1 gap-3">{children}</div>
      <button className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow hover:bg-emerald-500">Guardar</button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="text-xs font-bold text-slate-500">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function CodeField({ label, value, onChange, onAuto }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} className="input font-mono" />
        <button type="button" onClick={onAuto} className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100">Auto</button>
      </div>
    </Field>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
      {label}
    </label>
  );
}

function DataTable({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className="p-3">{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Status({ active }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{active ? 'Activo' : 'Inactivo'}</span>;
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onEdit} className="text-xs font-bold text-blue-600">Editar</button>
      <button type="button" onClick={onDelete} className="text-xs font-bold text-red-600">Desactivar</button>
    </div>
  );
}

function TipoManager({ title, form, setForm, rows, onSubmit, onDelete }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-extrabold uppercase text-slate-600">{title}</h3>
      <form onSubmit={onSubmit} className="mt-3 grid grid-cols-1 gap-3">
        <Field label="Nombre"><input required value={form.nombre} onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))} className="input" /></Field>
        <Field label="Descripción"><input value={form.descripcion} onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))} className="input" /></Field>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">Agregar tipo</button>
      </form>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="font-bold text-slate-900">{row.nombre}</p>
              <p className="text-xs text-slate-500">{row.descripcion || '-'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Status active={row.activo} />
              {row.activo && <button type="button" onClick={() => onDelete(row)} className="text-xs font-bold text-red-600">Desactivar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
