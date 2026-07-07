"use client";
import { useState, useEffect } from 'react';
import currency from 'currency.js';
import dynamic from 'next/dynamic';
import DashboardView from './components/DashboardView';
import ContabilidadView from './components/ContabilidadView';
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

const DEFAULT_TERMS = `<p>Los servicios se rigen por los lineamientos de ISO/IEC 27001, NIST CSF.</p><br/><p><strong>Precios:</strong> Los precios est&aacute;n expresados en USD (D&oacute;lares) e incluyen el Impuesto al Valor Agregado (IVA), salvo que se indique lo contrario.</p><p><strong>Validez:</strong> Los precios son v&aacute;lidos &uacute;nicamente para este cliente y negociaci&oacute;n en particular.</p><p><strong>Financiamiento:</strong> Opci&oacute;n de pago en 3 cuotas mensuales (50% inicial y 2 cuotas de 25%) en bol&iacute;vares, calculadas al tipo de cambio oficial del Banco Central de Venezuela (BCV) vigente en la fecha de cada pago.</p><p><strong>Variaciones de Precio:</strong> El precio de todos los productos que componen esta propuesta est&aacute; sujeto a variaci&oacute;n sin previo aviso, seg&uacute;n las condiciones actuales del mercado.</p><p><strong>Aprobaci&oacute;n:</strong> La aprobaci&oacute;n debe ser enviada v&iacute;a correo electr&oacute;nico.</p><p><strong>Validez de la Oferta:</strong> Esta oferta tiene una validez de 07 d&iacute;as h&aacute;biles.</p><p><strong>Confidencialidad:</strong> La informaci&oacute;n relacionada con esta propuesta es absolutamente confidencial y para uso exclusivo de la empresa a quien va dirigida, quien se compromete a mantener y respetar la confidencialidad de la informaci&oacute;n.</p><p><strong>Recursos Humanos:</strong> La empresa que recibe la cotizaci&oacute;n se compromete a no efectuar ofrecimiento alguno de tipo laboral al personal asignado al servicio solicitado durante el desarrollo de este, y hasta por tres (3) a&ntilde;os contados a partir de la fecha de culminaci&oacute;n.</p><p><strong>Costo de Infraestructura:</strong> El costo de infraestructura necesario para la implementaci&oacute;n y funcionamiento del sistema correr&aacute; por cuenta del cliente.</p><p><strong>Garant&iacute;a de Servicio:</strong> Cualquier garant&iacute;a de servicio se especificar&aacute; en un acuerdo por separado y estar&aacute; sujeta a los t&eacute;rminos y condiciones acordados.</p><p><strong>Soporte T&eacute;cnico:</strong> El soporte t&eacute;cnico ser&aacute; proporcionado seg&uacute;n los t&eacute;rminos especificados en la propuesta y no incluye soporte adicional fuera del alcance definido sin un costo adicional.</p><p><strong>Modificaciones:</strong> Cualquier modificaci&oacute;n a los t&eacute;rminos de esta propuesta deber&aacute; ser acordada por ambas partes y documentada formalmente.</p><p><strong>Inicio de Labores:</strong> No se iniciar&aacute;n labores de ning&uacute;n tipo sin la respectiva Orden de Servicio y/o anticipo de EL CLIENTE.</p><p><strong>Impacto de Disposiciones Gubernamentales:</strong> Cualesquiera disposiciones de &iacute;ndole gubernamental cuyo impacto incida de manera directa en el estipendio de Servicios TAMIKA 0302, C.A. ser&aacute; considerado motivo para evaluar, conjuntamente, reajustes en las tarifas o cambios en los t&eacute;rminos comerciales.</p><p><strong>Servicios Incluidos:</strong> Esta oferta no incluye otros servicios o especialidades distintas a las expresamente se&ntilde;aladas.</p>`;
const DEFAULT_VIGENCIA = '15 días hábiles';

