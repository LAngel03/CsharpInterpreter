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

// Criterio del ranking: 'ejercicios' (más completados primero) | 'puntos' (mejor puntaje primero)
let ordenUsuarios = 'ejercicios';
// Tamaño total del banco de "Ponte a prueba", para mostrar "X de Y ejercicios".
// null mientras no se sabe (el "de Y" simplemente se omite, no se inventa un número).
let totalPracticas = null;
// true mientras hay una petición en curso que va a repintar la tabla (carga
// inicial, activar/desactivar/eliminar, o el refresco automático) — evita que
// dos de estas se pisen entre sí (p. ej. el refresco de fondo borrando el
// "…" de un botón que el admin acaba de presionar).
let usuariosOcupado = false;

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
/* Compara dos estudiantes activos según ordenUsuarios (el ranking es solo
   entre activos — los pendientes viven aparte, ver renderPendientes) */
function compararUsuarios(a, b) {
    if (ordenUsuarios === 'puntos') return (b.puntos_totales ?? 0) - (a.puntos_totales ?? 0);
    return (b.ejercicios_resueltos ?? 0) - (a.ejercicios_resueltos ?? 0);
}

/* Cambia el criterio del ranking (botones "Más ejercicios" / "Más puntos") */
function cambiarOrdenUsuarios(criterio) {
    if (ordenUsuarios === criterio) return;
    ordenUsuarios = criterio;
    renderRanking();
    document.querySelectorAll('.sort-toggle__btn[data-orden]').forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.orden === ordenUsuarios);
    });
}

/* Pide los estudiantes (y el total de prácticas, para el "X de Y") a la API.
   No toca el DOM más que el contador de arriba — lo reusan la carga inicial
   y el refresco silencioso de fondo. */
async function obtenerEstudiantesYTotal() {
    const [data, practicas] = await Promise.all([
        ApiClient.listarEstudiantes(),
        ApiClient.listarEjerciciosPractica().catch(() => null),
    ]);
    // El total del banco es solo informativo para el "X de Y" de cada fila;
    // si falla, se conserva el último valor conocido en vez de borrarlo.
    totalPracticas = Array.isArray(practicas) ? practicas.length : totalPracticas;
    estudiantesCache = [...data];
    // Solo cuenta activos — los pendientes todavía no son "estudiantes" con
    // acceso real, viven aparte en su propia tarjeta (ver renderPendientes).
    document.getElementById('statEstudiantes').textContent = estudiantesCache.filter(estaActivo).length;
}

/* Pide los estudiantes a la API y los pinta (carga inicial: muestra
   "Cargando…" y, si falla, el mensaje de error en la tabla). */
async function pintarUsuarios() {
    const tbody = document.getElementById("userRows");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px">Cargando estudiantes…</td></tr>`;

    usuariosOcupado = true;
    try {
        await obtenerEstudiantesYTotal();
        renderTablaUsuarios();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--danger,#eb5757)">No se pudieron cargar los estudiantes: ${err.message}</td></tr>`;
    } finally {
        usuariosOcupado = false;
    }
}

/* Refresco automático en segundo plano (cada 20s) para que el ranking del
   admin no se quede desactualizado mientras un alumno resuelve ejercicios.
   Silencioso: sin "Cargando…" ni mensajes de error visibles — si falla, se
   reintenta solo en la siguiente vuelta. Solo corre si la vista de Inicio
   está en pantalla y no hay otra petición de estudiantes en curso. */
async function refrescarUsuariosEnSegundoPlano() {
    if (usuariosOcupado) return;
    const viewInicioEl = document.getElementById('view-inicio');
    if (!viewInicioEl || !viewInicioEl.classList.contains('show')) return;

    usuariosOcupado = true;
    try {
        await obtenerEstudiantesYTotal();
        renderTablaUsuarios();
    } catch (e) {
        console.warn('No se pudo refrescar la lista de estudiantes en segundo plano:', e);
    } finally {
        usuariosOcupado = false;
    }
}
setInterval(refrescarUsuariosEnSegundoPlano, 20000);

/* Dibuja las dos tablas a partir del caché: pendientes (aparte, sin ranking)
   y el ranking de activos. */
function renderTablaUsuarios() {
    renderPendientes();
    renderRanking();
}

/* Estudiantes que no pueden iniciar sesión todavía. Nunca "compiten" en el
   ranking (siempre llevan 0 ejercicios porque no han podido entrar), así que
   viven en su propia tarjeta — ordenados por antigüedad, el que lleva más
   tiempo esperando primero. La tarjeta se oculta sola si no hay ninguno. */
