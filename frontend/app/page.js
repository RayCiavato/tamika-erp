"use client";
import { useCallback, useState, useEffect } from 'react';
import currency from 'currency.js';
import dynamic from 'next/dynamic';
import DashboardView from './components/DashboardView';
import ContabilidadView from './components/ContabilidadView';
import ReportesContablesView from './components/ReportesContablesView';
import AuditoriaView from './components/AuditoriaView';
import UsuariosView from './components/UsuariosView';
import StarlinkAlertModal from './components/StarlinkAlertModal';
import CatalogosEnterpriseView from './modules/catalogos/CatalogosEnterpriseView';
import NominaView from './modules/nomina/NominaView';
import StarlinkView from './modules/starlink/StarlinkView';
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

const DEFAULT_TERMS = `<p>Los servicios se rigen por los lineamientos de ISO/IEC 27001, NIST CSF.</p><br/><p><strong>Precios:</strong> Los precios est&aacute;n expresados en USD (D&oacute;lares) e incluyen el Impuesto al Valor Agregado (IVA), salvo que se indique lo contrario.</p><p><strong>Validez:</strong> Los precios son v&aacute;lidos &uacute;nicamente para este cliente y negociaci&oacute;n en particular.</p><p><strong>Financiamiento:</strong> Opci&oacute;n de pago en 3 cuotas mensuales (50% inicial y 2 cuotas de 25%) en bol&iacute;vares, calculadas al tipo de cambio oficial del Banco Central de Venezuela (BCV) vigente en la fecha de cada pago.</p><p><strong>Variaciones de Precio:</strong> El precio de todos los productos que componen esta propuesta est&aacute; sujeto a variaci&oacute;n sin previo aviso, seg&uacute;n las condiciones actuales del mercado.</p><p><strong>Aprobaci&oacute;n:</strong> La aprobaci&oacute;n debe ser enviada v&iacute;a correo electr&oacute;nico.</p><p><strong>Validez de la Oferta:</strong> Esta oferta tiene una validez de 07 d&iacute;as h&aacute;biles.</p><p><strong>Confidencialidad:</strong> La informaci&oacute;n relacionada con esta propuesta es absolutamente confidencial y para uso exclusivo de la empresa a quien va dirigida, quien se compromete a mantener y respetar la confidencialidad de la informaci&oacute;n.</p><p><strong>Recursos Humanos:</strong> La empresa que recibe la cotizaci&oacute;n se compromete a no efectuar ofrecimiento alguno de tipo laboral al personal asignado al servicio solicitado durante el desarrollo de este, y hasta por tres (3) a&ntilde;os contados a partir de la fecha de culminaci&oacute;n.</p><p><strong>Costo de Infraestructura:</strong> El costo de infraestructura necesario para la implementaci&oacute;n y funcionamiento del sistema correr&aacute; por cuenta del cliente.</p><p><strong>Garant&iacute;a de Servicio:</strong> Cualquier garant&iacute;a de servicio se especificar&aacute; en un acuerdo por separado y estar&aacute; sujeta a los t&eacute;rminos y condiciones acordados.</p><p><strong>Soporte T&eacute;cnico:</strong> El soporte t&eacute;cnico ser&aacute; proporcionado seg&uacute;n los t&eacute;rminos especificados en la propuesta y no incluye soporte adicional fuera del alcance definido sin un costo adicional.</p><p><strong>Modificaciones:</strong> Cualquier modificaci&oacute;n a los t&eacute;rminos de esta propuesta deber&aacute; ser acordada por ambas partes y documentada formalmente.</p><p><strong>Inicio de Labores:</strong> No se iniciar&aacute;n labores de ning&uacute;n tipo sin la respectiva Orden de Servicio y/o anticipo de EL CLIENTE.</p><p><strong>Impacto de Disposiciones Gubernamentales:</strong> Cualesquiera disposiciones de &iacute;ndole gubernamental cuyo impacto incida de manera directa en el estipendio de Servicios TAMIKA 0302, C.A. ser&aacute; considerado motivo para evaluar, conjuntamente, reajustes en las tarifas o cambios en los t&eacute;rminos comerciales.</p><p><strong>Servicios Incluidos:</strong> Esta oferta no incluye otros servicios o especialidades distintas a las expresamente se&ntilde;aladas.</p>`;
const DEFAULT_VIGENCIA = '15 días hábiles';
const DEFAULT_PROPUESTA_CONTENT = `<p><strong>1. Introducción</strong></p><p>Por medio de la presente, Servicios Tamika 0302, C.A. presenta su propuesta de servicios profesionales para la instalación, organización, configuración y puesta en marcha del servicio solicitado.</p><p>La presente propuesta está orientada a entregar una solución organizada, estable, escalable y documentada, alineada con buenas prácticas de infraestructura, seguridad, continuidad operativa y administración centralizada.</p><p><strong>2. Objetivo general</strong></p><p>Ejecutar la instalación, configuración, integración y puesta en producción de la solución requerida, garantizando un entorno ordenado, seguro y preparado para el crecimiento futuro.</p><p><strong>3. Alcance del servicio</strong></p><ul><li>Levantamiento y validación de requerimientos.</li><li>Planificación de actividades y recursos.</li><li>Ejecución de los servicios incluidos en la presente propuesta.</li><li>Pruebas funcionales, entrega y cierre documentado.</li></ul>`;
const DEFAULT_PDF_DATA = {
  clienteCodigo: '',
  clienteNombre: '',
  clienteRif: '',
  clienteDireccion: '',
  clienteTelefono: '',
  clienteEmail: '',
  empresaNombre: 'Servicios TAMIKA 0302, C.A.',
  empresaRif: 'J-50634330-4',
  empresaDireccion: 'Carretera Vieja Caracas - Baruta, Torre Gamma, Piso 9, Apto 9-B, Residencia Los Alpes, Caracas - Venezuela.',
  empresaTelefono: 'Telefono: +584142087167',
  empresaWeb: 'www.serviciostamika.com',
  proyecto: 'Implementación de servicios tecnológicos y soporte especializado',
  saludo: 'Estimados señores:',
};

const parseVe = (str) => { if (!str && str !== 0) return 0; if (typeof str === 'number') return str; return parseFloat(str.toString().replace(/\./g, '').replace(',', '.')) || 0; };
const formatRateInput = (value) => Number(value || 0).toString().replace('.', ',');
const formatUsd = (val) => currency(val, { symbol: '$', separator: '.', decimal: ',' }).format();
const DOCUMENTO_OPTIONS = [
  { value: 'PROPUESTA', label: 'Propuesta' },
  { value: 'PRESUPUESTO', label: 'Presupuesto' },
];
const ESTADO_DOCUMENTO_OPTIONS = ['BORRADOR', 'APROBADO', 'CONVERTIDO', 'FACTURADO', 'ANULADO'];
const documentoLabel = (tipoDocumento) => (tipoDocumento === 'PRESUPUESTO' ? 'Presupuesto' : 'Propuesta');

const datosPdfDesdeCliente = (cliente, base = {}, preferCliente = false) => ({
  ...DEFAULT_PDF_DATA,
  ...base,
  clienteCodigo: preferCliente ? (cliente?.codigoCliente || base.clienteCodigo || '') : (base.clienteCodigo || cliente?.codigoCliente || ''),
  clienteNombre: preferCliente ? (cliente?.nombre || base.clienteNombre || '') : (base.clienteNombre || cliente?.nombre || ''),
  clienteRif: preferCliente ? (cliente?.rif || base.clienteRif || '') : (base.clienteRif || cliente?.rif || ''),
  clienteDireccion: preferCliente ? (cliente?.direccion || base.clienteDireccion || '') : (base.clienteDireccion || cliente?.direccion || ''),
  clienteTelefono: preferCliente ? (cliente?.telefono || base.clienteTelefono || '') : (base.clienteTelefono || cliente?.telefono || ''),
  clienteEmail: preferCliente ? (cliente?.email || base.clienteEmail || '') : (base.clienteEmail || cliente?.email || ''),
});