const parseVe = (str) => { if (!str && str !== 0) return 0; if (typeof str === 'number') return str; return parseFloat(str.toString().replace(/\./g, '').replace(',', '.')) || 0; };
const formatUsd = (val) => currency(val, { symbol: '$', separator: '.', decimal: ',' }).format();
const DOCUMENTO_OPTIONS = [
  { value: 'PROPUESTA', label: 'Propuesta' },
  { value: 'PRESUPUESTO', label: 'Presupuesto' },
];
const ESTADO_DOCUMENTO_OPTIONS = ['BORRADOR', 'APROBADO', 'CONVERTIDO', 'FACTURADO', 'ANULADO'];
const documentoLabel = (tipoDocumento) => (tipoDocumento === 'PRESUPUESTO' ? 'Presupuesto' : 'Propuesta');

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

  const [clientes, setClientes] = useState([]);
  const [historialCoti, setHistorialCoti] = useState([]);
  const [dashboardResumen, setDashboardResumen] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [tasaBCV, setTasaBCV] = useState('');
  const [tasaParalelo, setTasaParalelo] = useState('');
  const [tasaBcvActual, setTasaBcvActual] = useState(null);
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

  const [advMode, setAdvMode] = useState(true);
  const [defGan, setDefGan] = useState('0,30');
  const [defRet, setDefRet] = useState('0,116');
  const [defCom, setDefCom] = useState('0');
  const [defRel, setDefRel] = useState('1');
  const [itemsCoti, setItemsCoti] = useState([]);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoAlias, setNuevoAlias] = useState('');
  const [nuevoRif, setNuevoRif] = useState('');
  const [nuevaDir, setNuevaDir] = useState('');
  const [editandoId, setEditandoId] = useState(null);

  useEffect(() => { setIsMounted(true); cargarDatos(); }, []);
  useEffect(() => {
    if (!cotiEditandoId) cargarSiguienteCorrelativo(tipoDocumento);
  }, [tipoDocumento, cotiEditandoId]);

  const cargarSiguienteCorrelativo = async (tipo = tipoDocumento) => {
    try {
      const res = await fetch(`/api/propuestas/siguiente-correlativo?tipoDocumento=${tipo}`);
      const data = await res.json();
      if (res.ok && data.numero) setNroCoti(data.numero);
    } catch (error) {
      setNroCoti('');
    }
  };

  const cargarDatos = () => {
    fetch('/api/clientes').then(res => res.json()).then(data => setClientes(Array.isArray(data) ? data : []));
    fetch('/api/propuestas').then(res => res.json()).then(data => setHistorialCoti(Array.isArray(data) ? data : []));
    if (!cotiEditandoId) cargarSiguienteCorrelativo(tipoDocumento);
    fetch('/api/tasas').then(res => res.json()).then(data => {
      if (data && data.bcv > 0) { setTasaBCV(data.bcv.toString().replace('.', ',')); setTasaParalelo(data.paralelo.toString().replace('.', ',')); setDefRel((data.bcv / data.paralelo).toFixed(4).replace('.', ',')); }
    });
    setLoadingDashboard(true);
    fetch('/api/dashboard/resumen')
      .then(res => res.json())
      .then(data => setDashboardResumen(data))
      .catch(() => setDashboardResumen(null))
      .finally(() => setLoadingDashboard(false));
  };

  const consultarApiTasas = async () => {
    try {
      const resBcv = await fetch('/api/tasas/bcv'); const dataBcv = await resBcv.json();
      const resPar = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo'); const dataPar = await resPar.json();
      if (!resBcv.ok || !dataBcv.success || !dataBcv.tasa) throw new Error(dataBcv.message || 'No se pudo obtener la tasa BCV.');
      const bcv = Number(dataBcv.tasa);
      const paralelo = Number(dataPar.promedio || 0);
      setTasaBCV(bcv.toString().replace('.', ',')); setTasaParalelo(paralelo.toString().replace('.', ','));
      setTasaBcvActual({ tasa: bcv, fuente: dataBcv.fuente || 'BCV_API', fecha: dataBcv.fecha || '', version: Date.now() });
      if (bcv > 0 && paralelo > 0) handleGlobalChange('defRel', 'rel', (bcv / paralelo).toFixed(4).replace('.', ','));
      alert("Tasas actualizadas.");
    } catch (e) { alert("Error API."); }
  };

  const guardarTasaBD = async () => {
    if (parseVe(tasaBCV) <= 0) return alert("Valores inválidos.");
    await fetch('/api/tasas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bcv: parseVe(tasaBCV), paralelo: parseVe(tasaParalelo) }) });
    setTasaBcvActual({ tasa: parseVe(tasaBCV), fuente: 'MANUAL', fecha: new Date().toISOString(), version: Date.now() });
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
    setItemsCoti([]);
    cargarSiguienteCorrelativo('PROPUESTA');
  };
  const agregarItemCoti = () => setItemsCoti([...itemsCoti, { id: Date.now(), desc: '', cant: '1', costo: '0', gan: defGan, ret: defRet, com: defCom, rel: defRel, unitarioManual: '0' }]);
  const actualizarItem = (id, campo, valor) => setItemsCoti(itemsCoti.map(item => item.id === id ? { ...item, [campo]: valor } : item));
  const eliminarItem = (id) => setItemsCoti(itemsCoti.filter(item => item.id !== id));
  const getPUnitario = (item) => { if (advMode) return (parseVe(item.costo) * (1 + parseVe(item.gan))) / ((parseVe(item.rel)||1) * (1 - parseVe(item.ret)) * (1 - parseVe(item.com))); return parseVe(item.unitarioManual); };
  const calcularSubtotal = () => itemsCoti.reduce((acc, item) => acc + (getPUnitario(item) * parseVe(item.cant)), 0);
  const calcularIva = () => calcularSubtotal() * 0.16;
  const calcularTotal = () => calcularSubtotal() + calcularIva();

  const guardarCotizacionBD = async () => {
    if(!clienteSelect) return alert("Selecciona un cliente.");
    const payload = { tipoDocumento, estado: estadoDocumento, clienteId: clienteSelect, titulo: tituloCoti, vigencia, condiciones, subtotal: calcularSubtotal(), iva: calcularIva(), total: calcularTotal(), items: itemsCoti };
    const res = await fetch(cotiEditandoId ? `/api/propuestas/${cotiEditandoId}` : '/api/propuestas', { method: cotiEditandoId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
    setItemsCoti(Array.isArray(coti.items) ? coti.items : []);
    setShowModal(false);
  };

  const eliminarPropuesta = async (coti) => {
    if (!confirm(`Eliminar ${documentoLabel(coti.tipoDocumento)} ${coti.numero}?`)) return;
    const res = await fetch(`/api/propuestas/${coti.id}`, { method: 'DELETE' });
    if (!res.ok) return alert("No se pudo eliminar el documento.");
    if (cotiEditandoId === coti.id) limpiarFormulario();
    cargarDatos();
  };

  const guardarCliente = async (e) => {
    e.preventDefault();
    await fetch(editandoId ? `/api/clientes/${editandoId}` : '/api/clientes', { method: editandoId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nuevoNombre, alias: nuevoAlias, rif: nuevoRif, direccion: nuevaDir }) });
    setEditandoId(null); setNuevoNombre(''); setNuevoAlias(''); setNuevoRif(''); setNuevaDir(''); cargarDatos();
  };
  const iniciarEdicion = (cli) => { setEditandoId(cli.id); setNuevoNombre(cli.nombre); setNuevoAlias(cli.alias || ''); setNuevoRif(cli.rif); setNuevaDir(cli.direccion || ''); };
  const eliminarCliente = async (id) => { if(confirm('¿Eliminar cliente?')) { await fetch(`/api/clientes/${id}`, { method: 'DELETE' }); cargarDatos(); } };


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

      const tableBody = [
        [
          { text: 'DESCRIPCIÓN', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 9, margin: [5, 6], border: [false, false, false, false] },
          { text: 'CANT.', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 9, alignment: 'center', margin: [5, 6], border: [false, false, false, false] },
          { text: 'PRECIO UNID.', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 9, alignment: 'right', margin: [5, 6], border: [false, false, false, false] },
          { text: 'TOTAL USD', fillColor: '#1e293b', color: 'white', bold: true, fontSize: 9, alignment: 'right', margin: [5, 6], border: [false, false, false, false] }
        ]
      ];

      itemsCoti.forEach((item, idx) => {
        const pUnit = getPUnitario(item);
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        tableBody.push([
          { text: item.desc || ' ', fontSize: 9, color: '#1e293b', margin: [5, 8], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] },
          { text: item.cant ? item.cant.toString() : '0', fontSize: 9, color: '#1e293b', alignment: 'center', margin: [5, 8], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] },
          { text: formatUsd(pUnit), fontSize: 9, color: '#1e293b', alignment: 'right', margin: [5, 8], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] },
          { text: formatUsd(pUnit * parseVe(item.cant)), fontSize: 9, bold: true, color: '#0f172a', alignment: 'right', margin: [5, 8], fillColor: bg, border: [false, false, false, true], borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'] }
        ]);
      });

      const terminosFormateados = htmlToPdfmake(condiciones, {
        window: window,
        defaultStyles: { p: { fontSize: 8, color: '#475569', margin: [0, 0, 0, 5], alignment: 'justify' }, strong: { bold: true, color: '#0f172a' } }
      });

      // Estilo para las cajas con "cuerpo"
      const cardStyle = { fillColor: '#ffffff', border: [true, true, true, true], borderColor: ['#cbd5e1', '#cbd5e1', '#cbd5e1', '#cbd5e1'] };
      const cardHeaderStyle = { fillColor: '#f1f5f9', border: [true, true, true, false], borderColor: ['#cbd5e1', '#cbd5e1', '#cbd5e1', '#cbd5e1'] };

      const docDefinition = {
        pageSize: 'LETTER',
        pageMargins: [40, 115, 40, 60],

        header: function(currentPage, pageCount) {
          return {
            margin: [40, 30, 40, 0],
            columns: [
              {
                width: 'auto',
                // Logo reducido a 55px
                image: logoBase64 || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
                width: 55,
                margin: [0, 0, 0, 0]
              },
              {
                width: '*',
                stack: [
                  // Texto aumentado de tamaño y movido 15px a la derecha
                  { text: 'Servicios Tamika 0302, C.A.', fontSize: 17, bold: true, color: '#0f172a' },
                  { text: 'RIF: J-50634330-4', fontSize: 11, bold: true, color: '#475569' }
                ],
                margin: [15, 10, 0, 0]
              },
              {
                width: 150,
                alignment: 'right',
                stack: [
                  { text: nombreDocumento.toUpperCase(), fontSize: 20, bold: true, color: '#94a3b8', characterSpacing: 2 },
                  { text: `Fecha: ${d.toLocaleDateString('es-VE')}`, fontSize: 10, color: '#0f172a', margin: [0, 5, 0, 0] },
                  { text: `Nro. ${nroCoti || 'Pendiente'}`, fontSize: 11, bold: true, color: '#0f172a' },
                  { text: `(Pag ${currentPage}/${pageCount})`, fontSize: 9, bold: true, color: '#94a3b8', margin: [0, 2, 0, 0] }
                ]
              }
            ]
          };
        },

        content: [
          {
            columns: [
              // CAJA CLIENTE CON CUERPO
              {
                width: '*',
                table: {
                  widths: ['*'],
                  body: [
                    [{ text: 'FACTURAR A:', fontSize: 8, bold: true, color: '#475569', margin: [10, 8], ...cardHeaderStyle }],
                    [{
                      stack: [
                        { text: c?.nombre || 'Consumidor Final', fontSize: 11, bold: true, color: '#0f172a' },
                        { text: `RIF: ${c?.rif || 'N/A'}`, fontSize: 9, color: '#475569', margin: [0, 4, 0, 4] },
                        { text: c?.direccion || '', fontSize: 9, color: '#475569', lineHeight: 1.2 }
                      ],
                      margin: [10, 10], ...cardStyle
                    }]
                  ]
                },
                layout: 'noBorders'
              },
              { width: 25, text: '' },
              // CAJA EMISOR CON CUERPO
              {
                width: '*',
                table: {
                  widths: ['*'],
                  body: [
                    [{ text: 'EMPRESA EMISORA:', fontSize: 8, bold: true, color: '#475569', margin: [10, 8], ...cardHeaderStyle }],
                    [{
                      stack: [
                        { text: 'Servicios TAMIKA 0302, C.A.', fontSize: 10, bold: true, color: '#0f172a' },
                        { text: 'RIF: J-50634330-4', fontSize: 9, color: '#475569', margin: [0, 4, 0, 4] },
                        { text: 'Carretera Vieja Caracas - Baruta, Torre Gamma, Piso 9. Apto 9-B. Caracas - Venezuela.', fontSize: 9, color: '#475569', lineHeight: 1.2 },
                        { text: 'Teléfono: +58 414-2087167', fontSize: 9, bold: true, color: '#0f172a', margin: [0, 4, 0, 2] },
                        { text: 'www.serviciostamika.com', fontSize: 9, color: '#475569' }
                      ],
                      margin: [10, 10], ...cardStyle
                    }]
                  ]
                },
                layout: 'noBorders'
              }
            ],
            margin: [0, 0, 0, 25]
          },

          tituloCoti ? { text: tituloCoti, alignment: 'center', bold: true, color: '#0f172a', fontSize: 12, margin: [0,0,0,15] } : null,

          // TABLA DE ITEMS
          {
            table: {
              headerRows: 1,
              widths: ['*', 40, 80, 90],
              body: tableBody
            },
            layout: 'noBorders', // Los bordes se manejan a nivel de celda
            margin: [0, 0, 0, 20]
          },

          // CUADRO DE TOTALES CON FONDO
          {
            columns: [
              { width: '*', text: '' },
              {
                width: 240,
                table: {
                  widths: ['*', '*'],
                  body: [
                    [{ text: 'SUBTOTAL USD', fontSize: 10, color: '#475569', margin: [12, 12, 0, 5] }, { text: formatUsd(calcularSubtotal()), fontSize: 10, bold: true, alignment: 'right', margin: [0, 12, 12, 5] }],
                    [{ text: 'IVA (16%)', fontSize: 10, color: '#475569', margin: [12, 0, 0, 12] }, { text: formatUsd(calcularIva()), fontSize: 10, bold: true, alignment: 'right', margin: [0, 0, 12, 12] }],
                    [{ text: 'TOTAL USD', fontSize: 15, bold: true, color: '#ffffff', fillColor: '#0f172a', margin: [12, 12, 0, 12] }, { text: formatUsd(calcularTotal()), fontSize: 15, bold: true, color: '#34d399', fillColor: '#0f172a', alignment: 'right', margin: [0, 12, 12, 12] }]
                  ]
                },
                layout: {
                  fillColor: '#f8fafc', // Fondo gris claro para el bloque
                  hLineWidth: function (i, node) { return 0; }, vLineWidth: function (i, node) { return 0; }
                },
                margin: [0, 0, 0, 30] // Margen inferior para separar de términos
              }
            ]
          },

          { text: 'TÉRMINOS Y CONDICIONES GENERALES', fontSize: 10, color: '#0f172a', bold: true, margin: [0, 0, 0, 10] },
          ...terminosFormateados,

          // ===============================================
          // BLOQUE DE FIRMA UNIFICADA (SIN TEXTO DUPLICADO)
          // ===============================================
          {
            unbreakable: true,
            margin: [0, 40, 0, 0],
            alignment: 'center',
            stack: [
              // SOLO LA IMAGEN, sin texto abajo
              firmaUnificadaBase64 ? { image: firmaUnificadaBase64, width: 300, alignment: 'center' } : { text: '\n\n\n\n' }
            ]
          }
        ]
      };

      if (accion === 'abrir') {
        pdfMake.createPdf(docDefinition).open();
      } else {
        pdfMake.createPdf(docDefinition).download(cleanTitle);
      }
    } catch (err) {
      console.error(err);
      alert("Hubo un error interno al compilar el documento: " + err.message);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex min-h-screen font-sans bg-slate-50 text-slate-900 overflow-x-hidden">
      <aside className="w-80 bg-slate-900 text-slate-100 p-5 flex flex-col gap-4 fixed h-full shadow-xl overflow-y-auto z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl border border-slate-700 bg-white">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
          </div>
          <div><h1 className="text-lg font-bold leading-tight">TAMIKA ERP</h1></div>
        </div>
        <nav className="flex flex-col gap-2">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'cotizacion', label: 'Propuestas' },
            { id: 'contabilidad', label: 'Contabilidad' },
            { id: 'catalogos', label: 'Catálogos' },
          ].map((view) => (
            <button key={view.id} onClick={() => setActiveView(view.id)} className={`text-left px-4 py-3 rounded-lg font-medium ${activeView === view.id ? 'bg-slate-700 text-emerald-400' : 'hover:bg-slate-800 text-slate-300'}`}>{view.label}</button>
          ))}
        </nav>
        <div className="bg-slate-800 rounded-xl p-4 mt-6 border border-slate-700">
          <h3 className="text-sm font-bold text-white mb-3">Tasas del Día</h3>
          <div className="flex gap-2 mb-3"><button onClick={consultarApiTasas} className="flex-1 bg-indigo-600 text-white text-xs py-1 rounded shadow">API</button><button onClick={guardarTasaBD} className="flex-1 bg-emerald-600 text-white text-xs py-1 rounded shadow">Guardar</button></div>
          <div className="space-y-3">
            <div><label className="text-xs text-slate-400">BCV</label><input type="text" value={tasaBCV} onChange={(e) => handleTasasChange('bcv', e.target.value)} className="w-full bg-slate-700 text-white border-none rounded px-3 py-2 text-sm outline-none mt-1" /></div>
            <div><label className="text-xs text-slate-400">Paralelo</label><input type="text" value={tasaParalelo} onChange={(e) => handleTasasChange('par', e.target.value)} className="w-full bg-slate-700 text-white border-none rounded px-3 py-2 text-sm outline-none mt-1" /></div>
            <div className="pt-2 border-t border-slate-700"><label className="text-xs text-slate-400">Relación</label><input type="text" value={defRel} readOnly className="w-full bg-slate-900 text-emerald-400 font-mono font-bold rounded px-3 py-2 text-sm outline-none mt-1 text-right" /></div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 space-y-6 ml-80 relative">
        {activeView === 'dashboard' && (<DashboardView resumen={dashboardResumen} loading={loadingDashboard} />)}

        {activeView === 'contabilidad' && (
          <ContabilidadView clientes={clientes} onChanged={cargarDatos} tasaBcvActual={tasaBcvActual} />
        )}

        {/* CATALOGOS */}
        {activeView === 'catalogos' && (
          <section className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
            <h2 className="text-xl font-bold mb-4">{editandoId ? 'Editar Cliente' : 'Gestión de Clientes'}</h2>
            <form onSubmit={guardarCliente} className="grid grid-cols-4 gap-3 mb-6 p-4 rounded-xl border bg-slate-50 items-end">
              <div className="col-span-1"><label className="text-xs text-slate-500 font-bold">Razón Social</label><input type="text" required value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
              <div className="col-span-1"><label className="text-xs text-slate-500 font-bold">Alias (Corto para PDF)</label><input type="text" placeholder="Ej: MPPOP" value={nuevoAlias} onChange={(e) => setNuevoAlias(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
              <div className="col-span-1"><label className="text-xs text-slate-500 font-bold">RIF</label><input type="text" required value={nuevoRif} onChange={(e) => setNuevoRif(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
              <div className="col-span-1"><button type="submit" className="w-full py-2 text-white bg-slate-900 rounded-lg text-sm font-medium">Guardar</button></div>
              <div className="col-span-4"><label className="text-xs text-slate-500 font-bold">Dirección Fiscal</label><input type="text" value={nuevaDir} onChange={(e) => setNuevaDir(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none" /></div>
            </form>
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-100 text-sm"><th className="p-3">Nombre</th><th className="p-3">Alias</th><th className="p-3">RIF</th><th className="p-3 text-right">Acción</th></tr></thead>
              <tbody className="text-sm">
                {clientes.map(cli => (
                  <tr key={cli.id} className="border-b hover:bg-slate-50"><td className="p-3 font-medium">{cli.nombre}</td><td className="p-3 font-bold text-indigo-600">{cli.alias || '-'}</td><td className="p-3 text-slate-500">{cli.rif}</td><td className="p-3 text-right"><button onClick={() => iniciarEdicion(cli)} className="text-blue-600 font-medium mr-4">Editar</button><button onClick={() => eliminarCliente(cli.id)} className="text-red-500 font-medium">Eliminar</button></td></tr>
                ))}
              </tbody>
            </table>
          </section>
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

             <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">Cliente</label>
                  <select value={clienteSelect} onChange={(e) => setClienteSelect(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    <option value="">-- Selecciona un Cliente --</option>
                    {clientes.map(cli => ( <option key={cli.id} value={cli.id}>{cli.nombre} ({cli.alias})</option> ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 font-bold uppercase">Titulo del documento</label>
                  <input type="text" value={tituloCoti} onChange={(e)=>setTituloCoti(e.target.value)} placeholder="Ej: Presupuesto de Suministros..." className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase">Tipo</label>
                  <select value={tipoDocumento} onChange={(e)=>setTipoDocumento(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    {DOCUMENTO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase">Estado</label>
                  <select value={estadoDocumento} onChange={(e)=>setEstadoDocumento(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                    {ESTADO_DOCUMENTO_OPTIONS.map(estado => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase">Correlativo</label>
                  <input type="text" value={nroCoti || 'Generando...'} readOnly className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none bg-slate-100 text-slate-700 font-mono font-bold" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold uppercase">Vigencia</label>
                  <input type="text" value={vigencia} onChange={(e)=>setVigencia(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm outline-none" />
                </div>
             </div>

             <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
               <label className="flex items-center gap-2 font-bold text-indigo-900 cursor-pointer">
                 <input type="checkbox" checked={advMode} onChange={toggleModoAvanzado} className="w-4 h-4 accent-indigo-600" /> Mostrar campos avanzados
               </label>
               {advMode && (
                 <div className="grid grid-cols-4 gap-4 text-sm pt-3 mt-3 border-t border-indigo-200">
                   <div><label className="block text-xs font-bold text-indigo-700">% Gan</label><input type="text" value={defGan} onChange={(e)=>handleGlobalChange('defGan', 'gan', e.target.value)} className="w-full border rounded px-3 py-2" /></div>
                   <div><label className="block text-xs font-bold text-indigo-700">% Ret</label><input type="text" value={defRet} onChange={(e)=>handleGlobalChange('defRet', 'ret', e.target.value)} className="w-full border rounded px-3 py-2" /></div>
                   <div><label className="block text-xs font-bold text-indigo-700">% Com</label><input type="text" value={defCom} onChange={(e)=>handleGlobalChange('defCom', 'com', e.target.value)} className="w-full border rounded px-3 py-2" /></div>
                   <div><label className="block text-xs font-bold text-indigo-700">Relación</label><input type="text" value={defRel} onChange={(e)=>handleGlobalChange('defRel', 'rel', e.target.value)} className="w-full border rounded px-3 py-2 bg-white" /></div>
                 </div>
               )}
             </div>

             <div className="border rounded-xl overflow-x-auto shadow-sm">
               <table className="w-full text-left text-sm min-w-max">
                 <thead className="bg-slate-800 text-white">
                   <tr>
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
               <div className="p-3 bg-slate-50 border-t"><button onClick={agregarItemCoti} className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm">+ Añadir Servicio</button></div>
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
