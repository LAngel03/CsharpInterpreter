/* ════ Guardia de acceso: solo admins con sesión llegan aquí ════ */
const RUTA_LOGIN = '../index.html';

(function protegerPanelAdmin() {
    if (!window.ApiClient || !ApiClient.haySesion()) {
        window.location.href = RUTA_LOGIN;
        return;
    }
    const usuario = ApiClient.obtenerUsuarioLocal();
    const esAdmin = usuario && typeof usuario.rol === 'string' && usuario.rol.toLowerCase() === 'admin';
    if (!esAdmin) {
        window.location.href = RUTA_LOGIN;
    }
})();

/* ════════ Estado global ════════ */
let temaActual = null, originalSnapshot = null, monacoEditor = null;
let dirtySecciones = { concepto: false, ejemplos: false };
// Se pone en true mientras el código carga el editor por su cuenta (cambio de
// pestaña, cancelar, etc.) para que Monaco no dispare markDirty por eso.
let suprimirDirtyEditor = false;
let estudiantesCache = [];

// Filtro activo de la tabla de usuarios: 'todos' | 'pendientes' | 'activos'
let filtroUsuarios = 'todos';

/* ════ Inicio: usuarios (conectado a GET /api/usuarios) ════ */

// La vista v_estudiantes ahora devuelve la columna "activo".
// Se normaliza porque un registro viejo podría llegar como null/undefined:
// en ese caso lo tratamos como ACTIVO (para no bloquear a nadie por accidente).
function estaActivo(e) { return e.activo !== false; }
// Formatea la fecha de registro: 13/07/2026
function fechaRegistro(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
/* Pide los estudiantes a la API y los pinta */
async function pintarUsuarios() {
    const tbody = document.getElementById("userRows");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px">Cargando estudiantes…</td></tr>`;

    try {
        const data = await ApiClient.listarEstudiantes();

        // Orden: primero los PENDIENTES de activación (para que salten a la vista),
        // y dentro de cada grupo, por puntos (ranking).
        estudiantesCache = [...data].sort((a, b) => {
            const pa = estaActivo(a) ? 1 : 0;
            const pb = estaActivo(b) ? 1 : 0;
            if (pa !== pb) return pa - pb;                       // inactivos arriba
            return (b.puntos_totales ?? 0) - (a.puntos_totales ?? 0);
        });

        const pendientes = estudiantesCache.filter(e => !estaActivo(e)).length;

        document.getElementById('statEstudiantes').textContent = estudiantesCache.length;

        // Contador de pendientes (solo si existe el elemento en el HTML)
        const statPend = document.getElementById('statPendientes');
        if (statPend) statPend.textContent = pendientes;

        renderTablaUsuarios();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger,#eb5757)">No se pudieron cargar los estudiantes: ${err.message}</td></tr>`;
    }
}

/* Dibuja la tabla a partir del caché, aplicando el filtro actual */
function renderTablaUsuarios() {
    const tbody = document.getElementById("userRows");
    if (!tbody) return;

    let lista = estudiantesCache;
    if (filtroUsuarios === 'pendientes') lista = estudiantesCache.filter(e => !estaActivo(e));
    else if (filtroUsuarios === 'activos') lista = estudiantesCache.filter(e => estaActivo(e));

    if (lista.length === 0) {
        const msg = filtroUsuarios === 'pendientes'
            ? 'No hay estudiantes pendientes de activación.'
            : 'Aún no hay estudiantes registrados.';
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px">${msg}</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map((e, i) => {
        const pos = i + 1, rc = pos <= 3 ? ` rank--${pos}` : "";
        const nombreCompleto = e.nombre_completo || `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno}`;
        const grupoTxt = e.grupo ? `Grupo ${e.grupo}` : 'Sin grupo';
        const activo = estaActivo(e);

        // Celda de estado: etiqueta + interruptor
        const estadoCell = activo
            ? `<span class="badge">Activo</span>
               <button class="btn-estado btn-estado--off" onclick="cambiarEstadoUsuario(${e.id}, false)" title="Desactivar a este estudiante">Desactivar</button>`
            : `<span class="badge badge--pend">Pendiente</span>
               <button class="btn-estado btn-estado--on" onclick="cambiarEstadoUsuario(${e.id}, true)" title="Permitir que este estudiante inicie sesión">Activar</button>`;

        return `<tr class="${activo ? '' : 'fila-pendiente'}">
                <td class="num"><span class="rank${rc}">${pos}</span></td>
                <td><div class="u-cell"></div><div class="u-name"><b>${nombreCompleto}</b><small>${grupoTxt}</small></div></div></td>
                <td><span class="matricula">${e.matricula}</span></td>
                <td><div class="prog"><span class="prog__num">${e.ejercicios_resueltos ?? 0} ejercicios · ${e.puntos_totales ?? 0} pts</span></div></td>
                <td class="num"><span class="badge">${fechaRegistro(e.creado_en)}</span></td>
                <td><div class="estado-cell">${estadoCell}</div></td>
                <td><div class="row-actions">
                    <button class="icon-btn" title="Editar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                    <button class="icon-btn danger" title="Eliminar" onclick="eliminarUsuario(${e.id})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
                </div></td></tr>`;
    }).join("");
}

