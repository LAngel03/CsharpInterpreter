// ============================================================
//  HELPERS — mostrar / ocultar pantallas
// ============================================================
function mostrarPantallaInicio() {
    const inicio = document.getElementById('pantalla-inicio');
    const tema = document.getElementById('seccion-tema');
    if (inicio) inicio.style.display = 'flex';
    if (tema) tema.style.display = 'none';
}

function mostrarPantallaTema() {
    const inicio = document.getElementById('pantalla-inicio');
    const tema = document.getElementById('seccion-tema');
    if (inicio) inicio.style.display = 'none';
    if (tema) tema.style.display = 'block';
}

// ============================================================
//  SIDEBAR — abrir / cerrar en móvil
// ============================================================
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

// ============================================================
//  UTILIDAD — evitar que click y touchend se dupliquen
//  En móvil el navegador dispara touchend Y después click.
//  Con este flag ignoramos el click si ya procesamos el touch.
// ============================================================
let _touchHandled = false;

function crearHandler(fn) {
    return {
        touch: (e) => {
            _touchHandled = true;
            fn(e);
            // Resetear flag después de que el click sintético pase
            setTimeout(() => { _touchHandled = false; }, 400);
        },
        click: (e) => {
            if (_touchHandled) return; // ya lo manejó touchend
            fn(e);
        }
    };
}

// ============================================================
//  SUBMENÚ — acordeón (SOLO has-sub)
// ============================================================
document.querySelectorAll('.nav-group .has-sub').forEach(btn => {
    const fn = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const group = btn.closest('.nav-group');
        const isOpen = group.classList.contains('open');
        document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
        if (!isOpen) group.classList.add('open');
    };
    const h = crearHandler(fn);
    btn.addEventListener('touchend', h.touch, { passive: false });
    btn.addEventListener('click', h.click);
});

// ============================================================
//  NAVEGACIÓN — sub-botones finales (For, While, If, etc.)
// ============================================================
document.querySelectorAll('.nav-sub-btn, .nav-btn[data-tema]:not(.has-sub)').forEach(btn => {
    const fn = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const tema = btn.dataset.tema;
        if (!tema) return;
        if (tema === 'Glosario') return; // manejado en DOMContentLoaded
        limpiarPantalla();
        mostrarPantallaTema();
        cargarTema(tema);
        if (window.innerWidth < 768) closeSidebar();
    };
    const h = crearHandler(fn);
    btn.addEventListener('touchend', h.touch, { passive: false });
    btn.addEventListener('click', h.click);
});

// ============================================================
//  HELPERS — actualizar título y definición en pantalla
// ============================================================
function mostrarDescripcion(titulo, definicion) {
    const elTitulo = document.getElementById('tema-titulo');
    const elDesc = document.getElementById('tema-descripcion');
    if (elTitulo) elTitulo.innerHTML = titulo ? `<h2 class="tema-titulo-text">${titulo}</h2>` : '';
    if (elDesc) {
        if (definicion) { elDesc.innerHTML = definicion; elDesc.style.display = 'block'; }
        else { elDesc.innerHTML = ''; elDesc.style.display = 'none'; }
    }
}

function limpiarPantalla() {
    const workspace = document.getElementById('workspace-container');
    const gridModulos = document.getElementById('grid-modulos');
    if (workspace) workspace.innerHTML = '';
    if (gridModulos) gridModulos.innerHTML = '';
    mostrarDescripcion('', '');
}

function cargarTema(nombreTema) {
    if (!window.temas || !window.temas[nombreTema]) return;
    const datos = window.temas[nombreTema];
    mostrarDescripcion(datos.titulo, datos.definicion);
    if (typeof insertarConsolas === 'function') insertarConsolas();
}