const getBase64ImageFromURL = (url) => {
  return new Promise((resolve) => {
    var img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      var canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      var ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

export default function TamikaERP() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openNavGroups, setOpenNavGroups] = useState({ productos: true, servicios: true });
  const [authToken, setAuthToken] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [loginForm, setLoginForm] = useState({ nombre: '', email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [historialCoti, setHistorialCoti] = useState([]);
  const [dashboardResumen, setDashboardResumen] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [tasaBCV, setTasaBCV] = useState('');
  const [tasaParalelo, setTasaParalelo] = useState('');
  const [tasaBcvActual, setTasaBcvActual] = useState(null);
  const [tasasActuales, setTasasActuales] = useState(null);
  const [starlinkAlertas, setStarlinkAlertas] = useState([]);
  const [showStarlinkAlertModal, setShowStarlinkAlertModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [cotiEditandoId, setCotiEditandoId] = useState(null);
  const [clienteSelect, setClienteSelect] = useState('');
  const [nroCoti, setNroCoti] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('PROPUESTA');
  const [estadoDocumento, setEstadoDocumento] = useState('BORRADOR');
  const [tituloCoti, setTituloCoti] = useState('');
  const [vigencia, setVigencia] = useState(DEFAULT_VIGENCIA);
  const [condiciones, setCondiciones] = useState(DEFAULT_TERMS);
  const [contenidoPropuesta, setContenidoPropuesta] = useState(DEFAULT_PROPUESTA_CONTENT);
  const [datosPdf, setDatosPdf] = useState(DEFAULT_PDF_DATA);

  const [advMode, setAdvMode] = useState(true);
  const [defGan, setDefGan] = useState('0,30');
  const [defRet, setDefRet] = useState('0,116');
  const [defCom, setDefCom] = useState('0');
  const [defRel, setDefRel] = useState('1');
  const [itemsCoti, setItemsCoti] = useState([]);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCodigoCliente, setNuevoCodigoCliente] = useState('');
  const [nuevoAlias, setNuevoAlias] = useState('');
  const [nuevoRif, setNuevoRif] = useState('');
  const [nuevaDir, setNuevaDir] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  const apiFetch = useCallback((url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
    return fetch(url, { ...options, headers });
  }, [authToken]);

  const readApiResponse = async (res, fallbackMessage) => {
    const text = await res.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch (error) {
      return {
        error: res.ok
          ? fallbackMessage
          : 'El servidor no devolvio una respuesta valida. Revisa la conexion entre frontend y backend.',
      };
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const savedToken = localStorage.getItem('tamika_token') || '';
    if (!savedToken) {
      fetch('/api/auth/setup-status')
        .then(async (res) => {
          const data = await readApiResponse(res, 'No se pudo revisar la configuracion inicial.');
          if (!res.ok) throw new Error(data.error || 'No se pudo revisar la configuracion inicial.');
          setRequiresSetup(Boolean(data.requiresSetup));
        })
        .catch(() => setRequiresSetup(false))
        .finally(() => setAuthLoading(false));
      return;
    }

    setAuthToken(savedToken);
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(async (res) => {
        const data = await readApiResponse(res, 'Sesion invalida.');
        if (!res.ok) throw new Error(data.error || 'Sesion invalida.');
        setAuthUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('tamika_token');
        setAuthToken('');
        setAuthUser(null);
      })
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authUser && authToken) cargarDatos();
  }, [authUser, authToken]);
  useEffect(() => {
    if (authUser && !cotiEditandoId) cargarSiguienteCorrelativo(tipoDocumento);
  }, [tipoDocumento, cotiEditandoId, authUser]);

  const cargarSiguienteCorrelativo = async (tipo = tipoDocumento) => {
    try {
      const res = await apiFetch(`/api/propuestas/siguiente-correlativo?tipoDocumento=${tipo}`);
      const data = await res.json();
      if (res.ok && data.numero) setNroCoti(data.numero);
    } catch (error) {
      setNroCoti('');
    }
  };

  const handleTipoDocumentoChange = (value) => {
    setTipoDocumento(value);
    cargarSiguienteCorrelativo(value);
  };

  const handleClienteChange = (clienteId) => {
    setClienteSelect(clienteId);
    if (!clienteId) {
      setDatosPdf((prev) => ({
        ...prev,
        clienteCodigo: '',
        clienteNombre: '',
        clienteRif: '',
        clienteDireccion: '',
        clienteTelefono: '',
        clienteEmail: '',
      }));
      return;
    }

    const cliente = clientes.find((item) => item.id === clienteId);
    setDatosPdf((prev) => datosPdfDesdeCliente(cliente, prev, true));
  };

  const handlePdfClienteChange = (clienteId) => {
    handleClienteChange(clienteId);
  };

  const updateDatosPdf = (field, value) => {
    setDatosPdf((prev) => ({ ...prev, [field]: value }));
  };

  const guardarSesion = (data) => {
    localStorage.setItem('tamika_token', data.token);
    setAuthToken(data.token);
    setAuthUser(data.user);
    setRequiresSetup(false);
    setLoginError('');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setLoginError('');
    const url = requiresSetup ? '/api/auth/register' : '/api/auth/login';
    const payload = requiresSetup ? loginForm : { email: loginForm.email, password: loginForm.password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readApiResponse(res, 'No se pudo iniciar sesion.');
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesion.');
      guardarSesion(data);
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // El cierre local no depende de la respuesta del backend.
    }
    localStorage.removeItem('tamika_token');
    setAuthToken('');
    setAuthUser(null);
    setActiveView('dashboard');
  };

  const toggleNavGroup = (groupId) => {
    setOpenNavGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const aplicarTasasActuales = (data) => {
    const bcv = Number(data?.bcv ?? data?.tasa ?? 0);
    const paralelo = Number(data?.paralelo ?? 0);
    const version = Date.now();

    if (bcv > 0) setTasaBCV(formatRateInput(bcv));
    if (paralelo > 0) setTasaParalelo(formatRateInput(paralelo));
    if (bcv > 0 && paralelo > 0) handleGlobalChange('defRel', 'rel', (bcv / paralelo).toFixed(4).replace('.', ','));

    setTasasActuales({
      bcv,
      paralelo,
      relacion: bcv > 0 && paralelo > 0 ? Number((bcv / paralelo).toFixed(4)) : 0,
      fecha: data?.fecha || data?.bcvFecha || new Date().toISOString(),
      bcvFecha: data?.bcvFecha || data?.fecha || '',
      paraleloFecha: data?.paraleloFecha || data?.fecha || '',
      fuenteBcv: data?.fuenteBcv || data?.fuente || 'BCV_API',
      fuenteParalelo: data?.fuenteParalelo || 'PARALELO_API',
      version,
    });

    if (bcv > 0) {
      setTasaBcvActual({
        tasa: bcv,
        fuente: data?.fuenteBcv || data?.fuente || 'BCV_API',
        fecha: data?.bcvFecha || data?.fecha || '',
        version,
      });
    }
  };

  const sincronizarTasasActuales = async ({ silent = false, showAlert = false } = {}) => {
    try {
      const res = await apiFetch('/api/tasas/actuales');
      const data = await readApiResponse(res, 'No se pudieron sincronizar las tasas actuales.');
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'No se pudieron sincronizar las tasas actuales.');
      aplicarTasasActuales(data);
      if (showAlert) alert('Tasas actualizadas.');
      return data;
    } catch (error) {
      if (!silent) alert(error.message || 'Error API.');
      return null;
    }
  };

  const alertasStarlinkProximas = (alertas = []) => (
    alertas.filter((alerta) => Number(alerta.diasRestantes) >= 0 && Number(alerta.diasRestantes) <= 10)
  );

  const cargarAlertasStarlink = async () => {
    try {
      const res = await apiFetch('/api/starlink/alertas');
      const data = await readApiResponse(res, 'No se pudieron cargar las alertas Starlink.');
      const alertas = Array.isArray(data?.alertas) ? data.alertas : [];
      setStarlinkAlertas(alertas);

      const proximas = alertasStarlinkProximas(alertas);
      const todayKey = new Date().toISOString().slice(0, 10);
      const dismissedKey = `tamika_starlink_alerts_${todayKey}`;
      if (proximas.length && localStorage.getItem(dismissedKey) !== '1') {
        setShowStarlinkAlertModal(true);
      }
    } catch (error) {
      setStarlinkAlertas([]);
    }
  };

  const cerrarAlertasStarlink = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`tamika_starlink_alerts_${todayKey}`, '1');
    setShowStarlinkAlertModal(false);
  };

  const abrirModuloStarlink = () => {
    cerrarAlertasStarlink();
    setActiveView('starlink');
  };

  const cargarDatos = () => {
    apiFetch('/api/clientes').then(res => res.json()).then(data => setClientes(Array.isArray(data) ? data : []));
    apiFetch('/api/productos').then(res => res.json()).then(data => setProductos(Array.isArray(data) ? data : [])).catch(() => setProductos([]));
    apiFetch('/api/servicios').then(res => res.json()).then(data => setServicios(Array.isArray(data) ? data : [])).catch(() => setServicios([]));
    apiFetch('/api/propuestas').then(res => res.json()).then(data => setHistorialCoti(Array.isArray(data) ? data : []));
    if (!cotiEditandoId) cargarSiguienteCorrelativo(tipoDocumento);
    sincronizarTasasActuales({ silent: true });
    cargarAlertasStarlink();
    setLoadingDashboard(true);
    apiFetch('/api/dashboard/resumen')
      .then(res => res.json())
      .then(data => setDashboardResumen(data))
      .catch(() => setDashboardResumen(null))
      .finally(() => setLoadingDashboard(false));
  };

  const consultarApiTasas = async () => {
    sincronizarTasasActuales({ showAlert: true });
  };

  const guardarTasaBD = async () => {
    if (parseVe(tasaBCV) <= 0) return alert("Valores inválidos.");
    const bcv = parseVe(tasaBCV);
    const paralelo = parseVe(tasaParalelo);
    const fecha = new Date().toISOString();
    await apiFetch('/api/tasas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bcv, paralelo }) });
    aplicarTasasActuales({ bcv, paralelo, fecha, fuenteBcv: 'MANUAL', fuenteParalelo: 'MANUAL' });
    alert("Tasas guardadas.");
  };

  const handleGlobalChange = (globalProp, rowProp, value) => {
    if (globalProp === 'defGan') setDefGan(value); if (globalProp === 'defRet') setDefRet(value); if (globalProp === 'defCom') setDefCom(value); if (globalProp === 'defRel') setDefRel(value);
    setItemsCoti(prev => prev.map(item => ({ ...item, [rowProp]: value })));
  };

  const handleTasasChange = (tipo, valor) => {
    let b = tasaBCV, p = tasaParalelo; if (tipo === 'bcv') { b = valor; setTasaBCV(valor); } if (tipo === 'par') { p = valor; setTasaParalelo(valor); }
    if (parseVe(b) > 0 && parseVe(p) > 0) handleGlobalChange('defRel', 'rel', (parseVe(b) / parseVe(p)).toFixed(4).replace('.', ','));
  };

  const toggleModoAvanzado = (e) => {
    setAdvMode(e.target.checked);
    setItemsCoti(prevItems => prevItems.map(item => {
      const c = parseVe(item.costo); const g = parseVe(item.gan); const r = parseVe(item.ret); const cm = parseVe(item.com); const rl = parseVe(item.rel) || 1; const pManual = parseVe(item.unitarioManual);
      if (e.target.checked) return { ...item, costo: ((pManual * rl * (1 - r) * (1 - cm)) / (1 + g)) ? ((pManual * rl * (1 - r) * (1 - cm)) / (1 + g)).toFixed(4).replace('.', ',') : '0' };
      else return { ...item, unitarioManual: ((c * (1 + g)) / (rl * (1 - r) * (1 - cm))) ? ((c * (1 + g)) / (rl * (1 - r) * (1 - cm))).toFixed(2).replace('.', ',') : '0' };
    }));
  };

  const limpiarFormulario = () => {
    setCotiEditandoId(null);
    setTipoDocumento('PROPUESTA');
    setEstadoDocumento('BORRADOR');
    setNroCoti('');
    setTituloCoti('');
    setClienteSelect('');
    setVigencia(DEFAULT_VIGENCIA);
    setCondiciones(DEFAULT_TERMS);
    setContenidoPropuesta(DEFAULT_PROPUESTA_CONTENT);
    setDatosPdf(DEFAULT_PDF_DATA);
    setItemsCoti([]);
    cargarSiguienteCorrelativo('PROPUESTA');
  };
  const costoDesdePrecio = (precio, item = {}) => {
    const gan = parseVe(item.gan ?? defGan);
    const ret = parseVe(item.ret ?? defRet);
    const com = parseVe(item.com ?? defCom);
    const rel = parseVe(item.rel ?? defRel) || 1;
    const divisor = 1 + gan;
    if (!divisor) return '0';
    return ((precio * rel * (1 - ret) * (1 - com)) / divisor).toFixed(4).replace('.', ',');
  };
  const buildItemCoti = (overrides = {}) => ({ id: Date.now() + Math.random(), catalogoTipo: 'MANUAL', productoId: '', servicioId: '', desc: '', cant: '1', costo: '0', gan: defGan, ret: defRet, com: defCom, rel: defRel, unitarioManual: '0', ...overrides });
  const agregarItemCoti = () => setItemsCoti([...itemsCoti, buildItemCoti()]);
  const actualizarItem = (id, campo, valor) => setItemsCoti(itemsCoti.map(item => item.id === id ? { ...item, [campo]: valor } : item));
  const actualizarCatalogoItem = (id, catalogoTipo, catalogoId = '') => {
    setItemsCoti(itemsCoti.map((item) => {
      if (item.id !== id) return item;
      if (catalogoTipo === 'MANUAL') return { ...item, catalogoTipo, productoId: '', servicioId: '' };
      const source = catalogoTipo === 'PRODUCTO'
        ? productos.find((producto) => producto.id === catalogoId)
        : servicios.find((servicio) => servicio.id === catalogoId);
      if (!source) return { ...item, catalogoTipo, productoId: catalogoTipo === 'PRODUCTO' ? catalogoId : '', servicioId: catalogoTipo === 'SERVICIO' ? catalogoId : '' };
      const precio = Number(source.precioUsd || 0);
      const descripcion = [source.nombre, source.descripcion].filter(Boolean).join('\n');
      return {
        ...item,
        catalogoTipo,
        productoId: catalogoTipo === 'PRODUCTO' ? source.id : '',
        servicioId: catalogoTipo === 'SERVICIO' ? source.id : '',
        desc: descripcion,
        unitarioManual: precio.toFixed(2).replace('.', ','),
        costo: costoDesdePrecio(precio, item),
      };
    }));
  };
  const eliminarItem = (id) => setItemsCoti(itemsCoti.filter(item => item.id !== id));
  const getPUnitario = (item) => { if (advMode) return (parseVe(item.costo) * (1 + parseVe(item.gan))) / ((parseVe(item.rel)||1) * (1 - parseVe(item.ret)) * (1 - parseVe(item.com))); return parseVe(item.unitarioManual); };
  const calcularSubtotal = () => itemsCoti.reduce((acc, item) => acc + (getPUnitario(item) * parseVe(item.cant)), 0);
  const calcularIva = () => calcularSubtotal() * 0.16;
  const calcularTotal = () => calcularSubtotal() + calcularIva();

  const guardarCotizacionBD = async () => {
    if(!clienteSelect) return alert("Selecciona un cliente.");
    const payload = {
      tipoDocumento,
      numero: nroCoti.trim() || undefined,
      estado: estadoDocumento,
      clienteId: clienteSelect,
      titulo: tituloCoti,
      vigencia,
      condiciones,
      contenidoPropuesta: tipoDocumento === 'PROPUESTA' ? contenidoPropuesta : null,
      datosPdf,
      subtotal: calcularSubtotal(),
      iva: calcularIva(),
      total: calcularTotal(),
      items: itemsCoti,
    };
    const res = await apiFetch(cotiEditandoId ? `/api/propuestas/${cotiEditandoId}` : '/api/propuestas', { method: cotiEditandoId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return alert(data?.details?.join('\n') || data?.error || "No se pudo guardar el documento.");
    setCotiEditandoId(data.id);
    setNroCoti(data.numero || nroCoti);
    setTipoDocumento(data.tipoDocumento || tipoDocumento);
    setEstadoDocumento(data.estado || estadoDocumento);
    alert(cotiEditandoId ? "Actualizada exitosamente." : "Guardada exitosamente.");
    cargarDatos();
  };

  const cargarDesdeModal = (coti) => {
    setCotiEditandoId(coti.id);
    setTipoDocumento(coti.tipoDocumento || 'PROPUESTA');
    setEstadoDocumento(coti.estado || 'BORRADOR');
    setNroCoti(coti.numero);
    setTituloCoti(coti.titulo || '');
    setClienteSelect(coti.clienteId);
    setVigencia(coti.vigencia || DEFAULT_VIGENCIA);
    setCondiciones(coti.condiciones || DEFAULT_TERMS);
    setContenidoPropuesta(coti.contenidoPropuesta || DEFAULT_PROPUESTA_CONTENT);
    setDatosPdf(datosPdfDesdeCliente(coti.cliente, coti.datosPdf || {}));
    setItemsCoti(Array.isArray(coti.items) ? coti.items : []);
    setShowModal(false);
  };

  const eliminarPropuesta = async (coti) => {
    if (!confirm(`Eliminar ${documentoLabel(coti.tipoDocumento)} ${coti.numero}?`)) return;
    const res = await apiFetch(`/api/propuestas/${coti.id}`, { method: 'DELETE' });
    if (!res.ok) return alert("No se pudo eliminar el documento.");
    if (cotiEditandoId === coti.id) limpiarFormulario();
    cargarDatos();
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    await apiFetch(editandoId ? `/api/clientes/${editandoId}` : '/api/clientes', {
      method: editandoId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoCliente: nuevoCodigoCliente, nombre: nuevoNombre, alias: nuevoAlias, rif: nuevoRif, direccion: nuevaDir, telefono: nuevoTelefono, email: nuevoEmail }),
    });
    setEditandoId(null); setNuevoCodigoCliente(''); setNuevoNombre(''); setNuevoAlias(''); setNuevoRif(''); setNuevaDir(''); setNuevoTelefono(''); setNuevoEmail(''); cargarDatos();
  };
  const cargarCodigoClienteAuto = async () => {
    try {
      const res = await apiFetch('/api/clientes/siguiente-codigo');
      const data = await res.json();
      if (res.ok && data.codigoCliente) setNuevoCodigoCliente(data.codigoCliente);
    } catch (error) {
      alert('No se pudo generar el codigo de cliente.');
    }
  };
  const iniciarEdicion = (cli) => { setEditandoId(cli.id); setNuevoCodigoCliente(cli.codigoCliente || ''); setNuevoNombre(cli.nombre); setNuevoAlias(cli.alias || ''); setNuevoRif(cli.rif); setNuevaDir(cli.direccion || ''); setNuevoTelefono(cli.telefono || ''); setNuevoEmail(cli.email || ''); };
  const eliminarCliente = async (id) => { if(confirm('¿Eliminar cliente?')) { await apiFetch(`/api/clientes/${id}`, { method: 'DELETE' }); cargarDatos(); } };


  // =====================================
  // EL MOTOR MATEMÁTICO DE PDF BLINDADO v18 (DISEÑO FINAL)
  // =====================================
  const generarPDFNativo = async (accion = 'abrir') => {
    try {
      const pdfMake = require("pdfmake/build/pdfmake");
      const pdfFonts = require("pdfmake/build/vfs_fonts");
      const htmlToPdfmake = require("html-to-pdfmake");
      pdfMake.vfs = (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

      const logoBase64 = await getBase64ImageFromURL('/logo.png');
      const firmaUnificadaBase64 = await getBase64ImageFromURL('/firma.png');

      const c = clientes.find(x => x.id === clienteSelect);
      const d = new Date();
      const nombreDocumento = documentoLabel(tipoDocumento);
      const dateStr = ('0'+d.getDate()).slice(-2) + ('0'+(d.getMonth()+1)).slice(-2) + d.getFullYear();
      const aliasStr = c?.alias ? `_${c.alias}` : '';
      const cleanTitle = `${nombreDocumento}_${nroCoti || 'sin_correlativo'}${aliasStr}_${dateStr}.pdf`.replace(/\s+/g, '_');
      const numeroVisual = nroCoti?.toString().match(/(\d+)$/)?.[1];
      const numeroVisualPdf = numeroVisual ? numeroVisual.padStart(7, '0') : (nroCoti || 'Pendiente');
      const etiquetaNumeroPdf = tipoDocumento === 'PRESUPUESTO' ? `PRESUPUESTO NO. ${numeroVisualPdf}` : `COTIZACIÓN NO. ${numeroVisualPdf}`;
      const datosPdfActual = datosPdfDesdeCliente(c, datosPdf);
      const sidebarCliente = [
        datosPdfActual.clienteCodigo,
        datosPdfActual.clienteNombre,
        datosPdfActual.clienteRif,
        datosPdfActual.clienteDireccion,
        datosPdfActual.clienteTelefono,
        datosPdfActual.clienteEmail,
      ].filter(Boolean);
      const sidebarEmpresa = [
        datosPdfActual.empresaNombre,
        datosPdfActual.empresaRif,
        datosPdfActual.empresaDireccion,
        datosPdfActual.empresaTelefono,
        datosPdfActual.empresaWeb,
      ].filter(Boolean);

      const tableBody = [
        [
          { text: 'ITEM', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 7.5, alignment: 'center', margin: [2, 5], noWrap: true, border: [false, false, false, false] },
          { text: 'DESCRIPCIÓN DEL SERVICIO', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 7.5, margin: [4, 5], border: [false, false, false, false] },
          { text: 'CANT.', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 7.5, alignment: 'center', margin: [4, 5], border: [false, false, false, false] },
          { text: 'PRECIO UNID.', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 7.5, alignment: 'right', margin: [4, 5], border: [false, false, false, false] },
          { text: 'TOTAL USD', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 7.5, alignment: 'right', margin: [4, 5], border: [false, false, false, false] }
        ]
      ];

      itemsCoti.forEach((item, idx) => {
        const pUnit = getPUnitario(item);
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        tableBody.push([
          { text: String(idx + 1).padStart(2, '0'), fontSize: 7.5, color: '#1e293b', alignment: 'center', margin: [4, 5], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] },
          { text: item.desc || ' ', fontSize: 7.5, color: '#1e293b', margin: [4, 5], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] },
          { text: item.cant ? item.cant.toString() : '0', fontSize: 7.5, color: '#1e293b', alignment: 'center', margin: [4, 5], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] },
          { text: formatUsd(pUnit), fontSize: 7.5, color: '#1e293b', alignment: 'right', margin: [4, 5], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] },
          { text: formatUsd(pUnit * parseVe(item.cant)), fontSize: 7.5, bold: true, color: '#0f172a', alignment: 'right', margin: [4, 5], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] }
        ]);
      });

      const terminosFormateados = htmlToPdfmake(condiciones, {
        window: window,
        defaultStyles: { p: { fontSize: 6.4, color: '#475569', margin: [0, 0, 0, 3], alignment: 'justify', lineHeight: 1.04 }, strong: { bold: true, color: '#0f172a' } }
      });
      const contenidoPropuestaFormateado = tipoDocumento === 'PROPUESTA' && contenidoPropuesta?.trim()
        ? htmlToPdfmake(contenidoPropuesta, {
          window: window,
          defaultStyles: {
            p: { fontSize: 7.2, color: '#334155', margin: [0, 0, 0, 4], alignment: 'justify', lineHeight: 1.06 },
            strong: { bold: true, color: '#0f172a' },
            ul: { margin: [10, 0, 0, 4] },
            ol: { margin: [10, 0, 0, 4] },
            li: { fontSize: 7.2, color: '#334155', margin: [0, 0, 0, 2] },
          }
        })
        : [];
      const contenidoPropuestaStack = Array.isArray(contenidoPropuestaFormateado)
        ? contenidoPropuestaFormateado
        : [contenidoPropuestaFormateado];

      const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      const fechaPdf = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      const sidebarLine = (text, index) => ({
        text,
        fontSize: index === 0 ? 6.4 : 5.4,
        bold: index === 0,
        color: '#444444',
        margin: [0, index === 0 ? 0 : 3, 0, 0],
        lineHeight: 1.08,
        noWrap: false,
      });
      const sidebarSection = (title, lines, y) => ({
        table: {
          widths: [112],
          body: [
            [{ text: title, fontSize: 6.8, bold: true, color: '#333333', margin: [0, 0, 0, 6] }],
            ...(lines.length ? lines : ['Consumidor Final', 'N/A']).map((line, index) => [sidebarLine(line, index)]),
          ],
        },
        layout: 'noBorders',
        absolutePosition: { x: 18, y },
      });
      const headerRightBlock = {
        table: {
          widths: [170],
          body: [
            [{
              text: nombreDocumento,
              fontSize: nombreDocumento.length > 10 ? 22 : 23,
              bold: true,
              color: '#2f343b',
              alignment: 'center',
              margin: [0, 0, 0, 7],
            }],
            [{
              text: `Fecha: ${fechaPdf}`,
              fontSize: 8.5,
              color: '#4b5563',
              alignment: 'center',
              margin: [0, 0, 0, 7],
            }],
            [{
              text: etiquetaNumeroPdf,
              fontSize: 8.2,
              bold: true,
              color: '#334155',
              alignment: 'center',
              margin: [0, 0, 0, 0],
            }],
          ],
        },
        layout: 'noBorders',
        absolutePosition: { x: 390, y: 38 },
      };

      const docDefinition = {
        pageSize: 'LETTER',
        pageMargins: [154, 132, 24, 28],
        background: function(currentPage, pageSize) {
          return [
            {
              canvas: [
                { type: 'rect', x: 12, y: 18, w: pageSize.width - 24, h: 108, color: '#d7dce1' },
                { type: 'rect', x: 12, y: 132, w: 130, h: pageSize.height - 150, color: '#eeeeee' },
              ]
            },
            logoBase64
              ? { image: logoBase64, width: 250, opacity: 0.045, absolutePosition: { x: 248, y: 300 } }
              : { text: '', absolutePosition: { x: 250, y: 300 } },
            { image: logoBase64 || transparentPixel, width: 66, absolutePosition: { x: 22, y: 31 } },
            { text: 'Servicios\nTamika 0302,C.A', fontSize: 20, bold: true, color: '#2f343b', lineHeight: 0.84, absolutePosition: { x: 92, y: 35 } },
            { text: 'RIF.: J-50634330-4', fontSize: 12, color: '#334155', absolutePosition: { x: 95, y: 92 } },
            headerRightBlock,
            sidebarSection('CLIENTE', sidebarCliente, 158),
            sidebarSection('EMPRESA', sidebarEmpresa, 326),
            logoBase64
              ? { image: logoBase64, width: 92, opacity: 0.08, absolutePosition: { x: 30, y: 558 } }
              : { text: '', absolutePosition: { x: 34, y: 560 } },
            firmaUnificadaBase64
              ? { image: firmaUnificadaBase64, width: 150, opacity: 0.95, absolutePosition: { x: 2, y: 610 } }
              : { text: '', absolutePosition: { x: 18, y: 662 } },
          ];
        },
        header: function(currentPage, pageCount) {
          return { text: `(${currentPage}/${pageCount})`, fontSize: 7, bold: true, color: '#444444', absolutePosition: { x: 575, y: 136 } };
        },

        content: [
          tituloCoti ? { text: tituloCoti, alignment: 'center', bold: true, color: '#1f2937', fontSize: 6.5, margin: [0, 0, 0, 2] } : null,
          datosPdfActual.proyecto ? { text: [{ text: 'Proyecto: ', bold: true }, datosPdfActual.proyecto], alignment: 'center', color: '#334155', fontSize: 6.5, margin: [0, 0, 0, 10] } : null,
          datosPdfActual.saludo ? { text: datosPdfActual.saludo, alignment: 'center', bold: true, color: '#1f2937', fontSize: 6.8, margin: [0, 0, 0, 5] } : null,

          ...(contenidoPropuestaStack.length ? [{
            stack: contenidoPropuestaStack,
            margin: [0, 0, 0, 10]
          }] : []),

          // TABLA DE ITEMS
          {
            table: {
              headerRows: 1,
              widths: [34, '*', 30, 58, 64],
              body: tableBody
            },
            layout: 'noBorders', // Los bordes se manejan a nivel de celda
            margin: [0, 0, 0, 12]
          },

          // CUADRO DE TOTALES CON FONDO
          {
            columns: [
              { width: '*', text: '' },
              {
                width: 190,
                table: {
                  widths: ['*', '*'],
                  body: [
                    [{ text: 'SUBTOTAL USD', fontSize: 7.5, color: '#475569', margin: [10, 9, 0, 4] }, { text: formatUsd(calcularSubtotal()), fontSize: 7.5, bold: true, alignment: 'right', margin: [0, 9, 10, 4] }],
                    [{ text: 'IVA (16%)', fontSize: 7.5, color: '#475569', margin: [10, 0, 0, 9] }, { text: formatUsd(calcularIva()), fontSize: 7.5, bold: true, alignment: 'right', margin: [0, 0, 10, 9] }],
                    [{ text: 'TOTAL USD', fontSize: 10, bold: true, color: '#ffffff', fillColor: '#0f172a', margin: [10, 9, 0, 9] }, { text: formatUsd(calcularTotal()), fontSize: 10, bold: true, color: '#34d399', fillColor: '#0f172a', alignment: 'right', margin: [0, 9, 10, 9] }]
                  ]
                },
                layout: {
                  fillColor: '#f8fafc', // Fondo gris claro para el bloque
                  hLineWidth: function (i, node) { return 0; }, vLineWidth: function (i, node) { return 0; }
                },
                margin: [0, 0, 0, 18]
              }
            ]
          },

          { text: 'TÉRMINOS Y CONDICIONES GENERALES', fontSize: 7, color: '#0f172a', bold: true, margin: [0, 0, 0, 5] },
          ...terminosFormateados,
        ]
      };

      if (accion === 'abrir') {
        apiFetch('/api/audit-logs/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'PDF_GENERATE', entidad: 'Cotizacion', entidadId: cotiEditandoId, descripcion: `PDF generado para ${nroCoti || 'documento sin correlativo'}.`, metadata: { accion, tipoDocumento, numero: nroCoti } }),
        }).catch(() => {});
        pdfMake.createPdf(docDefinition).open();
      } else {
        apiFetch('/api/audit-logs/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'PDF_GENERATE', entidad: 'Cotizacion', entidadId: cotiEditandoId, descripcion: `PDF descargado para ${nroCoti || 'documento sin correlativo'}.`, metadata: { accion, tipoDocumento, numero: nroCoti } }),
        }).catch(() => {});
        pdfMake.createPdf(docDefinition).download(cleanTitle);
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error interno al compilar el documento: " + err.message);
    }
  };

  if (!isMounted) return null;
  if (authLoading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm font-semibold text-white">Cargando TAMIKA ERP...</div>;
  if (!authUser) {
    return (
      <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,_#e0f2fe,_#f4f7fb_36%,_#111827_120%)] p-4 text-slate-900">
        <form onSubmit={handleAuthSubmit} className="enterprise-surface w-full max-w-md rounded-xl p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img src="/logo.png" alt="" className="h-9 w-9 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-950">TAMIKA ERP</h1>
              <p className="text-sm text-slate-500">{requiresSetup ? 'Crear primer administrador' : 'Iniciar sesión'}</p>
            </div>
          </div>
          {requiresSetup && (
            <label className="mb-3 block text-xs font-bold text-slate-500">
              Nombre
              <input required value={loginForm.nombre} onChange={(e) => setLoginForm((prev) => ({ ...prev, nombre: e.target.value }))} className="input mt-1" />
            </label>
          )}
          <label className="mb-3 block text-xs font-bold text-slate-500">
            Email
            <input required type="email" value={loginForm.email} onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))} className="input mt-1" />
          </label>
          <label className="mb-4 block text-xs font-bold text-slate-500">
            Contraseña
            <input required type="password" minLength={8} value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} className="input mt-1" />
          </label>
          {loginError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{loginError}</div>}
          <button className="btn-enterprise w-full">
            {requiresSetup ? 'Crear administrador' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'cotizacion', label: 'Propuestas', icon: '📝' },
    { id: 'contabilidad', label: 'Contabilidad', icon: '💼' },
    {
      id: 'productos',
      label: 'Productos',
      icon: '📦',
      children: [
        { id: 'productos', label: 'Productos', icon: '📦' },
      ],
    },
    {
      id: 'servicios',
      label: 'Servicios',
      icon: '🧰',
      children: [
        { id: 'servicios', label: 'Servicios', icon: '🧰' },
        { id: 'nomina', label: 'Nómina', icon: '👷' },
      ],
    },
    { id: 'reportes', label: 'Reportes', icon: '📑' },
    { id: 'catalogos', label: 'Catálogos', icon: '🗂️' },
    ...(authUser?.rol === 'ADMIN' ? [{ id: 'usuarios', label: 'Usuarios', icon: '👥' }, { id: 'auditoria', label: 'Auditoría', icon: '🛡️' }] : []),
  ];
  const productosNav = navItems.find((item) => item.id === 'productos');
  if (productosNav?.children && !productosNav.children.some((child) => child.id === 'starlink')) {
    productosNav.children.push({ id: 'starlink', label: 'Starlink', icon: 'SL' });
  }

  const isNavItemActive = (view) => view.id === activeView || view.children?.some((child) => child.id === activeView);
  const userInitial = authUser?.nombre?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="flex min-h-screen flex-col font-sans bg-[var(--tamika-bg)] text-slate-900 lg:flex-row">
      <aside className={`z-10 flex w-full flex-col gap-4 bg-[var(--tamika-sidebar)] p-5 text-slate-100 shadow-xl transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:overflow-y-auto ${sidebarCollapsed ? 'lg:w-20 lg:p-4' : 'lg:w-80 lg:p-5'}`}>
        <div className={`mb-4 flex items-center gap-3 ${sidebarCollapsed ? 'lg:flex-col lg:justify-center lg:gap-3' : ''}`}>
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
          </div>
          <div className={sidebarCollapsed ? 'lg:hidden' : ''}><h1 className="text-lg font-bold leading-tight">TAMIKA ERP</h1></div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? 'Expandir menú' : 'Plegar menú'}
            aria-label={sidebarCollapsed ? 'Expandir menú' : 'Plegar menú'}
            className={`ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 ${sidebarCollapsed ? 'lg:ml-0' : ''}`}
          >
            <span className="sr-only">{sidebarCollapsed ? 'Expandir menú' : 'Plegar menú'}</span>
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-4 rounded bg-current" />
              <span className="block h-0.5 w-4 rounded bg-current" />
              <span className="block h-0.5 w-4 rounded bg-current" />
            </span>
          </button>
        </div>
        <nav className={`flex flex-col gap-2 ${sidebarCollapsed ? 'lg:items-center' : ''}`}>
          {navItems.map((view) => {
            const active = isNavItemActive(view);
            const isGroup = Array.isArray(view.children);
            const groupOpen = openNavGroups[view.id] || active;

            if (isGroup) {
              return (
                <div key={view.id} className={`min-w-0 ${sidebarCollapsed ? 'lg:w-11' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (sidebarCollapsed) {
                        setActiveView(view.children[0].id);
                        return;
                      }
                      toggleNavGroup(view.id);
                    }}
                    title={sidebarCollapsed ? view.label : undefined}
                    aria-label={view.label}
                    aria-expanded={groupOpen}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-4 py-3 text-left font-medium transition-colors ${sidebarCollapsed ? 'lg:grid lg:h-11 lg:w-11 lg:place-items-center lg:px-0 lg:py-0 lg:text-center' : ''} ${active ? 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{view.label}</span>
                    <span className={sidebarCollapsed ? 'hidden text-xl leading-none lg:block' : 'hidden'} aria-hidden="true">{view.icon}</span>
                    <span className={`text-xs transition-transform ${groupOpen ? 'rotate-90' : ''} ${sidebarCollapsed ? 'lg:hidden' : ''}`} aria-hidden="true">›</span>
                  </button>
                  {groupOpen && (
                    <div className={`mt-1 space-y-1 border-l border-white/10 pl-3 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                      {view.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => setActiveView(child.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${activeView === child.id ? 'bg-white/10 text-teal-100' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                          <span className="text-base leading-none" aria-hidden="true">{child.icon}</span>
                          <span>{child.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                title={sidebarCollapsed ? view.label : undefined}
                aria-label={view.label}
                className={`rounded-lg px-4 py-3 text-left font-medium transition-colors ${sidebarCollapsed ? 'lg:grid lg:h-11 lg:w-11 lg:place-items-center lg:px-0 lg:py-0 lg:text-center' : ''} ${active ? 'bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              >
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{view.label}</span>
                <span className={sidebarCollapsed ? 'hidden text-xl leading-none lg:block' : 'hidden'} aria-hidden="true">{view.icon}</span>
              </button>
            );
          })}
        </nav>
        <div className={`rounded-xl border border-white/10 bg-white/5 p-4 text-sm ${sidebarCollapsed ? 'lg:p-2' : ''}`}>
          <div className={sidebarCollapsed ? 'lg:grid lg:place-items-center' : ''}>
            <div className={sidebarCollapsed ? 'hidden h-10 w-10 place-items-center rounded-full bg-teal-500/15 text-sm font-extrabold text-teal-200 lg:grid' : 'hidden'}>{userInitial}</div>
            <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
              <p className="font-bold text-white">{authUser.nombre}</p>
              <p className="break-all text-xs text-slate-400">{authUser.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Salir"
            aria-label="Salir"
            className={`mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15 ${sidebarCollapsed ? 'lg:grid lg:h-10 lg:w-10 lg:place-items-center lg:px-0 lg:py-0' : ''}`}
          >
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Salir</span>
            <svg className={sidebarCollapsed ? 'hidden h-4 w-4 lg:block' : 'hidden'} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M10 6H6v12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 8l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className={`mt-6 rounded-xl border border-white/10 bg-white/5 p-4 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
          <h3 className="text-sm font-bold text-white mb-3">Tasas del Día</h3>
          <div className="flex gap-2 mb-3"><button onClick={consultarApiTasas} className="flex-1 rounded bg-cyan-700 py-1 text-xs text-white shadow">API</button><button onClick={guardarTasaBD} className="flex-1 rounded bg-teal-700 py-1 text-xs text-white shadow">Guardar</button></div>
          <div className="space-y-3">
            <div><label className="text-xs text-slate-400">BCV</label><input type="text" value={tasaBCV} onChange={(e) => handleTasasChange('bcv', e.target.value)} className="w-full bg-slate-700 text-white border-none rounded px-3 py-2 text-sm outline-none mt-1" /></div>
            <div><label className="text-xs text-slate-400">Paralelo</label><input type="text" value={tasaParalelo} onChange={(e) => handleTasasChange('par', e.target.value)} className="w-full bg-slate-700 text-white border-none rounded px-3 py-2 text-sm outline-none mt-1" /></div>
            <div className="pt-2 border-t border-slate-700"><label className="text-xs text-slate-400">Relación</label><input type="text" value={defRel} readOnly className="w-full bg-slate-900 text-emerald-400 font-mono font-bold rounded px-3 py-2 text-sm outline-none mt-1 text-right" /></div>
          </div>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        {activeView === 'dashboard' && (
          <DashboardView
            resumen={dashboardResumen}
            loading={loadingDashboard}
            apiFetch={apiFetch}
            tasasActuales={tasasActuales}
            starlinkAlertas={starlinkAlertas}
            onOpenStarlink={() => setActiveView('starlink')}
          />
        )}

        {activeView === 'contabilidad' && (
          <ContabilidadView clientes={clientes} onChanged={cargarDatos} tasaBcvActual={tasaBcvActual} apiFetch={apiFetch} />
        )}

        {activeView === 'reportes' && (
          <ReportesContablesView clientes={clientes} apiFetch={apiFetch} />
        )}

        {activeView === 'productos' && (
          <CatalogosEnterpriseView apiFetch={apiFetch} clientes={clientes} initialTab="productos" onChanged={cargarDatos} tasaBcvActual={tasaBcvActual} />
        )}

        {activeView === 'starlink' && (
          <StarlinkView apiFetch={apiFetch} clientes={clientes} onChanged={cargarDatos} />
        )}

        {activeView === 'servicios' && (
          <CatalogosEnterpriseView apiFetch={apiFetch} clientes={clientes} initialTab="servicios" onChanged={cargarDatos} tasaBcvActual={tasaBcvActual} />
        )}

        {activeView === 'nomina' && (
          <NominaView apiFetch={apiFetch} onChanged={cargarDatos} />
        )}

        {activeView === 'usuarios' && authUser?.rol === 'ADMIN' && (
          <UsuariosView apiFetch={apiFetch} />
        )}

        {activeView === 'auditoria' && authUser?.rol === 'ADMIN' && (
          <AuditoriaView apiFetch={apiFetch} />
        )}

        {/* CATALOGOS */}
        {activeView === 'catalogos' && (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
              <h2 className="text-xl font-bold mb-4">{editandoId ? 'Editar Cliente' : 'Gestión de Clientes'}</h2>
              <form onSubmit={guardarCliente} className="grid grid-cols-1 gap-3 mb-6 p-4 rounded-xl border bg-slate-50 items-end sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="text-xs text-slate-500 font-bold">ID Cliente</label>
                  <div className="flex gap-2">
                    <input type="text" value={nuevoCodigoCliente} onChange={(e) => setNuevoCodigoCliente(e.target.value)} placeholder="CLI-2026-0001" className="w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                    <button type="button" onClick={cargarCodigoClienteAuto} className="rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700">Auto</button>
                  </div>
                </div>
                <div><label className="text-xs text-slate-500 font-bold">Razón Social</label><input type="text" required value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
                <div><label className="text-xs text-slate-500 font-bold">Alias (Corto para PDF)</label><input type="text" placeholder="Ej: MPPOP" value={nuevoAlias} onChange={(e) => setNuevoAlias(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
                <div><label className="text-xs text-slate-500 font-bold">RIF</label><input type="text" required value={nuevoRif} onChange={(e) => setNuevoRif(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
                <div><label className="text-xs text-slate-500 font-bold">Teléfono</label><input type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
                <div><label className="text-xs text-slate-500 font-bold">Email</label><input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
                <div className="sm:col-span-2"><label className="text-xs text-slate-500 font-bold">Dirección Fiscal</label><input type="text" value={nuevaDir} onChange={(e) => setNuevaDir(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
                <div><button type="submit" className="w-full py-2 text-white bg-slate-900 rounded-lg text-sm font-medium">Guardar</button></div>
              </form>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead><tr className="bg-slate-100 text-sm"><th className="p-3">ID</th><th className="p-3">Nombre</th><th className="p-3">Alias</th><th className="p-3">RIF</th><th className="p-3">Contacto</th><th className="p-3 text-right">Acción</th></tr></thead>
                  <tbody className="text-sm">
                    {clientes.map(cli => (
                      <tr key={cli.id} className="border-b hover:bg-slate-50"><td className="p-3 font-mono text-xs font-bold text-slate-600">{cli.codigoCliente || '-'}</td><td className="p-3 font-medium">{cli.nombre}</td><td className="p-3 font-bold text-indigo-600">{cli.alias || '-'}</td><td className="p-3 text-slate-500">{cli.rif}</td><td className="p-3 text-slate-500"><span className="block">{cli.telefono || '-'}</span><span className="text-xs">{cli.email || ''}</span></td><td className="p-3 text-right"><button onClick={() => iniciarEdicion(cli)} className="text-blue-600 font-medium mr-4">Editar</button><button onClick={() => eliminarCliente(cli.id)} className="text-red-500 font-medium">Eliminar</button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* PROPUESTAS */}
        {activeView === 'cotizacion' && (
           <section className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200 space-y-6">
             <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
               <h2 className="text-xl font-bold text-slate-900">Propuestas y presupuestos</h2>
               <div className="flex flex-wrap gap-2">
                 <button onClick={() => setShowModal(true)} className="px-5 py-2 bg-indigo-100 text-indigo-800 rounded-lg font-bold shadow hover:bg-indigo-200">Buscar</button>
                 <button onClick={limpiarFormulario} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold border border-slate-300">Nuevo</button>
                 <button onClick={guardarCotizacionBD} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium shadow">{cotiEditandoId ? 'Actualizar' : 'Guardar'}</button>
                 <button onClick={() => generarPDFNativo('abrir')} className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow hover:bg-slate-700">Vista previa</button>
                 <button onClick={() => generarPDFNativo('descargar')} className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-extrabold shadow tracking-wide hover:bg-emerald-500">Descargar PDF</button>
               </div>
             </div>

             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <label className="text-xs text-slate-500 font-bold uppercase">Cliente</label>
                  <select value={clienteSelect} onChange={(e) => handleClienteChange(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    <option value="">-- Selecciona un Cliente --</option>
                    {clientes.map(cli => ( <option key={cli.id} value={cli.id}>{cli.codigoCliente ? `${cli.codigoCliente} - ` : ''}{cli.nombre} ({cli.rif})</option> ))}
                  </select>
                </div>
                <div className="lg:col-span-4">
                  <label className="text-xs text-slate-500 font-bold uppercase">Titulo del documento</label>
                  <input type="text" value={tituloCoti} onChange={(e)=>setTituloCoti(e.target.value)} placeholder="Ej: Presupuesto de Suministros..." className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">Tipo</label>
                  <select value={tipoDocumento} onChange={(e)=>handleTipoDocumentoChange(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    {DOCUMENTO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">Estado</label>
                  <select value={estadoDocumento} onChange={(e)=>setEstadoDocumento(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    {ESTADO_DOCUMENTO_OPTIONS.map(estado => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-4 xl:col-span-3">
                  <label className="text-xs text-slate-500 font-bold uppercase">Correlativo</label>
                  <div className="mt-1 flex gap-2">
                    <input type="text" value={nroCoti} onChange={(e)=>setNroCoti(e.target.value)} placeholder="Generando..." className="min-w-0 flex-1 border rounded-lg px-3 py-2 text-sm outline-none bg-white text-slate-700 font-mono font-bold focus:border-indigo-500" />
                    <button type="button" onClick={() => cargarSiguienteCorrelativo(tipoDocumento)} className="rounded-lg border border-slate-300 bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-slate-200">Auto</button>
                  </div>
                </div>
                <div className="lg:col-span-3 xl:col-span-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">Vigencia</label>
                  <input type="text" value={vigencia} onChange={(e)=>setVigencia(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
             </div>

             <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
               <label className="flex items-center gap-2 font-bold text-indigo-900 cursor-pointer">
                 <input type="checkbox" checked={advMode} onChange={toggleModoAvanzado} className="w-4 h-4 accent-indigo-600" /> Mostrar campos avanzados
               </label>
               {advMode && (
                 <div className="grid grid-cols-1 gap-4 text-sm pt-3 mt-3 border-t border-indigo-200 sm:grid-cols-2 xl:grid-cols-4">
                   <div><label className="block text-xs font-bold text-indigo-700">% Gan</label><input type="text" value={defGan} onChange={(e)=>handleGlobalChange('defGan', 'gan', e.target.value)} className="w-full border rounded px-3 py-2" /></div>
                   <div><label className="block text-xs font-bold text-indigo-700">% Ret</label><input type="text" value={defRet} onChange={(e)=>handleGlobalChange('defRet', 'ret', e.target.value)} className="w-full border rounded px-3 py-2" /></div>
                   <div><label className="block text-xs font-bold text-indigo-700">% Com</label><input type="text" value={defCom} onChange={(e)=>handleGlobalChange('defCom', 'com', e.target.value)} className="w-full border rounded px-3 py-2" /></div>
                   <div><label className="block text-xs font-bold text-indigo-700">Relación</label><input type="text" value={defRel} onChange={(e)=>handleGlobalChange('defRel', 'rel', e.target.value)} className="w-full border rounded px-3 py-2 bg-white" /></div>
                 </div>
               )}
             </div>

             <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
               <h3 className="text-xs font-bold uppercase text-slate-500">Barra lateral del PDF</h3>
               <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                 <div className="md:col-span-2 xl:col-span-4">
                   <label className="text-xs font-bold text-slate-500">Cliente para el PDF</label>
                   <select value={clienteSelect} onChange={(e)=>handlePdfClienteChange(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                     <option value="">Consumidor Final / Sin cliente</option>
                     {clientes.map((cli) => (
                       <option key={cli.id} value={cli.id}>
                         {cli.codigoCliente ? `${cli.codigoCliente} - ` : ''}{cli.nombre}{cli.rif ? ` (${cli.rif})` : ''}
                       </option>
                     ))}
                   </select>
                 </div>
                 <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-slate-200 bg-white p-3">
                   <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                     <div>
                       <p className="text-[11px] font-bold uppercase text-slate-400">ID</p>
                       <p className="break-words font-semibold text-slate-800">{datosPdf.clienteCodigo || '-'}</p>
                     </div>
                     <div>
                       <p className="text-[11px] font-bold uppercase text-slate-400">Cliente</p>
                       <p className="break-words font-semibold text-slate-800">{datosPdf.clienteNombre || 'Consumidor Final'}</p>
                     </div>
                     <div>
                       <p className="text-[11px] font-bold uppercase text-slate-400">RIF</p>
                       <p className="break-words text-slate-700">{datosPdf.clienteRif || 'N/A'}</p>
                     </div>
                     <div className="md:col-span-3">
                       <p className="text-[11px] font-bold uppercase text-slate-400">Dirección</p>
                       <p className="whitespace-pre-wrap break-words text-slate-700">{datosPdf.clienteDireccion || '-'}</p>
                     </div>
                     <div>
                       <p className="text-[11px] font-bold uppercase text-slate-400">Teléfono</p>
                       <p className="break-words text-slate-700">{datosPdf.clienteTelefono || '-'}</p>
                     </div>
                     <div className="md:col-span-2">
                       <p className="text-[11px] font-bold uppercase text-slate-400">Email</p>
                       <p className="break-all text-slate-700">{datosPdf.clienteEmail || '-'}</p>
                     </div>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500">Empresa</label>
                   <input type="text" value={datosPdf.empresaNombre} onChange={(e)=>updateDatosPdf('empresaNombre', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500">RIF empresa</label>
                   <input type="text" value={datosPdf.empresaRif} onChange={(e)=>updateDatosPdf('empresaRif', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500">Teléfono</label>
                   <input type="text" value={datosPdf.empresaTelefono} onChange={(e)=>updateDatosPdf('empresaTelefono', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500">Web</label>
                   <input type="text" value={datosPdf.empresaWeb} onChange={(e)=>updateDatosPdf('empresaWeb', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                 </div>
                 <div className="md:col-span-2">
                   <label className="text-xs font-bold text-slate-500">Dirección empresa</label>
                   <textarea value={datosPdf.empresaDireccion} onChange={(e)=>updateDatosPdf('empresaDireccion', e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none resize-y" />
                 </div>
                 <div className="md:col-span-2">
                   <label className="text-xs font-bold text-slate-500">Proyecto</label>
                   <textarea value={datosPdf.proyecto} onChange={(e)=>updateDatosPdf('proyecto', e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none resize-y" />
                 </div>
                 <div className="md:col-span-2 xl:col-span-4">
                   <label className="text-xs font-bold text-slate-500">Saludo / destinatario</label>
                   <input type="text" value={datosPdf.saludo} onChange={(e)=>updateDatosPdf('saludo', e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                 </div>
               </div>
             </div>

             {tipoDocumento === 'PROPUESTA' && (
               <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                 <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Contenido interno de la propuesta</label>
                 <ReactQuill theme="snow" value={contenidoPropuesta} onChange={setContenidoPropuesta} className="bg-white min-h-[220px] pb-10" />
               </div>
             )}

             <div className="border rounded-xl overflow-x-auto shadow-sm">
               <table className="w-full text-left text-sm min-w-max">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-3 w-56">Origen</th>
                      <th className="p-3 w-1/3">Descripción</th>
                      {advMode && <th className="p-3 text-center bg-indigo-600">Costo Base($)</th>}
                     <th className="p-3 text-center w-16">Cant.</th>
                     {advMode && <><th className="p-3 text-center w-16 bg-indigo-600">%G</th><th className="p-3 text-center w-16 bg-indigo-600">%R</th><th className="p-3 text-center w-16 bg-indigo-600">%C</th><th className="p-3 text-center w-16 bg-indigo-600">Rel.</th></>}
                     <th className="p-3 text-right">P. Unit ($)</th>
                     <th className="p-3 text-right">Subtotal</th>
                     <th className="p-3"></th>
                   </tr>
                 </thead>
                 <tbody>
                   {itemsCoti.map(item => {
                     const pUnitCalc = getPUnitario(item);
                      return (
                      <tr key={item.id} className="border-b hover:bg-slate-50 align-top">
                        <td className="p-2">
                          <select value={item.catalogoTipo || 'MANUAL'} onChange={(e)=>actualizarCatalogoItem(item.id, e.target.value, '')} className="mb-2 w-full border rounded px-2 py-1 text-xs font-bold">
                            <option value="MANUAL">Ítem manual</option>
                            <option value="PRODUCTO">Producto</option>
                            <option value="SERVICIO">Servicio</option>
                          </select>
                          {item.catalogoTipo === 'PRODUCTO' && (
                            <select value={item.productoId || ''} onChange={(e)=>actualizarCatalogoItem(item.id, 'PRODUCTO', e.target.value)} className="w-full border rounded px-2 py-1 text-xs">
                              <option value="">Selecciona producto</option>
                              {productos.filter((producto) => producto.activo).map((producto) => <option key={producto.id} value={producto.id}>{producto.codigoProducto ? `${producto.codigoProducto} - ` : ''}{producto.nombre}</option>)}
                            </select>
                          )}
                          {item.catalogoTipo === 'SERVICIO' && (
                            <select value={item.servicioId || ''} onChange={(e)=>actualizarCatalogoItem(item.id, 'SERVICIO', e.target.value)} className="w-full border rounded px-2 py-1 text-xs">
                              <option value="">Selecciona servicio</option>
                              {servicios.filter((servicio) => servicio.activo).map((servicio) => <option key={servicio.id} value={servicio.id}>{servicio.codigoServicio ? `${servicio.codigoServicio} - ` : ''}{servicio.nombre}</option>)}
                            </select>
                          )}
                        </td>
                        <td className="p-2"><textarea value={item.desc} onChange={(e)=>actualizarItem(item.id, 'desc', e.target.value)} rows={3} className="w-full border rounded px-2 py-2 outline-none resize-y min-h-[60px]" /></td>
                       {advMode && <td className="p-2"><input type="text" value={item.costo} onChange={(e)=>actualizarItem(item.id, 'costo', e.target.value)} className="w-20 border border-indigo-200 bg-indigo-50 rounded px-2 py-1 text-center" /></td>}
                       <td className="p-2"><input type="text" value={item.cant} onChange={(e)=>actualizarItem(item.id, 'cant', e.target.value)} className="w-full border rounded px-2 py-1 text-center" /></td>
                       {advMode && <>
                         <td className="p-2"><input type="text" value={item.gan} onChange={(e)=>actualizarItem(item.id, 'gan', e.target.value)} className="w-full border border-indigo-200 rounded px-1 py-1 text-center text-xs" /></td>
                         <td className="p-2"><input type="text" value={item.ret} onChange={(e)=>actualizarItem(item.id, 'ret', e.target.value)} className="w-full border border-indigo-200 rounded px-1 py-1 text-center text-xs" /></td>
                         <td className="p-2"><input type="text" value={item.com} onChange={(e)=>actualizarItem(item.id, 'com', e.target.value)} className="w-full border border-indigo-200 rounded px-1 py-1 text-center text-xs" /></td>
                         <td className="p-2"><input type="text" value={item.rel} onChange={(e)=>actualizarItem(item.id, 'rel', e.target.value)} className="w-full border border-indigo-200 rounded px-1 py-1 text-center text-xs" /></td>
                       </>}
                       <td className="p-2 text-right">{advMode ? <span className="font-medium text-slate-700 pt-2 block">{formatUsd(pUnitCalc)}</span> : <input type="text" value={item.unitarioManual} onChange={(e)=>actualizarItem(item.id, 'unitarioManual', e.target.value)} className="w-24 border rounded px-2 py-1 text-right focus:border-indigo-500 outline-none" />}</td>
                       <td className="p-2 text-right font-bold text-slate-800 pt-3">{formatUsd(pUnitCalc * parseVe(item.cant))}</td>
                       <td className="p-2 text-center pt-3"><button onClick={()=>eliminarItem(item.id)} className="text-red-500 text-xs font-bold">Eliminar</button></td>
                     </tr>
                   )})}
                 </tbody>
               </table>
                <div className="p-3 bg-slate-50 border-t"><button onClick={agregarItemCoti} className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm">+ Añadir ítem</button></div>
              </div>

             <div className="flex flex-col md:flex-row gap-6">
               <div className="flex-1"><label className="text-xs text-slate-500 font-bold uppercase mb-2 block">Términos y Condiciones</label><ReactQuill theme="snow" value={condiciones} onChange={setCondiciones} className="bg-white h-64 pb-10" /></div>
               <div className="text-right space-y-3 w-80 bg-slate-800 p-6 rounded-xl text-white h-fit mt-6">
                 <div className="flex justify-between text-sm text-slate-300"><span>SUBTOTAL</span><span className="font-semibold">{formatUsd(calcularSubtotal())}</span></div>
                 <div className="flex justify-between text-sm text-slate-400"><span>IVA 16%</span><span>{formatUsd(calcularIva())}</span></div>
                 <div className="border-t border-slate-600 my-2"></div>
                 <div className="flex justify-between text-2xl font-extrabold text-emerald-400"><span>TOTAL</span><span>{formatUsd(calcularTotal())}</span></div>
               </div>
             </div>
           </section>
        )}
      </main>

      {showStarlinkAlertModal && (
        <StarlinkAlertModal
          alertas={starlinkAlertas}
          onClose={cerrarAlertasStarlink}
          onOpenStarlink={abrirModuloStarlink}
        />
      )}

      {/* MODAL BUSQUEDA */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-[min(1100px,92vw)] max-h-[80vh] shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl">Historial</h3><button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500">Cerrar</button></div>
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full border p-3 rounded-lg mb-4 outline-none focus:border-indigo-500" />
            <div className="overflow-y-auto flex-1 border rounded-xl">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="p-3">Correlativo</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historialCoti.filter(c => {
                    const term = searchTerm.toLowerCase();
                    return (c.numero || '').toLowerCase().includes(term) || (c.cliente?.nombre || '').toLowerCase().includes(term) || documentoLabel(c.tipoDocumento).toLowerCase().includes(term);
                  }).map(c => (
                    <tr key={c.id} className="border-t hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-slate-800">{c.numero}</td>
                      <td className="p-3"><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{documentoLabel(c.tipoDocumento)}</span></td>
                      <td className="p-3 text-slate-700">{c.cliente?.nombre || '-'}</td>
                      <td className="p-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{c.estado || 'BORRADOR'}</span></td>
                      <td className="p-3 text-right font-bold">{formatUsd(c.total || 0)}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => cargarDesdeModal(c)} className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold mr-2">Cargar</button>
                        <button onClick={() => eliminarPropuesta(c)} className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