/* Activa o desactiva a un estudiante (PATCH /api/usuarios/:id/activo) */
async function cambiarEstadoUsuario(id, activar) {
    if (!activar && !confirm('¿Desactivar a este estudiante? No podrá iniciar sesión hasta que lo actives de nuevo.')) return;

    // Deshabilita los botones de esa fila mientras se procesa, para evitar doble clic
    const botones = document.querySelectorAll(`.estado-cell button[onclick*="(${id},"]`);
    botones.forEach(b => { b.disabled = true; b.textContent = '…'; });

    try {
        await ApiClient.cambiarActivoEstudiante(id, activar);

        // Actualiza el caché en memoria y repinta (sin recargar toda la lista)
        const est = estudiantesCache.find(e => e.id === id);
        if (est) est.activo = activar;

        const pendientes = estudiantesCache.filter(e => !estaActivo(e)).length;
        const statPend = document.getElementById('statPendientes');
        if (statPend) statPend.textContent = pendientes;

        renderTablaUsuarios();

    } catch (err) {
        alert('No se pudo cambiar el estado: ' + err.message);
        renderTablaUsuarios();   // restaura los botones
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar a este estudiante? Esta acción no se puede deshacer.')) return;
    try {
        await ApiClient.eliminarEstudiante(id);
        await pintarUsuarios();
    } catch (err) {
        alert('No se pudo eliminar: ' + err.message);
    }
}

pintarUsuarios();

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

// Abrir/cerrar el sidebar en móvil (click del botón hamburguesa + overlay)
// lo maneja el <script> inline al final de indexAdministrador.html — aquí
// solo queda closeSidebar(), que sí se usa más abajo al elegir un tema.
// (Antes había un segundo listener duplicado aquí mismo: al hacer click
// se abría y, en el mismo evento, el otro listener lo veía "abierto" y lo
// volvía a cerrar — por eso el menú nunca se desplegaba.)
function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
}

/* ════ Navegación del sidebar → vista de edición de temas ════ */
const viewInicio = document.getElementById('view-inicio');
const viewTema = document.getElementById('view-tema');
const btnInicio = document.getElementById('btn-inicio');

function mostrarVistaInicio() {
    if (viewTema) viewTema.classList.remove('show');
    if (viewInicio) viewInicio.classList.add('show');
}

function mostrarVistaTema(slug) {
    if (viewInicio) viewInicio.classList.remove('show');
    if (viewTema) viewTema.classList.add('show');
    cargarTema(slug);
}

// Temas que no vienen de la API (100% locales en el simulador del alumno):
// editarlos aquí no tendría ningún efecto para los estudiantes.
// Recursividad y Archivos ya se conectaron a la API — se quitaron de esta lista.
const TEMAS_NO_EDITABLES = ['Glosario'];

document.querySelectorAll('.nav-sub-btn[data-tema]:not(.has-sub2), .nav-sub2-btn[data-tema], .nav-btn[data-tema]:not(.has-sub)').forEach(btn => {
    btn.addEventListener('click', () => {
        const tema = btn.dataset.tema;
        if (!tema) return;
        if (TEMAS_NO_EDITABLES.includes(tema)) {
            alert('Este tema todavía no está conectado a la base de datos: no se puede editar desde el panel.');
            return;
        }
        if (!confirmDiscard()) return;
        mostrarVistaTema(tema);
        if (window.innerWidth < 768) closeSidebar();
    });
});

if (btnInicio) {
    btnInicio.addEventListener('click', () => {
        if (!confirmDiscard()) return;
        mostrarVistaInicio();
        if (window.innerWidth < 768) closeSidebar();
    });
}