function renderPendientes() {
    const card = document.getElementById('cardPendientes');
    const tbody = document.getElementById('userRowsPendientes');
    if (!card || !tbody) return;

    const pendientes = estudiantesCache
        .filter(e => !estaActivo(e))
        .sort((a, b) => new Date(a.creado_en || 0) - new Date(b.creado_en || 0));

    const badge = document.getElementById('statPendientes');
    if (badge) badge.textContent = pendientes.length;

    if (!pendientes.length) { card.style.display = 'none'; return; }
    card.style.display = '';

    tbody.innerHTML = pendientes.map(e => {
        const nombreCompleto = e.nombre_completo || `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno}`;
        const grupoTxt = e.grupo ? `Grupo ${e.grupo}` : 'Sin grupo';
        return `<tr class="fila-pendiente">
                <td><div class="u-cell"></div><div class="u-name"><b>${nombreCompleto}</b><small>${grupoTxt}</small></div></div></td>
                <td><span class="matricula">${e.matricula}</span></td>
                <td class="num"><span class="badge">${fechaRegistro(e.creado_en)}</span></td>
                <td><div class="row-actions">
                    <button class="btn-estado btn-estado--on" onclick="cambiarEstadoUsuario(${e.id}, true)" title="Permitir que este estudiante inicie sesión">Activar</button>
                    <button class="icon-btn danger" title="Eliminar" onclick="eliminarUsuario(${e.id})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
                </div></td></tr>`;
    }).join('');
}

/* Ranking: solo estudiantes activos, ordenados por compararUsuarios. */
function renderRanking() {
    const tbody = document.getElementById("userRows");
    if (!tbody) return;

    const activos = estudiantesCache.filter(estaActivo).sort(compararUsuarios);

    if (!activos.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px">Aún no hay estudiantes activos.</td></tr>`;
        return;
    }

    tbody.innerHTML = activos.map((e, i) => {
        const pos = i + 1, rc = pos <= 3 ? ` rank--${pos}` : "";
        const nombreCompleto = e.nombre_completo || `${e.nombre} ${e.apellido_paterno} ${e.apellido_materno}`;
        const grupoTxt = e.grupo ? `Grupo ${e.grupo}` : 'Sin grupo';

        return `<tr>
                <td class="num"><span class="rank${rc}">${pos}</span></td>
                <td><div class="u-cell"></div><div class="u-name"><b>${nombreCompleto}</b><small>${grupoTxt}</small></div></div></td>
                <td><span class="matricula">${e.matricula}</span></td>
                <td><div class="prog"><span class="prog__num">${e.ejercicios_resueltos ?? 0}${totalPracticas != null ? ' de ' + totalPracticas : ''} ejercicios · ${e.puntos_totales ?? 0} pts</span></div></td>
                <td class="num"><span class="badge">${fechaRegistro(e.creado_en)}</span></td>
                <td><div class="estado-cell">
                    <span class="badge">Activo</span>
                    <button class="btn-estado btn-estado--off" onclick="cambiarEstadoUsuario(${e.id}, false)" title="Desactivar a este estudiante">Desactivar</button>
                </div></td>
                <td><div class="row-actions">
                    <button class="icon-btn" title="Editar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                    <button class="icon-btn danger" title="Eliminar" onclick="eliminarUsuario(${e.id})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
                </div></td></tr>`;
    }).join("");
}

