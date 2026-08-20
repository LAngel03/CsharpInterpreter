// Bloquea el acceso al panel si no hay sesión de admin válida, y redirige al login.
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

// Estado global de la pantalla de edición de tema.
let temaActual = null, originalSnapshot = null, monacoEditor = null;
let dirtySecciones = { concepto: false, ejemplos: false };
// Evita que cargas de código hechas por el propio panel disparen markDirty.
let suprimirDirtyEditor = false;
let estudiantesCache = [];

// Tamaño total del banco de "Ponte a prueba"; null mientras no se conoce todavía.
let totalPracticas = null;
// Evita que dos cargas/repintados de la tabla de estudiantes se pisen entre sí.
let usuariosOcupado = false;

// Un estudiante sin el campo "activo" se trata como activo, por compatibilidad con registros viejos.
function estaActivo(e) { return e.activo !== false; }
// Formatea una fecha ISO de registro como dd/mm/aaaa.
function fechaRegistro(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
// Ordena estudiantes activos por cantidad de ejercicios resueltos, de mayor a menor.
function compararUsuarios(a, b) {
    return (b.ejercicios_resueltos ?? 0) - (a.ejercicios_resueltos ?? 0);
}

// Pide a la API los estudiantes y el total de ejercicios de práctica, y actualiza el contador de arriba.
async function obtenerEstudiantesYTotal() {
    const [data, practicas] = await Promise.all([
        ApiClient.listarEstudiantes(),
        ApiClient.listarEjerciciosPractica().catch(() => null),
    ]);
    totalPracticas = Array.isArray(practicas)
        ? practicas.reduce((suma, grupo) => suma + (grupo.ejercicios ? grupo.ejercicios.length : 0), 0)
        : totalPracticas;
    estudiantesCache = [...data];
    document.getElementById('statEstudiantes').textContent = estudiantesCache.filter(estaActivo).length;
}

// Carga inicial de estudiantes: muestra "Cargando…" y, si falla, un mensaje de error en la tabla.
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

// Refresca la lista de estudiantes cada 20s, sin indicadores visibles, solo si la vista de Inicio está activa.
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

// Repinta las tablas de estudiantes pendientes y del ranking, a partir del caché en memoria.
function renderTablaUsuarios() {
    renderPendientes();
    renderRanking();
}

// Dibuja la tarjeta de estudiantes pendientes de activación, ordenados por antigüedad de registro.
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
                    <button class="icon-btn danger" title="Eliminar" onclick="eliminarUsuario(${e.id})"><img src="../img/iconos/eliminar.svg" alt=""></button>
                </div></td></tr>`;
    }).join('');
}

// Dibuja la tabla de ranking, solo con estudiantes activos ordenados por compararUsuarios.
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
                <td><div class="prog"><span class="prog__num">${e.ejercicios_resueltos ?? 0}${totalPracticas != null ? ' de ' + totalPracticas : ''} ejercicios</span></div></td>
                <td class="num"><span class="badge">${fechaRegistro(e.creado_en)}</span></td>
                <td><div class="estado-cell">
                    <span class="badge">Activo</span>
                </div></td>
                <td><div class="row-actions">
                                    <button class="btn-estado btn-estado--off" onclick="cambiarEstadoUsuario(${e.id}, false)" title="Desactivar a este estudiante">Desactivar</button>

                    <button class="icon-btn danger" title="Eliminar" onclick="eliminarUsuario(${e.id})"><img src="../img/iconos/eliminar.svg" alt=""></button>
                </div></td></tr>`;
    }).join("");
}