/* ════ Ejemplos y ejercicio del tema ════
   itemsActuales: [{tipo:'ejemplo', codigo, enunciado}] o
   [{tipo:'ejercicio', codigo, descripcion, titulo}].
   Los ejemplos viven en su propia tabla del backend (subtema.ejemplos,
   ya ordenada por "orden"); se sincronizan por posición igual que los
   ejercicios — el panel no necesita el id individual de cada fila. */
let itemsActuales = [];
let tabActivo = 0;

// Etiquetas "Ejemplo N" / "Ejercicio N" según la posición dentro de su propio tipo
function etiquetasItems() {
    let iEj = 0, iEjer = 0;
    return itemsActuales.map(it => {
        if (it.tipo === 'ejercicio') { iEjer++; return 'Ejercicio ' + iEjer; }
        iEj++; return 'Ejemplo ' + iEj;
    });
}

function renderEditorTabs() {
    const cont = document.getElementById('editorTabs');
    if (!cont) return;
    const etiquetas = etiquetasItems();

    cont.innerHTML = itemsActuales.map((item, i) => {
        const esUltimoEjemplo = item.tipo === 'ejemplo' && itemsActuales.filter(x => x.tipo === 'ejemplo').length === 1;
        const claseTipo = item.tipo === 'ejercicio' ? ' ejercicio' : '';
        const claseActivo = i === tabActivo ? ' activo' : '';
        const quitar = esUltimoEjemplo ? '' : `<span class="tab-remove" data-tab-remove="${i}" title="Quitar">&times;</span>`;
        return `<span class="sim-tab${claseTipo}${claseActivo}" data-tab="${i}">${etiquetas[i]}${quitar}</span>`;
    }).join('');

    cont.querySelectorAll('[data-tab-remove]').forEach(el => {
        el.addEventListener('click', (ev) => { ev.stopPropagation(); eliminarTab(Number(el.dataset.tabRemove)); });
    });
    cont.querySelectorAll('.sim-tab').forEach(el => {
        el.addEventListener('click', () => seleccionarTab(Number(el.dataset.tab)));
    });
}

// Guarda en itemsActuales lo que haya en el editor/enunciado antes de cambiar de pestaña
function volcarTabActivaAEstado() {
    const item = itemsActuales[tabActivo];
    if (!item) return;
    item.codigo = getCodigoActual();
    if (item.tipo === 'ejercicio') {
        const elEnun = document.getElementById('f-enunciado');
        if (elEnun) item.descripcion = elEnun.value;
        const elTit = document.getElementById('f-titulo-ejercicio');
        if (elTit) item.titulo = elTit.value;
    } else {
        const elEnunEj = document.getElementById('f-enunciado-ejemplo');
        if (elEnunEj) item.enunciado = elEnunEj.value;
        const elTitEj = document.getElementById('f-titulo-ejemplo');
        if (elTitEj) item.titulo = elTitEj.value;
    }
}

function seleccionarTab(i, { volcar = true } = {}) {
    if (volcar) volcarTabActivaAEstado();
    tabActivo = Math.max(0, Math.min(i, itemsActuales.length - 1));
    const item = itemsActuales[tabActivo];
    if (!item) return;

    document.querySelectorAll('#editorTabs .sim-tab').forEach(el => {
        el.classList.toggle('activo', Number(el.dataset.tab) === tabActivo);
    });

    const esEjercicio = item.tipo === 'ejercicio';
    const enunciadoWrap = document.getElementById('enunciadoWrap');
    if (enunciadoWrap) enunciadoWrap.style.display = esEjercicio ? '' : 'none';
    const tituloWrap = document.getElementById('tituloEjercicioWrap');
    if (tituloWrap) tituloWrap.style.display = esEjercicio ? '' : 'none';
    if (esEjercicio) {
        document.getElementById('f-enunciado').value = item.descripcion || '';
        document.getElementById('f-titulo-ejercicio').value = item.titulo || '';
    }

    const enunciadoEjemploWrap = document.getElementById('enunciadoEjemploWrap');
    if (enunciadoEjemploWrap) enunciadoEjemploWrap.style.display = esEjercicio ? 'none' : '';
    const tituloEjemploWrap = document.getElementById('tituloEjemploWrap');
    if (tituloEjemploWrap) tituloEjemploWrap.style.display = esEjercicio ? 'none' : '';
    if (!esEjercicio) {
        document.getElementById('f-enunciado-ejemplo').value = item.enunciado || '';
        document.getElementById('f-titulo-ejemplo').value = item.titulo || '';
    }

    if (monacoEditor) {
        // setValue() dispara onDidChangeModelContent aunque el cambio sea
        // programático (no del usuario) — se silencia para no marcar dirty
        // solo por cambiar de pestaña. AdmConsola sí vuelve a ejecutar la
        // simulación con el código de la pestaña nueva (eso siempre debe pasar).
        suprimirDirtyEditor = true;
        AdmConsola.cargarCodigo(item.codigo || '');
        suprimirDirtyEditor = false;
    } else {
        document.getElementById('codeFallback').value = item.codigo || '';
    }
}

