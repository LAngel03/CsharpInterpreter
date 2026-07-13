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
let temaActual = null, originalSnapshot = null, dirty = false, monacoEditor = null;
let estudiantesCache = [];

// Filtro activo de la tabla de usuarios: 'todos' | 'pendientes' | 'activos'
let filtroUsuarios = 'todos';

// Paleta para los avatares (ya no vienen "color" del backend, se asigna aquí)
const PALETA_AVATAR = ["#04AA6D", "#7B2CBF", "#f7b733", "#2d9cdb", "#eb5757", "#06c47e", "#bb6bd9", "#f2994a"];
function colorPara(i) { return PALETA_AVATAR[i % PALETA_AVATAR.length]; }

/* ════ Inicio: usuarios (conectado a GET /api/usuarios) ════ */
function inic(n) { const p = (n || "").trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() }

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
/* Cambia el filtro y repinta (sin volver a pedir datos a la API) */
function filtrarUsuarios(filtro) {
    filtroUsuarios = filtro;
    document.querySelectorAll('[data-filtro]').forEach(b => {
        b.classList.toggle('on', b.dataset.filtro === filtro);
    });
    renderTablaUsuarios();
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

const toggleBtn = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.classList.add('sidebar-open');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
}

if (toggleBtn) toggleBtn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});

if (overlay) overlay.addEventListener('click', closeSidebar);

/* ════ Carga de un tema (conectado a GET /api/subtemas/slug/:slug) ════ */
async function cargarTema(slug) {
    let t;
    try {
        t = await cargarTemaDesdeAPI(slug);
    } catch (err) {
        flashStatus('No se pudo cargar el tema', false);
        console.error(err);
        return;
    }
    if (!t) return;

    // codigo_ejemplo llega como jsonb: puede ser un string con el código
    // o un objeto { codigo, archivo }. Se soportan ambos formatos.
    let codigo = '', archivo = 'ejemplo.cs';
    if (typeof t.codigo_ejemplo === 'string') codigo = t.codigo_ejemplo;
    else if (t.codigo_ejemplo && typeof t.codigo_ejemplo === 'object') {
        codigo = t.codigo_ejemplo.codigo || '';
        archivo = t.codigo_ejemplo.archivo || archivo;
    }

    temaActual = slug;
    originalSnapshot = JSON.stringify({ titulo: t.titulo, definicion: t.definicion, codigo });
    document.getElementById('temaTitulo').textContent = t.titulo;
    document.getElementById('f-titulo').value = t.titulo;
    document.getElementById('f-definicion').value = t.definicion;
    document.getElementById('codeFileName').textContent = archivo;
    if (monacoEditor) monacoEditor.setValue(codigo);
    else document.getElementById('codeFallback').value = codigo;
    setDirty(false);
}

/* ════ PUNTOS DE CONEXIÓN CON LA API ════ */
function cargarTemaDesdeAPI(slug) { return ApiClient.obtenerSubtemaPorSlug(slug); }

function guardarTemaEnAPI(slug, datos) {
    return ApiClient.actualizarSubtemaPorSlug(slug, {
        titulo: datos.titulo,
        definicion: datos.definicion,
        codigo_ejemplo: { codigo: datos.codigo, archivo: document.getElementById('codeFileName').textContent }
    });
}

/* ════ Guardar / Cancelar ════ */
function getCodigoActual() { return monacoEditor ? monacoEditor.getValue() : document.getElementById('codeFallback').value; }

async function guardarCambios() {
    if (!temaActual) return;
    const datos = { titulo: document.getElementById('f-titulo').value.trim(), definicion: document.getElementById('f-definicion').value.trim(), codigo: getCodigoActual() };
    if (!datos.titulo) { alert('El título no puede estar vacío.'); return; }
    try {
        await guardarTemaEnAPI(temaActual, datos);
        originalSnapshot = JSON.stringify(datos);
        document.getElementById('temaTitulo').textContent = datos.titulo;
        setDirty(false);
        flashStatus('Cambios guardados ✓', true);
    } catch (err) {
        console.error(err);
        flashStatus('No se pudo guardar', false);
    }
}

function cancelarCambios() {
    if (!temaActual || !originalSnapshot) return;
    const s = JSON.parse(originalSnapshot);
    document.getElementById('f-titulo').value = s.titulo;
    document.getElementById('f-definicion').value = s.definicion;
    if (monacoEditor) monacoEditor.setValue(s.codigo); else document.getElementById('codeFallback').value = s.codigo;
    setDirty(false);
}

/* ════ Estado "dirty" ════ */
function markDirty() { setDirty(true); }

function setDirty(v) {
    dirty = v;
    document.getElementById('btnGuardar').disabled = !v;
    const st = document.getElementById('saveStatus'); st.classList.toggle('dirty', v);
    document.getElementById('saveStatusText').textContent = v ? 'Cambios sin guardar' : 'Sin cambios';
}

function flashStatus(msg, ok) {
    const st = document.getElementById('saveStatus'), txt = document.getElementById('saveStatusText');
    st.classList.remove('dirty'); st.style.color = ok ? 'var(--green-main)' : 'var(--danger)'; txt.textContent = msg;
    setTimeout(() => { st.style.color = ''; txt.textContent = 'Sin cambios'; }, 2200);
}

function confirmDiscard() { if (!dirty) return true; return confirm('Tienes cambios sin guardar. ¿Deseas descartarlos?'); }

/* ════ Monaco ════ */
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: '', language: 'csharp', theme: 'vs-dark', automaticLayout: true,
        fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false
    });
    monacoEditor.onDidChangeModelContent(() => { if (temaActual) markDirty(); });
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