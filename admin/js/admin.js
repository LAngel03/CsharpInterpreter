/* ════ Guardia de acceso: solo admins con sesión llegan aquí ════ */
// Ajusta esta ruta si tu index.html vive en otro nivel de carpetas.
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

// Paleta para los avatares (ya no vienen "color" del backend, se asigna aquí)
const PALETA_AVATAR = ["#04AA6D", "#7B2CBF", "#f7b733", "#2d9cdb", "#eb5757", "#06c47e", "#bb6bd9", "#f2994a"];
function colorPara(i) { return PALETA_AVATAR[i % PALETA_AVATAR.length]; }

/* ════ Inicio: usuarios (conectado a GET /api/usuarios) ════ */
function inic(n) { const p = (n || "").trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() }

async function pintarUsuarios() {
    const tbody = document.getElementById("userRows");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px">Cargando estudiantes…</td></tr>`;

    try {
        const data = await ApiClient.listarEstudiantes();

        // La vista v_estudiantes viene ordenada por apellido; para el
        // "Ranking" mostramos a los estudiantes con más ejercicios resueltos
        // primero (igual criterio que v_ranking_usuarios).
        estudiantesCache = [...data].sort((a, b) => (b.puntos_totales ?? 0) - (a.puntos_totales ?? 0));

        document.getElementById('statEstudiantes').textContent = estudiantesCache.length;

        if (estudiantesCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px">Aún no hay estudiantes registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = estudiantesCache.map((e, i) => {
            const pos = i + 1, rc = pos <= 3 ? ` rank--${pos}` : "";
            const nombreCompleto = e.nombre_completo || `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno}`;
            const grupoTxt = e.grupo ? `${e.grupo}${e.generacion ? ' · ' + e.generacion : ''}` : 'Sin grupo';
            return `<tr>
                <td class="num"><span class="rank${rc}">${pos}</span></td>
                <td><div class="u-cell"></div><div class="u-name"><b>${nombreCompleto}</b><small>${grupoTxt}</small></div></div></td>
                <td><span class="matricula">${e.matricula}</span></td>
                <td><div class="prog"><span class="prog__num">${e.ejercicios_resueltos ?? 0} ejercicios · ${e.puntos_totales ?? 0} pts</span></div></td>
                <td class="num"><span class="badge">${e.generacion || '—'}</span></td>
                <td><div class="row-actions">
                    <button class="icon-btn" title="Editar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                    <button class="icon-btn danger" title="Eliminar" onclick="eliminarUsuario(${e.id})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
                </div></td></tr>`;
        }).join("");
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger,#eb5757)">No se pudieron cargar los estudiantes: ${err.message}</td></tr>`;
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

/* ════ Navegación ════ */
/* function clearActive() { document.querySelectorAll('.nav-btn,.nav-sub-btn').forEach(b => b.classList.remove('active')) }
function navInicio(btn) { if (!confirmDiscard()) return; clearActive(); btn.classList.add('active'); showView('inicio'); }
function navTema(btn, slug) { if (!confirmDiscard()) return; clearActive(); btn.classList.add('active'); showView('tema'); cargarTema(slug); }
function showView(name) { document.querySelectorAll('.view').forEach(v => v.classList.remove('show')); document.getElementById('view-' + name).classList.add('show'); }
function toggleGroup(id) { document.getElementById(id).classList.toggle('open'); }
 */

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
    // OJO: usuarios.routes.js no incluye una ruta para editar subtemas.
    // Esta llamada asume PUT /api/subtemas/slug/:slug protegida con
    // verificarAdmin; si tu backend usa otra ruta, ajusta actualizarSubtemaPorSlug en api.js.
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