function agregarEjemplo() {
    volcarTabActivaAEstado();
    itemsActuales.push({ tipo: 'ejemplo', codigo: '', enunciado: '', titulo: '' });
    renderEditorTabs();
    seleccionarTab(itemsActuales.length - 1, { volcar: false });
    markDirty('ejemplos');
    // Deja el cursor listo para escribir el código del ejemplo nuevo.
    if (monacoEditor) monacoEditor.focus();
    else document.getElementById('codeFallback').focus();
}

function agregarEjercicio() {
    volcarTabActivaAEstado();
    itemsActuales.push({ tipo: 'ejercicio', codigo: '', descripcion: '', titulo: '' });
    renderEditorTabs();
    seleccionarTab(itemsActuales.length - 1, { volcar: false });
    markDirty('ejemplos');
    // El título es lo primero que se pide, así que el cursor arranca ahí.
    const elTit = document.getElementById('f-titulo-ejercicio');
    if (elTit) elTit.focus();
}

function eliminarTab(i) {
    const item = itemsActuales[i];
    if (!item) return;
    const esUltimoEjemplo = item.tipo === 'ejemplo' && itemsActuales.filter(x => x.tipo === 'ejemplo').length === 1;
    if (esUltimoEjemplo) { alert('Debe quedar al menos un ejemplo.'); return; }
    if (!confirm('¿Quitar esta pestaña? Su contenido se perderá al guardar.')) return;
    itemsActuales.splice(i, 1);
    renderEditorTabs();
    seleccionarTab(Math.min(i, itemsActuales.length - 1), { volcar: false });
    markDirty('ejemplos');
}

/* ════ Carga de un tema (conectado a GET /api/subtemas/slug/:slug) ════ */
async function cargarTema(slug) {
    // Corta cualquier reproducción en curso del tema anterior antes de cargar uno nuevo.
    if (window.AdmConsola) AdmConsola.limpiar();

    let t;
    try {
        t = await cargarTemaDesdeAPI(slug);
    } catch (err) {
        flashStatus('No se pudo cargar el tema', false);
        console.error(err);
        return;
    }
    if (!t) return;

    // Los ejemplos viven en su propia tabla (t.ejemplos), ya ordenada por
    // "orden" desde el backend.
    itemsActuales = (Array.isArray(t.ejemplos) ? t.ejemplos : []).map(ej => ({
        tipo: 'ejemplo', codigo: ej.codigo || '', enunciado: ej.enunciado || '', titulo: ej.titulo || ''
    }));
    (Array.isArray(t.ejercicios) ? t.ejercicios : []).forEach(ej => {
        itemsActuales.push({ tipo: 'ejercicio', codigo: ej.codigo_csharp || '', descripcion: ej.descripcion || '', titulo: ej.titulo || '' });
    });
    if (!itemsActuales.length) itemsActuales.push({ tipo: 'ejemplo', codigo: '', enunciado: '', titulo: '' });

    temaActual = slug;
    document.getElementById('temaTitulo').textContent = t.titulo;
    document.getElementById('f-titulo').value = t.titulo;
    document.getElementById('f-definicion').value = t.definicion;

    renderEditorTabs();
    seleccionarTab(0, { volcar: false });

    originalSnapshot = JSON.stringify({ titulo: t.titulo, definicion: t.definicion, items: itemsActuales });
    limpiarDirty();
}

/* ════ PUNTOS DE CONEXIÓN CON LA API ════ */
function cargarTemaDesdeAPI(slug) { return ApiClient.obtenerSubtemaPorSlug(slug); }

function guardarTemaEnAPI(slug, datos) { return ApiClient.actualizarSubtemaPorSlug(slug, datos); }