// ============================================================
//  VISTA DE GLOSARIO
// ============================================================
function cargarGlosario() {
    limpiarPantalla();
    mostrarPantallaTema();

    const temaTitulo = document.getElementById('tema-titulo');
    const temaDesc = document.getElementById('tema-descripcion');
    const gridModulos = document.getElementById('grid-modulos');

    if (temaTitulo) {
        temaTitulo.innerHTML = `
            <h2 class="fw-bold text-white mb-1">Glosario de Conceptos</h2>
            <p class="text-muted small mb-4">Selecciona un área temática para revisar sus definiciones, casos prácticos y conclusiones analógicas.</p>
        `;
    }
    if (temaDesc) temaDesc.style.display = 'none';

    if (gridModulos) {
        gridModulos.innerHTML = `
            <div class="col">
                <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('Selectivas')">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="p-2 rounded" style="background-color:rgba(4,170,109,0.1);">
                            <img src="./img/iconos/Selectivas.png" class="nav-icon" alt="">
                        </div>
                    </div>
                    <h4 class="text-white fw-bold mb-1">Estructuras Selectivas</h4>
                    <p class="text-white small flex-grow-1 m-0 mt-2">Conceptos generales sobre la toma de decisiones lógicas en el código.</p>
                </button>
            </div>
            <div class="col">
                <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('Ciclos')">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="p-2 rounded" style="background-color:rgba(123,44,191,0.1);">
                            <img src="./img/iconos/Ciclos.png" class="nav-icon" alt="">
                        </div>
                    </div>
                    <h4 class="text-white fw-bold mb-1">Ciclos</h4>
                    <p class="text-white small flex-grow-1 m-0 mt-2">Conceptos generales sobre repeticiones de bloques de código.</p>
                </button>
            </div>
            <div class="col">
                <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('Array_unidimensional')">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="p-2 rounded" style="background-color:rgba(4,170,109,0.1);">
                            <img src="./img/iconos/Array_Unidimensional.png" class="nav-icon" alt="">
                        </div>
                    </div>
                    <h4 class="text-white fw-bold mb-1">Arreglos Unidimensionales</h4>
                    <p class="text-white small flex-grow-1 m-0 mt-2">Conceptos generales sobre almacenamiento lineal en una sola fila de datos consecutivos.</p>
                </button>
            </div>
            <div class="col">
                <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('Array_bidimensional')">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="p-2 rounded" style="background-color:rgba(4,170,109,0.1);">
                            <img src="./img/iconos/Array_Bidimensional.png" class="nav-icon" alt="">
                        </div>
                    </div>
                    <h4 class="text-white fw-bold mb-1">Arreglos Bidimensionales</h4>
                    <p class="text-white small flex-grow-1 m-0 mt-2">Conceptos generales organizados en tablas formadas por filas y columnas.</p>
                </button>
            </div>
            <div class="col">
                <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('Recursividad')">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="p-2 rounded" style="background-color:rgba(255,193,7,0.1);">
                            <img src="./img/iconos/Recursividad.png" class="nav-icon" alt="">
                        </div>
                    </div>
                    <h4 class="text-white fw-bold mb-1">Recursividad</h4>
                    <p class="text-white small flex-grow-1 m-0 mt-2">Conceptos generales sobre funciones que dividen un problema llamándose a sí mismas.</p>
                </button>
            </div>
        `;
    }
}

// ============================================================
//  GESTIÓN DE EVENTOS DOM
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnInicio = document.getElementById('btn-inicio');
    const btnGlosario = document.getElementById('btn-glosario');

    if (btnInicio) {
        const fnInicio = (e) => {
            e.stopPropagation();
            e.preventDefault();
            mostrarPantallaInicio();
            if (window.innerWidth < 768) closeSidebar();
        };
        const hInicio = crearHandler(fnInicio);
        btnInicio.addEventListener('touchend', hInicio.touch, { passive: false });
        btnInicio.addEventListener('click', hInicio.click);
    }

    if (btnGlosario) {
        const fnGlosario = (e) => {
            e.stopPropagation();
            e.preventDefault();
            cargarGlosario();
            if (window.innerWidth < 768) closeSidebar();
        };
        const hGlosario = crearHandler(fnGlosario);
        btnGlosario.addEventListener('touchend', hGlosario.touch, { passive: false });
        btnGlosario.addEventListener('click', hGlosario.click);
    }

    mostrarPantallaInicio();
});

