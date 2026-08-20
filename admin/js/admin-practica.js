// Panel admin: banco de ejercicios de "Ponte a prueba", vía los endpoints directos /ejercicios.

let practicaGrupos = [];
let practicaCategoriaActiva = 0;
let practicaCategoriasDisponibles = [];
let practicaEditandoId = null;
let practicaTextoBusqueda = '';

// Escapa &, < y > para insertar texto de forma segura dentro de HTML.
function _escaparHtmlPractica(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Trae los ejercicios de práctica y las categorías disponibles, y repinta pestañas y lista.
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

// Dibuja una pestaña por categoría, con el número de ejercicios de cada una.
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

// Dibuja la lista de ejercicios de la categoría activa, filtrada por el texto de búsqueda.
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

    const texto = practicaTextoBusqueda.trim().toLowerCase();
    const ejerciciosFiltrados = texto
        ? grupo.ejercicios.filter(ej => (ej.titulo || '').toLowerCase().includes(texto))
        : grupo.ejercicios;

    if (tituloEl) tituloEl.textContent = grupo.categoria;
    if (contadorEl) {
        contadorEl.textContent = texto
            ? ejerciciosFiltrados.length + ' de ' + grupo.ejercicios.length + ' ejercicios'
            : grupo.ejercicios.length + (grupo.ejercicios.length === 1 ? ' ejercicio' : ' ejercicios');
    }

    if (!ejerciciosFiltrados.length) {
        listaEl.innerHTML = '<p class="practica-vacio">No se encontraron ejercicios con ese título.</p>';
        return;
    }

    listaEl.innerHTML = ejerciciosFiltrados.map(ej => `
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

// Conecta el input de búsqueda una sola vez, para no duplicar el listener en repintados.
function conectarBuscadorPractica() {
    const input = document.getElementById('practicaBuscador');
    if (!input || input.dataset.conectado) return;
    input.dataset.conectado = 'true';
    input.addEventListener('input', () => {
        practicaTextoBusqueda = input.value;
        renderPracticaLista();
    });
}

function mostrarVistaPractica() {
    _ocultarTodasLasVistas();
    const view = document.getElementById('view-practica');
    if (view) view.classList.add('show');
    conectarBuscadorPractica();
    cargarPractica();
}

// Arma las <option> del selector de sección/tema, agrupadas por categoría.
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

// Abre el modal en blanco para crear un ejercicio de práctica nuevo.
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

// Abre el modal con los datos de un ejercicio existente cargados para editar.
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

// Valida el formulario, arma el payload y crea o actualiza el ejercicio según corresponda.
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

// Pide confirmación y elimina el ejercicio de práctica.
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