// Activa o desactiva a un estudiante, pidiendo confirmación primero si se va a desactivar.
async function cambiarEstadoUsuario(id, activar) {
    if (!activar) {
        const ok = await confirmarAccion({
            titulo: 'Desactivar estudiante',
            mensaje: '¿Desactivar a este estudiante? No podrá iniciar sesión hasta que lo actives de nuevo.',
            textoConfirmar: 'Desactivar',
        });
        if (!ok) return;
    }

    const botones = document.querySelectorAll(`button[onclick*="(${id},"]`);
    botones.forEach(b => { b.disabled = true; b.textContent = '…'; });

    usuariosOcupado = true;
    try {
        await ApiClient.cambiarActivoEstudiante(id, activar);

        const est = estudiantesCache.find(e => e.id === id);
        if (est) est.activo = activar;

        renderTablaUsuarios();

    } catch (err) {
        mostrarToast('No se pudo cambiar el estado: ' + err.message, 'error');
        renderTablaUsuarios();
    } finally {
        usuariosOcupado = false;
    }
}

// Pide confirmación y elimina a un estudiante.
async function eliminarUsuario(id) {
    const ok = await confirmarAccion({
        titulo: 'Eliminar estudiante',
        mensaje: '¿Eliminar a este estudiante? Esta acción no se puede deshacer.',
        textoConfirmar: 'Eliminar',
        peligroso: true,
    });
    if (!ok) return;
    usuariosOcupado = true;
    try {
        await ApiClient.eliminarEstudiante(id);
        usuariosOcupado = false;
        await pintarUsuarios();
        mostrarToast('Estudiante eliminado.', 'exito');
    } catch (err) {
        mostrarToast('No se pudo eliminar: ' + err.message, 'error');
        usuariosOcupado = false;
    }
}

pintarUsuarios();

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

// Cierra el sidebar en móvil (el botón hamburguesa y el overlay se manejan aparte, en el HTML).
function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
}

// Navegación del sidebar hacia la vista de edición de temas.
const viewInicio = document.getElementById('view-inicio');
const viewTema = document.getElementById('view-tema');
const viewGlosario = document.getElementById('view-glosario');
const btnInicio = document.getElementById('btn-inicio');

// Oculta todas las vistas del panel, como paso previo a mostrar una sola.
function _ocultarTodasLasVistas() {
    if (viewInicio) viewInicio.classList.remove('show');
    if (viewTema) viewTema.classList.remove('show');
    if (viewGlosario) viewGlosario.classList.remove('show');
    const viewPractica = document.getElementById('view-practica');
    if (viewPractica) viewPractica.classList.remove('show');
}

function mostrarVistaInicio() {
    _ocultarTodasLasVistas();
    if (viewInicio) viewInicio.classList.add('show');
}

function mostrarVistaTema(slug) {
    _ocultarTodasLasVistas();
    if (viewTema) viewTema.classList.add('show');
    cargarTema(slug);
}

function mostrarVistaGlosarioAdmin() {
    _ocultarTodasLasVistas();
    if (viewGlosario) viewGlosario.classList.add('show');
    cargarGlosarioAdmin();
}

// Temas que aún no están conectados a la API y por lo tanto no se pueden editar desde el panel.
const TEMAS_NO_EDITABLES = [];

document.querySelectorAll('.nav-sub-btn[data-tema]:not(.has-sub2), .nav-sub2-btn[data-tema], .nav-btn[data-tema]:not(.has-sub)').forEach(btn => {
    btn.addEventListener('click', async () => {
        const tema = btn.dataset.tema;
        if (!tema) return;
        if (tema === 'Glosario') {
            if (!await confirmDiscard()) return;
            mostrarVistaGlosarioAdmin();
            if (window.innerWidth < 768) closeSidebar();
            return;
        }
        if (tema === 'Ponte_a_prueba') {
            // Módulo aparte con sus propias pestañas de sección (ver admin-practica.js).
            if (!await confirmDiscard()) return;
            mostrarVistaPractica();
            if (window.innerWidth < 768) closeSidebar();
            return;
        }
        if (TEMAS_NO_EDITABLES.includes(tema)) {
            mostrarToast('Este tema todavía no está conectado a la base de datos: no se puede editar desde el panel.', 'advertencia');
            return;
        }
        if (!await confirmDiscard()) return;
        mostrarVistaTema(tema);
        if (window.innerWidth < 768) closeSidebar();
    });
});