// ============================================================
//  DICCIONARIO Y MODALES
// ============================================================
const diccionarioTemas = {
    "Selectivas": {
        titulo: "Estructuras Selectivas",
        concepto: "Las estructuras selectivas permiten que un programa tome decisiones dependiendo de si una condición es verdadera o falsa. Se utilizan para controlar el flujo de ejecución y elegir entre diferentes acciones.",
        ejemplos: "if, if-else, switch",
        caso: "\"Si un alumno tiene promedio mayor o igual a 9, obtiene una beca del 50%; de lo contrario, no recibe beca.\"",
        conclusion: "En pocas palabras, las estructuras selectivas le dan al programa la capacidad de elegir. Sin ellas, las aplicaciones harían siempre exactamente lo mismo, sin importar lo que el usuario necesite."
    },
    "Ciclos": {
        titulo: "Ciclos",
        concepto: "Los ciclos permiten ejecutar un bloque de instrucciones varias veces mientras se cumpla una condición o hasta alcanzar un número determinado de repeticiones.",
        ejemplos: "for, while, do-while",
        caso: "\"Imagina que necesitas imprimir en pantalla los números del 1 al 10. En lugar de escribir diez líneas de código repetitivas, creas un ciclo.\"",
        conclusion: "Los ciclos nos evitan el trabajo aburrido de duplicar código manualmente. Nos permiten procesar tareas repetitivas de forma automática, exacta y en fracciones de segundo."
    },
    "Array_unidimensional": {
        titulo: "Arreglos Unidimensionales",
        concepto: "Un arreglo unidimensional es una estructura de datos que almacena varios elementos del mismo tipo en una sola fila de posiciones consecutivas.",
        ejemplos: "Vectores, Listas Simples, Índices",
        caso: "\"Imagina que necesitas guardar las 5 calificaciones de un alumno. En lugar de crear 5 variables individuales, creas una sola fila de casilleros en la memoria.\"",
        conclusion: "Los arreglos unidimensionales son ideales para manejar listas simples de datos bajo un único nombre, manteniendo la información agrupada, ordenada y fácil de acceder."
    },
    "Array_bidimensional": {
        titulo: "Arreglos Bidimensionales",
        concepto: "Un arreglo bidimensional organiza los datos en filas y columnas, similar a una tabla o matriz.",
        ejemplos: "Matrices, Tablas de datos, Cuadrículas",
        caso: "\"Imagina que quieres registrar las calificaciones de varios alumnos. Cada fila es un alumno y cada columna es una materia.\"",
        conclusion: "Los arreglos bidimensionales son la estructura perfecta cuando los datos tienen relaciones más complejas, permitiéndonos crear mapas, tablas y bases de datos ordenadas en dos dimensiones."
    },
    "Recursividad": {
        titulo: "Recursividad",
        concepto: "La recursividad es una técnica donde una función se llama a sí misma para resolver un problema dividiéndolo en problemas más pequeños. Toda función recursiva debe tener una condición de parada.",
        ejemplos: "Caso Base, Caso Recursivo, Pila de Llamadas",
        caso: "\"Para calcular el factorial de 4, la función pide el factorial de 3, que pide el de 2, y así hasta llegar al caso base (1). Luego multiplica de vuelta.\"",
        conclusion: "La recursividad es una forma elegante de programar donde un problema gigante se desarma en piezas idénticas cada vez más pequeñas, solucionándose de adentro hacia afuera."
    }
};

function abrirConceptoModal(idTema) {
    const modal = document.getElementById('modal-concepto');
    const datos = diccionarioTemas[idTema] || diccionarioTemas["Selectivas"];
    if (!modal) return;

    document.getElementById('modal-titulo').innerText = datos.titulo;
    document.getElementById('modal-descripcion-texto').innerText = datos.concepto;
    document.getElementById('modal-caso-practico').innerText = datos.caso;
    document.getElementById('modal-abstraccion-conclusión').innerText = datos.conclusion;

    const sub = document.getElementById('modal-subtitulo');
    const tema = document.getElementById('modal-tema-nombre');
    if (sub) sub.style.display = 'none';
    if (tema) tema.style.display = 'none';

    modal.showModal();
}

function cerrarConceptoModal() {
    const modal = document.getElementById('modal-concepto');
    if (modal) modal.close();
}

const modalElemento = document.getElementById('modal-concepto');
if (modalElemento) {
    modalElemento.addEventListener('click', function (event) {
        const rect = this.getBoundingClientRect();
        const clicFuera = (
            event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom
        );
        if (clicFuera) this.close();
    });
}