"use client";

import { useEffect, useState } from 'react';

const DEFAULT_FORM = {
  nombre: '',
  email: '',
  password: '',
  rol: 'USUARIO',
  activo: true,
};

export default function UsuariosView({ apiFetch }) {
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);

  const cargarUsuarios = async () => {
    setLoading(true);
    setMensaje('');
    try {
      const res = await apiFetch('/api/usuarios');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los usuarios.');
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (error) {
      setMensaje(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const limpiar = () => {
    setEditandoId(null);
    setForm(DEFAULT_FORM);
    setMensaje('');
  };

  const editar = (usuario) => {
    setEditandoId(usuario.id);
    setForm({
      nombre: usuario.nombre || '',
      email: usuario.email || '',
      password: '',
      rol: usuario.rol || 'USUARIO',
      activo: usuario.activo !== false,
    });
    setMensaje('');
  };

  const guardarUsuario = async (event) => {
    event.preventDefault();
    setMensaje('');

    const payload = {
      nombre: form.nombre,
      email: form.email,
      rol: form.rol,
      activo: form.activo,
      ...(form.password ? { password: form.password } : {}),
    };

    if (!editandoId && !form.password) {
      setMensaje('La contraseña es obligatoria para crear usuarios.');
      return;
    }

    try {
      const res = await apiFetch(editandoId ? `/api/usuarios/${editandoId}` : '/api/usuarios', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el usuario.');
      limpiar();
      await cargarUsuarios();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  const cambiarEstado = async (usuario) => {
    const activo = !usuario.activo;
    if (!confirm(`¿Deseas ${activo ? 'activar' : 'desactivar'} a ${usuario.nombre}?`)) return;
    setMensaje('');
    try {
      const res = await apiFetch(`/api/usuarios/${usuario.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar el estado del usuario.');
      await cargarUsuarios();
    } catch (error) {
      setMensaje(error.message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-950">Usuarios</h2>
        <p className="text-sm text-slate-500">Administración de accesos del sistema.</p>
      </div>

      <form onSubmit={guardarUsuario} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <label className="text-xs font-bold uppercase text-slate-500">Nombre</label>
          <input required value={form.nombre} onChange={(e) => updateForm('nombre', e.target.value)} className="input mt-1" />
        </div>
        <div className="xl:col-span-2">
          <label className="text-xs font-bold uppercase text-slate-500">Email</label>
          <input required type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="input mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-500">Rol</label>
          <select value={form.rol} onChange={(e) => updateForm('rol', e.target.value)} className="input mt-1">
            <option value="USUARIO">Usuario</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold uppercase text-slate-500">Estado</label>
          <select value={form.activo ? 'true' : 'false'} onChange={(e) => updateForm('activo', e.target.value === 'true')} className="input mt-1">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <label className="text-xs font-bold uppercase text-slate-500">Contraseña</label>
          <input type="password" minLength={8} value={form.password} onChange={(e) => updateForm('password', e.target.value)} className="input mt-1" required={!editandoId} />
        </div>
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">{editandoId ? 'Actualizar' : 'Crear usuario'}</button>
          {editandoId && <button type="button" onClick={limpiar} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>}
        </div>
      </form>

      {mensaje && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{mensaje}</div>}
      {loading && <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Cargando usuarios...</div>}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Usuario</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Creado</th>
                <th className="p-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && <tr><td colSpan={5} className="p-5 text-center text-slate-500">Sin usuarios.</td></tr>}
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className="border-t align-top">
                  <td className="p-3">
                    <p className="font-bold text-slate-900">{usuario.nombre}</p>
                    <p className="text-xs text-slate-500">{usuario.email}</p>
                  </td>
                  <td className="p-3">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{usuario.rol}</span>
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${usuario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{usuario.createdAt ? new Date(usuario.createdAt).toLocaleDateString('es-VE') : '-'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => editar(usuario)} className="mr-3 text-xs font-bold text-blue-600">Editar</button>
                    <button onClick={() => cambiarEstado(usuario)} className={`text-xs font-bold ${usuario.activo ? 'text-red-600' : 'text-emerald-700'}`}>
                      {usuario.activo ? 'Desactivar' : 'Activar'}
                    </button>
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
