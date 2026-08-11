// admin/js/admin-practica.js
// Gestión del banco de "Ponte a prueba" — módulo propio del panel admin,
// independiente del editor por tema (ese solo sigue tocando ejemplos y
// ejercicios de demostración de SU subtema, vía PUT /subtemas/slug/:slug).
//
// Aquí cada ejercicio de práctica se crea/edita/borra UNO A LA VEZ con los
// endpoints directos /ejercicios (POST, PATCH :id, DELETE :id), eligiendo
// en el formulario a qué sección pertenece (subtema_id) — no a la pantalla
// desde donde se abrió. GET /ejercicios/practica ya viene agrupado por
// categoría desde el backend; como admin, además trae codigo_csharp (la
// solución) y sin mezclar el orden, cosas que a un alumno nunca se le mandan.

let practicaGrupos = [];
let practicaCategoriaActiva = 0;
let practicaCategoriasDisponibles = []; // [{ id, nombre, subtemas: [{id, slug, titulo}] }]
let practicaEditandoId = null;          // null = creando uno nuevo

function _escaparHtmlPractica(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mostrarVistaPractica() {
    _ocultarTodasLasVistas();
    const view = document.getElementById('view-practica');
    if (view) view.classList.add('show');
    cargarPractica();
}

async function cargarPractica() {
    const listaEl = document.getElementById('practicaLista');
    if (listaEl) listaEl.innerHTML = '<p class="practica-vacio">Cargando…</p>';
    try {
        const [grupos, categorias] = await Promise.all([
            ApiClient.listarEjerciciosPractica(),
            ApiClient.listarCategorias(),
        ]);
        practicaGrupos = Array.isArray(grupos) ? grupos : [];
        practicaCategoriasDisponibles = Array.isArray(categorias) ? categorias : [];
        if (practicaCategoriaActiva >= practicaGrupos.length) practicaCategoriaActiva = 0;
        renderPracticaTabs();
        renderPracticaLista();
    } catch (err) {
        console.error(err);
        if (listaEl) listaEl.innerHTML = '<p class="practica-vacio practica-error">No se pudo cargar: ' + _escaparHtmlPractica(err.message) + '</p>';
    }
}

function renderPracticaTabs() {
    const tabsEl = document.getElementById('practicaTabs');
    if (!tabsEl) return;
    if (!practicaGrupos.length) { tabsEl.innerHTML = ''; return; }
    tabsEl.innerHTML = practicaGrupos.map((g, i) =>
        '<span class="sim-tab' + (i === practicaCategoriaActiva ? ' activo' : '') + '" data-idx="' + i + '">' +
        _escaparHtmlPractica(g.categoria) + ' <span class="practica-tab-n">' + g.ejercicios.length + '</span></span>'
    ).join('');
    tabsEl.querySelectorAll('.sim-tab').forEach(el => {
        el.addEventListener('click', () => {
            practicaCategoriaActiva = Number(el.dataset.idx);
            renderPracticaTabs();
            renderPracticaLista();
        });
    });
}

function renderPracticaLista() {
    const listaEl = document.getElementById('practicaLista');
    const tituloEl = document.getElementById('practicaCategoriaTitulo');
    const contadorEl = document.getElementById('practicaContador');
    if (!listaEl) return;

    const grupo = practicaGrupos[practicaCategoriaActiva];
    if (!grupo || !grupo.ejercicios.length) {
        if (tituloEl) tituloEl.textContent = 'Sin ejercicios todavía';
        if (contadorEl) contadorEl.textContent = '—';
        listaEl.innerHTML = '<p class="practica-vacio">Todavía no hay ejercicios de práctica. Usa "+ Nuevo ejercicio" para agregar el primero.</p>';
        return;
    }
    if (tituloEl) tituloEl.textContent = grupo.categoria;
    if (contadorEl) contadorEl.textContent = grupo.ejercicios.length + (grupo.ejercicios.length === 1 ? ' ejercicio' : ' ejercicios');

    listaEl.innerHTML = grupo.ejercicios.map(ej => `
        <div class="fila-practica">
            <div>
                <b>${_escaparHtmlPractica(ej.titulo)}</b>
                <div class="sub">${_escaparHtmlPractica((ej.subtemas && ej.subtemas.titulo) || '')}</div>
            </div>
            <div class="row-actions">
                <button class="icon-btn" title="Editar" onclick="editarEjercicioPractica(${ej.id})">
                    <img src="../img/iconos/edit.svg" alt="">
                </button>
                <button class="icon-btn danger" title="Eliminar" onclick="eliminarEjercicioPractica(${ej.id})">
                    <img src="../img/iconos/eliminar.svg" alt="">
                </button>
            </div>
        </div>
    `).join('');
}

// ── Selector "Sección / tema" (subtema_id), agrupado por categoría ────
function _opcionesSubtemasPractica(seleccionadoId) {
    let html = '<option value="" disabled' + (seleccionadoId ? '' : ' selected') + '>Selecciona una sección…</option>';
    for (const cat of practicaCategoriasDisponibles) {
        html += '<optgroup label="' + _escaparHtmlPractica(cat.nombre) + '">';
        for (const s of (cat.subtemas || [])) {
            html += '<option value="' + s.id + '"' + (Number(seleccionadoId) === s.id ? ' selected' : '') + '>' +
                _escaparHtmlPractica(s.titulo) + '</option>';
        }
        html += '</optgroup>';
    }
    return html;
}

// ── Modal crear / editar ────────────────────────────────────────
function nuevoEjercicioPractica() {
    practicaEditandoId = null;
    document.getElementById('practicaFormTitulo').textContent = 'Nuevo ejercicio de práctica';
    document.getElementById('p-subtema').innerHTML = _opcionesSubtemasPractica(null);
    document.getElementById('p-titulo').value = '';
    document.getElementById('p-descripcion').value = '';
    document.getElementById('p-codigo-errores').value = '';
    document.getElementById('p-codigo-correcto').value = '';
    document.getElementById('p-salida-esperada').value = '';
    document.getElementById('p-lineas-editables').value = '';
    document.getElementById('p-pista').value = '';
    document.getElementById('practicaModal').showModal();
}

function editarEjercicioPractica(id) {
    const ej = practicaGrupos.flatMap(g => g.ejercicios).find(e => e.id === id);
    if (!ej) return;
    practicaEditandoId = id;
    const validacion = ej.soluciones_validacion || {};
    document.getElementById('practicaFormTitulo').textContent = 'Editar ejercicio';
    document.getElementById('p-subtema').innerHTML = _opcionesSubtemasPractica(ej.subtema_id);
    document.getElementById('p-titulo').value = ej.titulo || '';
    document.getElementById('p-descripcion').value = ej.descripcion || '';
    document.getElementById('p-codigo-errores').value = ej.codigo_con_errores || '';
    document.getElementById('p-codigo-correcto').value = ej.codigo_csharp || '';
    document.getElementById('p-salida-esperada').value = Array.isArray(validacion.salida_esperada) ? validacion.salida_esperada.join('\n') : '';
    document.getElementById('p-lineas-editables').value = Array.isArray(validacion.lineas_editables) ? validacion.lineas_editables.join(', ') : '';
    document.getElementById('p-pista').value = validacion.pista || '';
    document.getElementById('practicaModal').showModal();
}

function cerrarFormularioPractica() {
    document.getElementById('practicaModal').close();
}

async function guardarEjercicioPractica() {
    const subtema_id = parseInt(document.getElementById('p-subtema').value, 10);
    const titulo = document.getElementById('p-titulo').value.trim();
    const descripcion = document.getElementById('p-descripcion').value.trim();
    const codigo_con_errores = document.getElementById('p-codigo-errores').value;
    const codigo_csharp = document.getElementById('p-codigo-correcto').value.trim();
    const salida_esperada = document.getElementById('p-salida-esperada').value
        .split('\n').map(s => s.trim()).filter(s => s !== '');
    const lineas_editables = document.getElementById('p-lineas-editables').value
        .split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const pista = document.getElementById('p-pista').value.trim();

    if (!subtema_id) { mostrarToast('Elige a qué sección pertenece este ejercicio.', 'advertencia'); return; }
    if (!titulo) { mostrarToast('El título es obligatorio.', 'advertencia'); return; }
    if (!descripcion) { mostrarToast('El enunciado es obligatorio.', 'advertencia'); return; }
    if (!codigo_con_errores.trim()) { mostrarToast('Falta el código con errores.', 'advertencia'); return; }
    if (!codigo_csharp) { mostrarToast('Falta el código correcto (solución).', 'advertencia'); return; }
    if (!salida_esperada.length) { mostrarToast('Falta la salida esperada.', 'advertencia'); return; }

    const datos = {
        subtema_id, titulo, descripcion, codigo_con_errores, codigo_csharp,
        modo: 'practica',
        soluciones_validacion: { salida_esperada, lineas_editables, pista },
    };

    const btn = document.getElementById('btnGuardarPractica');
    btn.disabled = true;
    try {
        if (practicaEditandoId) {
            await ApiClient.actualizarEjercicio(practicaEditandoId, datos);
        } else {
            await ApiClient.crearEjercicio(datos);
        }
        cerrarFormularioPractica();
        await cargarPractica();
        mostrarToast('Ejercicio guardado.', 'exito');
    } catch (err) {
        mostrarToast('No se pudo guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

async function eliminarEjercicioPractica(id) {
    const ok = await confirmarAccion({
        titulo: 'Eliminar ejercicio',
        mensaje: '¿Eliminar este ejercicio de práctica? Esta acción no se puede deshacer.',
        textoConfirmar: 'Eliminar',
        peligroso: true,
    });
    if (!ok) return;
    try {
        await ApiClient.eliminarEjercicio(id);
        await cargarPractica();
        mostrarToast('Ejercicio eliminado.', 'exito');
    } catch (err) {
        mostrarToast('No se pudo eliminar: ' + err.message, 'error');
    }
}