/* ════ Guardar / Cancelar ════ */
function getCodigoActual() { return monacoEditor ? monacoEditor.getValue() : document.getElementById('codeFallback').value; }

async function guardarCambios() {
    if (!temaActual) return;
    // Se guardan los recuadros que tenían cambios pendientes al momento de
    // presionar "Guardar" (el PUT manda todo junto, pero solo esos recuadros
    // deben mostrar la notificación — el otro no tenía nada que guardar).
    const seccionesAGuardar = Object.keys(dirtySecciones).filter(s => dirtySecciones[s]);
    volcarTabActivaAEstado();

    const titulo = document.getElementById('f-titulo').value.trim();
    const definicion = document.getElementById('f-definicion').value.trim();
    if (!titulo) { alert('El título no puede estar vacío.'); return; }

    // Formato nuevo: la API sincroniza esto contra su propia tabla "ejemplos"
    // (crea/actualiza/borra por posición), igual que ya hace con ejercicios.
    const ejemplos = itemsActuales
        .filter(it => it.tipo === 'ejemplo')
        .map(it => ({ titulo: (it.titulo || '').trim(), enunciado: (it.enunciado || '').trim(), codigo: it.codigo || '' }));
    const ejercicios = itemsActuales
        .filter(it => it.tipo === 'ejercicio')
        .map(it => ({ titulo: (it.titulo || '').trim(), descripcion: (it.descripcion || '').trim(), codigo_csharp: it.codigo || '' }));

    if (!ejemplos.length) { alert('Debe haber al menos un ejemplo.'); return; }
    if (ejercicios.some(ej => !ej.titulo)) { alert('Cada ejercicio necesita un título.'); return; }
    if (ejercicios.some(ej => !ej.descripcion)) { alert('Cada ejercicio necesita un enunciado.'); return; }

    const datos = { titulo, definicion, ejemplos, ejercicios };

    try {
        await guardarTemaEnAPI(temaActual, datos);

        // Verificación: releer el tema y confirmar que el backend sí conservó los ejercicios.
        // El PUT nunca había mandado "ejercicios" antes de este cambio, así que no hay
        // garantía de que el backend lo persista sin ajustes ahí también.
        let ejerciciosConfirmados = false;
        try {
            const releido = await cargarTemaDesdeAPI(temaActual);
            const n = Array.isArray(releido && releido.ejercicios) ? releido.ejercicios.length : 0;
            ejerciciosConfirmados = n === ejercicios.length;
        } catch (e) { /* si falla la relectura, se avisa igual abajo */ }

        originalSnapshot = JSON.stringify({ titulo, definicion, items: itemsActuales });
        document.getElementById('temaTitulo').textContent = titulo;
        limpiarDirty();

        if (ejerciciosConfirmados) {
            flashStatus('Cambios guardados ✓', true, seccionesAGuardar);
        } else {
            flashStatus('Guardado, pero el backend no devolvió los ejercicios — revisar backend', false, seccionesAGuardar);
        }
    } catch (err) {
        console.error(err);
        flashStatus('No se pudo guardar', false, seccionesAGuardar);
    }
}

function cancelarCambios() {
    if (!temaActual || !originalSnapshot) return;
    const s = JSON.parse(originalSnapshot);
    document.getElementById('f-titulo').value = s.titulo;
    document.getElementById('f-definicion').value = s.definicion;
    itemsActuales = s.items.map(it => ({ ...it }));
    renderEditorTabs();
    seleccionarTab(0, { volcar: false });
    limpiarDirty();
}

/* ════ Estado "dirty" (independiente por recuadro: "concepto" o "ejemplos") ════
   El PUT guarda todo el subtema junto, así que ambos botones "Guardar cambios"
   disparan el mismo guardarCambios(); solo el indicador visual se independiza
   para que editar un recuadro no marque el otro como pendiente.

   markDirty() no activa el botón a ciegas por cualquier evento: recalcula si
   el estado actual REALMENTE difiere del último guardado/cargado
   (originalSnapshot). Así, escribir algo y volver a dejarlo igual que antes
   (o borrar una pestaña vacía recién agregada) no deja el botón activo. */
function markDirty(seccion) { reevaluarDirty(seccion || 'ejemplos'); }