/* Activa o desactiva a un estudiante (PATCH /api/usuarios/:id/activo) */
async function cambiarEstadoUsuario(id, activar) {
    if (!activar && !confirm('¿Desactivar a este estudiante? No podrá iniciar sesión hasta que lo actives de nuevo.')) return;

    // Deshabilita el botón mientras se procesa, para evitar doble clic — puede
    // estar en .estado-cell (tabla de ranking) o en .row-actions (pendientes).
    const botones = document.querySelectorAll(`button[onclick*="(${id},"]`);
    botones.forEach(b => { b.disabled = true; b.textContent = '…'; });

    usuariosOcupado = true; // que el refresco de fondo no le borre el "…" a este botón
    try {
        await ApiClient.cambiarActivoEstudiante(id, activar);

        // Actualiza el caché en memoria y repinta (sin recargar toda la lista)
        const est = estudiantesCache.find(e => e.id === id);
        if (est) est.activo = activar;

        renderTablaUsuarios();

    } catch (err) {
        alert('No se pudo cambiar el estado: ' + err.message);
        renderTablaUsuarios();   // restaura los botones
    } finally {
        usuariosOcupado = false;
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar a este estudiante? Esta acción no se puede deshacer.')) return;
    usuariosOcupado = true;
    try {
        await ApiClient.eliminarEstudiante(id);
        usuariosOcupado = false; // pintarUsuarios() vuelve a poner el flag por su cuenta
        await pintarUsuarios();
    } catch (err) {
        alert('No se pudo eliminar: ' + err.message);
        usuariosOcupado = false;
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
const viewGlosario = document.getElementById('view-glosario');
const btnInicio = document.getElementById('btn-inicio');

function mostrarVistaInicio() {
    if (viewTema) viewTema.classList.remove('show');
    if (viewGlosario) viewGlosario.classList.remove('show');
    if (viewInicio) viewInicio.classList.add('show');
}

function mostrarVistaTema(slug) {
    if (viewInicio) viewInicio.classList.remove('show');
    if (viewGlosario) viewGlosario.classList.remove('show');
    if (viewTema) viewTema.classList.add('show');
    cargarTema(slug);
}

function mostrarVistaGlosarioAdmin() {
    if (viewInicio) viewInicio.classList.remove('show');
    if (viewTema) viewTema.classList.remove('show');
    if (viewGlosario) viewGlosario.classList.add('show');
    cargarGlosarioAdmin();
}

// Temas que no vienen de la API (100% locales en el simulador del alumno):
// editarlos aquí no tendría ningún efecto para los estudiantes.
// Recursividad y Archivos y Glosario ya se conectaron a la API — se quitaron de esta lista.
const TEMAS_NO_EDITABLES = [];

document.querySelectorAll('.nav-sub-btn[data-tema]:not(.has-sub2), .nav-sub2-btn[data-tema], .nav-btn[data-tema]:not(.has-sub)').forEach(btn => {
    btn.addEventListener('click', () => {
        const tema = btn.dataset.tema;
        if (!tema) return;
        if (tema === 'Glosario') {
            if (!confirmDiscard()) return;
            mostrarVistaGlosarioAdmin();
            if (window.innerWidth < 768) closeSidebar();
            return;
        }
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

/* ════ Glosario (conectado a GET/POST/PATCH/DELETE /api/glosario) ════ */
let glosarioCache = [];
let glosarioEditandoId = null; // null = creando un término nuevo
// Nombres de unidad actualmente desplegadas — se conserva entre repintados
// (p. ej. tras guardar o eliminar) para no cerrar de golpe la que el admin
// estaba viendo.
const glosarioAbiertas = new Set();

async function cargarGlosarioAdmin() {
    const cont = document.getElementById('glosarioAcordeon');
    if (!cont) return;
    cont.innerHTML = `<div style="text-align:center;padding:24px">Cargando términos…</div>`;
    cerrarFormularioGlosario();

    try {
        const datos = await ApiClient.listarGlosario();
        glosarioCache = Array.isArray(datos) ? datos : [];
        renderGlosarioAcordeon();
    } catch (err) {
        console.error(err);
        cont.innerHTML = `<div style="text-align:center;padding:24px;color:var(--danger,#eb5757)">No se pudo cargar el glosario: ${err.message}</div>`;
    }
}

// Pinta una fila desplegable por unidad; dentro de cada una, sus términos
// con sus acciones — así en vez de una tabla larga, el admin abre solo la
// unidad que le interesa.
function renderGlosarioAcordeon() {
    const cont = document.getElementById('glosarioAcordeon');
    const contador = document.getElementById('glosarioContador');
    if (contador) contador.textContent = glosarioCache.length + (glosarioCache.length === 1 ? ' término' : ' términos');
    if (!cont) return;

    if (!glosarioCache.length) {
        cont.innerHTML = `<div style="text-align:center;padding:24px">Todavía no hay términos — agrega el primero.</div>`;
        return;
    }

    const porUnidad = {};
    for (const t of glosarioCache) {
        const u = t.unidad || 'Sin unidad';
        (porUnidad[u] = porUnidad[u] || []).push(t);
    }
    const unidades = Object.keys(porUnidad).sort();

    cont.innerHTML = unidades.map(u => {
        const terminos = porUnidad[u].sort((a, b) => (a.termino || '').localeCompare(b.termino || ''));
        const abierta = glosarioAbiertas.has(u);
        return `<div class="glosario-unidad${abierta ? ' open' : ''}" data-unidad="${ppEscapeAttr(u)}">
            <button type="button" class="glosario-unidad__head">
                <span class="glosario-unidad__arrow">▸</span>
                <span class="glosario-unidad__nombre">${u}</span>
                <span class="glosario-unidad__conteo">${terminos.length}</span>
            </button>
            <div class="glosario-unidad__body">
                ${terminos.map(t => {
                    const defCorta = (t.definicion || '').length > 90 ? t.definicion.slice(0, 90).trim() + '…' : (t.definicion || '');
                    return `<div class="glosario-termino-row">
                        <div class="glosario-termino-info">
                            <b>${t.termino}</b>
                            <span>${defCorta}</span>
                        </div>
                        <div class="row-actions">
                            <button class="icon-btn" title="Editar" onclick="editarTerminoGlosario(${t.id})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>
                            <button class="icon-btn danger" title="Eliminar" onclick="eliminarTerminoGlosario(${t.id})"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }).join('');

    cont.querySelectorAll('.glosario-unidad').forEach(el => {
        el.querySelector('.glosario-unidad__head').addEventListener('click', () => {
            const u = el.dataset.unidad;
            const abrir = !el.classList.contains('open');
            el.classList.toggle('open', abrir);
            if (abrir) glosarioAbiertas.add(u); else glosarioAbiertas.delete(u);
        });
    });
}

// Escapa comillas para meter el nombre de unidad en un atributo data-*
function ppEscapeAttr(str) { return String(str).replace(/"/g, '&quot;'); }

const GLOSARIO_CAMPOS = ['g-unidad', 'g-termino', 'g-definicion', 'g-ejemplo', 'g-caso', 'g-conclusion'];

function nuevoTerminoGlosario() {
    glosarioEditandoId = null;
    document.getElementById('glosarioFormTitulo').textContent = 'Nuevo término';
    GLOSARIO_CAMPOS.forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('glosarioModal').showModal();
    document.getElementById('g-termino').focus();
}

function editarTerminoGlosario(id) {
    const t = glosarioCache.find(x => x.id === id);
    if (!t) return;
    glosarioEditandoId = id;
    document.getElementById('glosarioFormTitulo').textContent = 'Editar término';
    document.getElementById('g-unidad').value = t.unidad || '';
    document.getElementById('g-termino').value = t.termino || '';
    document.getElementById('g-definicion').value = t.definicion || '';
    document.getElementById('g-ejemplo').value = t.ejemplo || '';
    document.getElementById('g-caso').value = t.caso || '';
    document.getElementById('g-conclusion').value = t.conclusion || '';
    document.getElementById('glosarioModal').showModal();
}

function cerrarFormularioGlosario() {
    const modal = document.getElementById('glosarioModal');
    if (modal && modal.open) modal.close();
    glosarioEditandoId = null;
}

async function guardarTerminoGlosario() {
    const termino = document.getElementById('g-termino').value.trim();
    const definicion = document.getElementById('g-definicion').value.trim();
    if (!termino) { alert('El término no puede estar vacío.'); return; }
    if (!definicion) { alert('La definición no puede estar vacía.'); return; }

    const datos = {
        unidad: document.getElementById('g-unidad').value.trim(),
        termino,
        definicion,
        ejemplo: document.getElementById('g-ejemplo').value.trim(),
        caso: document.getElementById('g-caso').value.trim(),
        conclusion: document.getElementById('g-conclusion').value.trim(),
    };

    const btn = document.getElementById('btnGuardarGlosario');
    btn.disabled = true;
    try {
        if (glosarioEditandoId) {
            await ApiClient.actualizarTerminoGlosario(glosarioEditandoId, datos);
        } else {
            await ApiClient.crearTerminoGlosario(datos);
        }
        await cargarGlosarioAdmin();
    } catch (err) {
        alert('No se pudo guardar: ' + err.message);
    } finally {
        btn.disabled = false;
    }
}

async function eliminarTerminoGlosario(id) {
    if (!confirm('¿Eliminar este término del glosario? Esta acción no se puede deshacer.')) return;
    try {
        await ApiClient.eliminarTerminoGlosario(id);
        await cargarGlosarioAdmin();
    } catch (err) {
        alert('No se pudo eliminar: ' + err.message);
    }
}

// Clic en el backdrop (fuera del contenido) cierra el modal, como cualquier
// diálogo — clic dentro del contenido no debe propagarse hasta aquí.
(function () {
    const modal = document.getElementById('glosarioModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) cerrarFormularioGlosario(); });
})();

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

    btnCerrar.addEventListener('click', async () => {
        // Avisa al backend (libera la sesión) y borra token y usuario del navegador
        if (window.ApiClient && window.ApiClient.cerrarSesion) {
            await window.ApiClient.cerrarSesion();
        }
        // Regresa al login. '../index.html' porque el login está
        // un nivel arriba de este simulador (igual que ../api.js).
        window.location.href = '../index.html';
    });
});