if (btnInicio) {
    btnInicio.addEventListener('click', async () => {
        if (!await confirmDiscard()) return;
        mostrarVistaInicio();
        if (window.innerWidth < 768) closeSidebar();
    });
}

// Glosario: CRUD conectado a GET/POST/PATCH/DELETE /api/glosario.
let glosarioCache = [];
let glosarioEditandoId = null;
// Nombres de unidad actualmente desplegadas en el acordeón, para conservarlas entre repintados.
const glosarioAbiertas = new Set();

// Carga los términos del glosario desde la API y los pinta en el acordeón.
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

// Dibuja el acordeón del glosario: una fila desplegable por unidad, con sus términos y acciones dentro.
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
                            <button class="icon-btn" title="Editar" onclick="editarTerminoGlosario(${t.id})"><img src="../img/iconos/edit.svg" alt=""></button>
                            <button class="icon-btn danger" title="Eliminar" onclick="eliminarTerminoGlosario(${t.id})"><img src="../img/iconos/eliminar.svg" alt=""></button>
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

// Escapa comillas dobles para insertar un texto de forma segura en un atributo data-*.
function ppEscapeAttr(str) { return String(str).replace(/"/g, '&quot;'); }

const GLOSARIO_CAMPOS = ['g-unidad', 'g-termino', 'g-definicion', 'g-ejemplo', 'g-caso', 'g-conclusion'];

// Lista, sin duplicados, las unidades que ya existen entre los términos cargados.
function unidadesGlosarioDisponibles() {
    const vistas = new Set();
    for (const t of glosarioCache) if (t.unidad) vistas.add(t.unidad);
    return Array.from(vistas).sort();
}

// Llena el <select> de unidad del formulario con las unidades ya existentes.
function poblarSelectUnidadGlosario(seleccionada) {
    const sel = document.getElementById('g-unidad');
    if (!sel) return;
    const unidades = unidadesGlosarioDisponibles();
    sel.innerHTML = unidades.map(u =>
        `<option value="${ppEscapeAttr(u)}"${u === seleccionada ? ' selected' : ''}>${u}</option>`
    ).join('');
}

// Abre el formulario en blanco para crear un término de glosario nuevo.
function nuevoTerminoGlosario() {
    glosarioEditandoId = null;
    document.getElementById('glosarioFormTitulo').textContent = 'Nuevo término';
    GLOSARIO_CAMPOS.forEach(id => { document.getElementById(id).value = ''; });
    poblarSelectUnidadGlosario(null);
    document.getElementById('glosarioModal').showModal();
    document.getElementById('g-termino').focus();
}

// Abre el formulario con los datos de un término existente cargados para editar.
function editarTerminoGlosario(id) {
    const t = glosarioCache.find(x => x.id === id);
    if (!t) return;
    glosarioEditandoId = id;
    document.getElementById('glosarioFormTitulo').textContent = 'Editar término';
    poblarSelectUnidadGlosario(t.unidad || '');
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

// Valida el formulario, arma el payload y crea o actualiza el término según corresponda.
async function guardarTerminoGlosario() {
    const termino = document.getElementById('g-termino').value.trim();
    const definicion = document.getElementById('g-definicion').value.trim();
    if (!termino) { mostrarToast('El término no puede estar vacío.', 'advertencia'); return; }
    if (!definicion) { mostrarToast('La definición no puede estar vacía.', 'advertencia'); return; }

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
        mostrarToast('Término guardado.', 'exito');
    } catch (err) {
        mostrarToast('No se pudo guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// Pide confirmación y elimina un término del glosario.
async function eliminarTerminoGlosario(id) {
    const ok = await confirmarAccion({
        titulo: 'Eliminar término',
        mensaje: '¿Eliminar este término del glosario? Esta acción no se puede deshacer.',
        textoConfirmar: 'Eliminar',
        peligroso: true,
    });
    if (!ok) return;
    try {
        await ApiClient.eliminarTerminoGlosario(id);
        await cargarGlosarioAdmin();
        mostrarToast('Término eliminado.', 'exito');
    } catch (err) {
        mostrarToast('No se pudo eliminar: ' + err.message, 'error');
    }
}

// Click fuera del contenido del modal de glosario equivale a cerrarlo.
(function () {
    const modal = document.getElementById('glosarioModal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) cerrarFormularioGlosario(); });
})();

// Ejemplos y ejercicios de demostración del tema en edición, sincronizados por posición contra el backend.
let itemsActuales = [];
let tabActivo = 0;

// Genera las etiquetas de pestaña ("Ejemplo N" / "Caso N") según la posición dentro de su propio tipo.
function etiquetasItems() {
    let iEj = 0, iEjer = 0;
    return itemsActuales.map(it => {
        if (it.tipo === 'ejercicio') { iEjer++; return 'Caso ' + iEjer; }
        iEj++; return 'Ejemplo ' + iEj;
    });
}

// Dibuja las pestañas de ejemplos/ejercicios y conecta sus botones de quitar y de selección.
function renderEditorTabs() {
    const cont = document.getElementById('editorTabs');
    if (!cont) return;
    const etiquetas = etiquetasItems();

    cont.innerHTML = itemsActuales.map((item, i) => {
        const esUltimoEjemplo = item.tipo === 'ejemplo' && itemsActuales.filter(x => x.tipo === 'ejemplo').length === 1;
        const claseTipo = item.tipo === 'ejercicio' ? ' ejercicio' : '';
        const claseActivo = i === tabActivo ? ' activo' : '';
        const quitar = esUltimoEjemplo ? '' : `<span class="tab-remove" data-tab-remove="${i}" title="Quitar"><img src="../img/iconos/cancel.svg" alt=""></span>`;
        return `<span class="sim-tab${claseTipo}${claseActivo}" data-tab="${i}">${etiquetas[i]}${quitar}</span>`;
    }).join('');

    cont.querySelectorAll('[data-tab-remove]').forEach(el => {
        el.addEventListener('click', (ev) => { ev.stopPropagation(); eliminarTab(Number(el.dataset.tabRemove)); });
    });
    cont.querySelectorAll('.sim-tab').forEach(el => {
        el.addEventListener('click', () => seleccionarTab(Number(el.dataset.tab)));
    });
}

// Copia al item actual (itemsActuales[tabActivo]) lo que haya en el editor y el formulario, antes de cambiar de pestaña.
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

// Activa la pestaña i: guarda el estado de la anterior, y carga el formulario/editor con el nuevo item.
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
        // Silencia markDirty durante el setValue() programático; AdmConsola sí vuelve a simular con el código nuevo.
        suprimirDirtyEditor = true;
        AdmConsola.cargarCodigo(item.codigo || '');
        suprimirDirtyEditor = false;
    } else {
        document.getElementById('codeFallback').value = item.codigo || '';
    }
}

// Agrega una pestaña de ejemplo vacía y la selecciona, dejando el editor listo para escribir.
function agregarEjemplo() {
    volcarTabActivaAEstado();
    itemsActuales.push({ tipo: 'ejemplo', codigo: '', enunciado: '', titulo: '' });
    renderEditorTabs();
    seleccionarTab(itemsActuales.length - 1, { volcar: false });
    markDirty('ejemplos');
    if (monacoEditor) monacoEditor.focus();
    else document.getElementById('codeFallback').focus();
}

// Agrega una pestaña de ejercicio vacía y la selecciona, con el foco en el campo de título.
function agregarEjercicio() {
    volcarTabActivaAEstado();
    itemsActuales.push({ tipo: 'ejercicio', codigo: '', descripcion: '', titulo: '' });
    renderEditorTabs();
    seleccionarTab(itemsActuales.length - 1, { volcar: false });
    markDirty('ejemplos');
    const elTit = document.getElementById('f-titulo-ejercicio');
    if (elTit) elTit.focus();
}

// Quita la pestaña i, salvo que sea el último ejemplo restante; pide confirmación antes de borrar.
async function eliminarTab(i) {
    const item = itemsActuales[i];
    if (!item) return;
    const esUltimoEjemplo = item.tipo === 'ejemplo' && itemsActuales.filter(x => x.tipo === 'ejemplo').length === 1;
    if (esUltimoEjemplo) { mostrarToast('Debe quedar al menos un ejemplo.', 'advertencia'); return; }
    const ok = await confirmarAccion({
        titulo: 'Quitar pestaña',
        mensaje: '¿Quitar esta pestaña? Su contenido se perderá al guardar.',
        textoConfirmar: 'Quitar',
        peligroso: true,
    });
    if (!ok) return;
    itemsActuales.splice(i, 1);
    renderEditorTabs();
    seleccionarTab(Math.min(i, itemsActuales.length - 1), { volcar: false });
    markDirty('ejemplos');
}

// Carga un tema desde la API por su slug y arma itemsActuales con sus ejemplos y ejercicios de demostración.
async function cargarTema(slug) {
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

    itemsActuales = (Array.isArray(t.ejemplos) ? t.ejemplos : []).map(ej => ({
        tipo: 'ejemplo', codigo: ej.codigo || '', enunciado: ej.enunciado || '', titulo: ej.titulo || ''
    }));
    // Solo los ejercicios modo='demostracion' se editan aquí; los de modo='practica' viven en su propio módulo.
    (Array.isArray(t.ejercicios) ? t.ejercicios : [])
        .filter(ej => (ej.modo || 'demostracion') === 'demostracion')
        .forEach(ej => {
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

// Puntos de conexión con la API para leer y guardar un subtema por su slug.
function cargarTemaDesdeAPI(slug) { return ApiClient.obtenerSubtemaPorSlug(slug); }

function guardarTemaEnAPI(slug, datos) { return ApiClient.actualizarSubtemaPorSlug(slug, datos); }

function getCodigoActual() { return monacoEditor ? monacoEditor.getValue() : document.getElementById('codeFallback').value; }

// Valida el formulario, arma el payload y guarda el tema completo (título, definición, ejemplos y ejercicios).
async function guardarCambios() {
    if (!temaActual) return;
    const seccionesAGuardar = Object.keys(dirtySecciones).filter(s => dirtySecciones[s]);
    volcarTabActivaAEstado();

    const titulo = document.getElementById('f-titulo').value.trim();
    const definicion = document.getElementById('f-definicion').value.trim();
    if (!titulo) { mostrarToast('El título no puede estar vacío.', 'advertencia'); return; }

    const ejemplos = itemsActuales
        .filter(it => it.tipo === 'ejemplo')
        .map(it => ({ titulo: (it.titulo || '').trim(), enunciado: (it.enunciado || '').trim(), codigo: it.codigo || '' }));
    const ejercicios = itemsActuales
        .filter(it => it.tipo === 'ejercicio')
        .map(it => ({ titulo: (it.titulo || '').trim(), descripcion: (it.descripcion || '').trim(), codigo_csharp: it.codigo || '' }));

    if (!ejemplos.length) { mostrarToast('Debe haber al menos un ejemplo.', 'advertencia'); return; }
    if (ejemplos.some(ej => !ej.enunciado)) { mostrarToast('Cada ejemplo necesita un enunciado.', 'advertencia'); return; }
    if (ejercicios.some(ej => !ej.titulo)) { mostrarToast('Cada caso necesita un título.', 'advertencia'); return; }
    if (ejercicios.some(ej => !ej.descripcion)) { mostrarToast('Cada caso necesita un enunciado.', 'advertencia'); return; }

    const datos = { titulo, definicion, ejemplos, ejercicios };

    try {
        await guardarTemaEnAPI(temaActual, datos);

        // Relee el tema tras guardar, para confirmar que el backend sí conservó los ejercicios.
        let ejerciciosConfirmados = false;
        try {
            const releido = await cargarTemaDesdeAPI(temaActual);
            const n = Array.isArray(releido && releido.ejercicios) ? releido.ejercicios.length : 0;
            ejerciciosConfirmados = n === ejercicios.length;
        } catch (e) {
            // Si la relectura falla, se avisa igual más abajo con ejerciciosConfirmados=false.
        }

        originalSnapshot = JSON.stringify({ titulo, definicion, items: itemsActuales });
        document.getElementById('temaTitulo').textContent = titulo;
        limpiarDirty();

        if (ejerciciosConfirmados) {
            flashStatus('Cambios guardados ✓', true, seccionesAGuardar);
        } else {
            flashStatus('Guardado, pero el backend no devolvió los casos — revisar backend', false, seccionesAGuardar);
        }
    } catch (err) {
        console.error(err);
        flashStatus('No se pudo guardar', false, seccionesAGuardar);
    }
}

// Descarta los cambios pendientes y restaura el formulario/editor al último snapshot guardado.
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

// Marca como pendiente de guardar la sección dada ("concepto" o "ejemplos"), recalculando si sigue habiendo diferencias.
function markDirty(seccion) { reevaluarDirty(seccion || 'ejemplos'); }

// Un ejemplo/ejercicio recién agregado y todavía vacío no cuenta como cambio real.
function itemEstaVacio(it) {
    if (it.tipo === 'ejercicio') {
        return !(it.codigo || '').trim() && !(it.descripcion || '').trim() && !(it.titulo || '').trim();
    }
    return !(it.codigo || '').trim() && !(it.enunciado || '').trim() && !(it.titulo || '').trim();
}

function itemsParaComparar(items) {
    return (items || []).filter(it => !itemEstaVacio(it));
}

// Compara el estado actual del formulario/editor contra el snapshot original, y actualiza el flag dirty de esa sección.
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

// Actualiza el flag dirty de una sección y refleja el cambio en su botón "Guardar" y su texto de estado.
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

// Vuelve ambas secciones a estado "sin cambios" (se llama tras cargar, cancelar o guardar).
function limpiarDirty() {
    setSeccionDirty('concepto', false);
    setSeccionDirty('ejemplos', false);
}

// Muestra brevemente un mensaje de éxito/error en las secciones indicadas, y luego restaura su estado real.
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

    setTimeout(() => {
        lista.forEach(seccion => setSeccionDirty(seccion, dirtySecciones[seccion]));
    }, 2200);
}

// Pide confirmación para descartar cambios pendientes; si no hay ninguno, resuelve true de inmediato.
async function confirmDiscard() {
    if (!hayCambiosPendientes()) return true;
    return confirmarAccion({
        titulo: 'Cambios sin guardar',
        mensaje: 'Tienes cambios sin guardar. ¿Deseas descartarlos?',
        textoConfirmar: 'Descartar cambios',
        peligroso: true,
    });
}

// Carga Monaco desde CDN y lo conecta a AdmConsola (misma consola paso a paso que ven los alumnos).
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    AdmConsola.crearEditor(document.getElementById('monaco-editor'));
    monacoEditor = AdmConsola.editor;
    // Listener propio del admin: solo decide si hay que marcar "dirty" (AdmConsola ya vuelve a simular por su cuenta).
    monacoEditor.onDidChangeModelContent(() => { if (temaActual && !suprimirDirtyEditor) markDirty('ejemplos'); });
    document.getElementById('codeFallback').style.display = 'none';
});

// Cierre de sesión: pide confirmación, borra la sesión local y regresa al login.
document.addEventListener('DOMContentLoaded', () => {
    const btnCerrar = document.getElementById('btn-cerrar-sesion');
    if (!btnCerrar) return;

    btnCerrar.addEventListener('click', async () => {
        const ok = await confirmarAccion({
            titulo: 'Cerrar sesión',
            mensaje: '¿Seguro que quieres cerrar sesión?',
            textoConfirmar: 'Cerrar sesión',
        });
        if (!ok) return;
        if (window.ApiClient && window.ApiClient.cerrarSesion) {
            window.ApiClient.cerrarSesion();
        }
        window.location.href = '../index.html';
    });
});