// Un ejemplo/ejercicio recién agregado y todavía sin contenido no cuenta
// como cambio real — ni al compararlo ni al decidir si guardar está permitido.
function itemEstaVacio(it) {
    if (it.tipo === 'ejercicio') {
        return !(it.codigo || '').trim() && !(it.descripcion || '').trim() && !(it.titulo || '').trim();
    }
    return !(it.codigo || '').trim() && !(it.enunciado || '').trim() && !(it.titulo || '').trim();
}

function itemsParaComparar(items) {
    return (items || []).filter(it => !itemEstaVacio(it));
}

function reevaluarDirty(seccion) {
    if (!temaActual || !originalSnapshot) return;
    const snap = JSON.parse(originalSnapshot);

    if (seccion === 'concepto') {
        const titulo = document.getElementById('f-titulo').value.trim();
        const definicion = document.getElementById('f-definicion').value.trim();
        const cambio = titulo !== (snap.titulo || '') || definicion !== (snap.definicion || '');
        setSeccionDirty('concepto', cambio);
        return;
    }

    volcarTabActivaAEstado();
    const actual = JSON.stringify(itemsParaComparar(itemsActuales));
    const original = JSON.stringify(itemsParaComparar(snap.items));
    setSeccionDirty('ejemplos', actual !== original);
}

function setSeccionDirty(seccion, v) {
    dirtySecciones[seccion] = v;
    const scope = document.querySelector('.head-actions[data-seccion="' + seccion + '"]');
    if (!scope) return;
    const btn = scope.querySelector('.btn--save');
    if (btn) btn.disabled = !v;
    const st = scope.querySelector('.status');
    if (st) { st.classList.toggle('dirty', v); st.classList.remove('saved'); st.style.color = ''; }
    const txt = scope.querySelector('.status-text');
    if (txt) txt.textContent = v ? 'Cambios sin guardar' : 'Sin cambios';
}

function hayCambiosPendientes() { return dirtySecciones.concepto || dirtySecciones.ejemplos; }

// Se llama tras cargar/cancelar/guardar: en los tres casos el estado en pantalla
// vuelve a coincidir con el original (o con lo recién guardado) en AMBOS recuadros.
function limpiarDirty() {
    setSeccionDirty('concepto', false);
    setSeccionDirty('ejemplos', false);
}

// secciones: cuáles recuadros mostrar la notificación (por defecto, ambos).
function flashStatus(msg, ok, secciones) {
    const lista = (secciones && secciones.length) ? secciones : ['concepto', 'ejemplos'];
    const scopes = lista
        .map(s => document.querySelector('.head-actions[data-seccion="' + s + '"]'))
        .filter(Boolean);

    scopes.forEach(scope => {
        const st = scope.querySelector('.status');
        const txt = scope.querySelector('.status-text');
        if (st) { st.classList.remove('dirty'); st.classList.toggle('saved', ok); if (!ok) st.style.color = 'var(--danger)'; }
        if (txt) txt.textContent = msg;
    });

    // Al terminar el flash, cada recuadro vuelve a SU estado real (dirty si el
    // guardado falló y seguía pendiente, o "Sin cambios" si sí se guardó).
    setTimeout(() => {
        lista.forEach(seccion => setSeccionDirty(seccion, dirtySecciones[seccion]));
    }, 2200);
}

function confirmDiscard() { if (!hayCambiosPendientes()) return true; return confirm('Tienes cambios sin guardar. ¿Deseas descartarlos?'); }

/* ════ Monaco (vía AdmConsola — misma consola paso a paso que ven los alumnos) ════ */
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    AdmConsola.crearEditor(document.getElementById('monaco-editor'));
    monacoEditor = AdmConsola.editor;
    // Listener propio del admin: solo decide si hay que marcar "dirty".
    // AdmConsola ya tiene su propio listener (siempre activo) que vuelve a
    // correr la simulación; ambos conviven sin pisarse.
    monacoEditor.onDidChangeModelContent(() => { if (temaActual && !suprimirDirtyEditor) markDirty('ejemplos'); });
    document.getElementById('codeFallback').style.display = 'none';
});

// ── CERRAR SESIÓN ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const btnCerrar = document.getElementById('btn-cerrar-sesion');
    if (!btnCerrar) return;

    btnCerrar.addEventListener('click', () => {
        // Borra token y usuario del navegador
        if (window.ApiClient && window.ApiClient.cerrarSesion) {
            window.ApiClient.cerrarSesion();
        }
        // Regresa al login. '../index.html' porque el login está
        // un nivel arriba de este simulador (igual que ../api.js).
        window.location.href = '../index.html';
    });
});