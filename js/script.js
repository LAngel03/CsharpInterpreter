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

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
}

if (overlay) {
    overlay.addEventListener('click', closeSidebar);
}

document.querySelectorAll('.nav-btn, .nav-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (window.innerWidth < 768) closeSidebar();
    });
});

// ============================================================
//  SUBMENÚ — acordeón al hacer click
// ============================================================
document.querySelectorAll('.nav-group .has-sub').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();

        const group = btn.closest('.nav-group');
        const isOpen = group.classList.contains('open');

        document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));

        if (!isOpen) group.classList.add('open');
    });
});

// ============================================================
//  HELPERS — actualizar título y definición en pantalla
// ============================================================
function mostrarDescripcion(titulo, definicion) {
    const elTitulo = document.getElementById('tema-titulo');
    const elDesc = document.getElementById('tema-descripcion');

    if (elTitulo) {
        elTitulo.innerHTML = titulo ? `<h2 class="tema-titulo-text">${titulo}</h2>` : '';
    }

    if (elDesc) {
        if (definicion) {
            elDesc.innerHTML = definicion;
            elDesc.style.display = 'block';
        } else {
            elDesc.innerHTML = '';
            elDesc.style.display = 'none';
        }
    }
}

function limpiarPantalla() {
    const workspace = document.getElementById('workspace-container');
    const gridModulos = document.getElementById('grid-modulos');

    if (workspace) workspace.innerHTML = '';
    if (gridModulos) gridModulos.innerHTML = ''; // Limpia la cuadrícula al cambiar de tema
    mostrarDescripcion('', '');
}

// ============================================================
//  NAVEGACIÓN — cargar tema al hacer click
// ============================================================
document.querySelectorAll('.nav-sub-btn, .nav-btn[data-tema]').forEach(btn => {
    btn.addEventListener('click', () => {
        const tema = btn.dataset.tema;
        if (tema) {
            limpiarPantalla();
            cargarTema(tema);
        }
    });
});

function cargarTema(nombreTema) {
    if (!window.temas || !window.temas[nombreTema]) return;
    const datos = window.temas[nombreTema];

    // 1. Mostrar título y definición del tema
    mostrarDescripcion(datos.titulo, datos.definicion);

    // 2. Inyectar las consolas debajo de la definición
    if (typeof insertarConsolas === "function") {
        insertarConsolas();
    }

    // 3. Aquí irá la lógica del intérprete cuando esté lista
}
// ============================================================
//  VISTA DE INICIO (TARJETAS Y MODALES) — ACTUALIZADO A 5 MÓDULOS
// ============================================================

// 1. Función para pintar la vista de Inicio (Módulos de Áreas Temáticas)
function cargarVistaInicio() {
    const workspaceContainer = document.getElementById("workspace-container");
    const gridModulos = document.getElementById("grid-modulos");
    const temaTitulo = document.getElementById("tema-titulo");
    const temaDescripcion = document.getElementById("tema-descripcion");

    if (workspaceContainer) workspaceContainer.innerHTML = "";
    if (temaTitulo) {
        temaTitulo.innerHTML = `
            <h2 class="fw-bold text-white mb-1">Módulos de Áreas Temáticas</h2>
            <p class="text-muted small mb-4">Explora las estructuras algorítmicas esenciales y pon a prueba tu abstracción modular.</p>
        `;
    }
    if (temaDescripcion) temaDescripcion.style.display = "none";

    // Estructura HTML actualizada: 5 tarjetas independientes tipo botón
    if (gridModulos) {
        gridModulos.innerHTML = `
            <div class="col">
                <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('Selectivas')">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div class="p-2 rounded card-icon-box" style="background-color: rgba(4, 170, 109, 0.1); color: var(--green-main);">
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
                        <div class="p-2 rounded card-icon-box" style="background-color: rgba(123, 44, 191, 0.1); color: #a29bfe;">
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
                        <div class="p-2 rounded card-icon-box" style="background-color: rgba(4, 170, 109, 0.1); color: var(--green-main);">
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
                        <div class="p-2 rounded card-icon-box" style="background-color: rgba(4, 170, 109, 0.1); color: var(--green-main);">
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
                        <div class="p-2 rounded card-icon-box" style="background-color: rgba(255, 193, 7, 0.1); color: #ffc107;">
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

// Iniciar aplicación cargando el inicio por defecto al abrir
document.addEventListener("DOMContentLoaded", () => {
    const btnInicio = document.getElementById("btn-inicio");

    if (btnInicio) {
        btnInicio.addEventListener("click", () => {
            limpiarPantalla();
            cargarVistaInicio();
        });
    }

    // Ejecución inicial automática
    cargarVistaInicio();
});
// ============================================================
//  DICCIONARIO DE DATOS Y GESTIÓN DE MODALES
// ============================================================
const diccionarioTemas = {
    "Selectivas": { // Módulo general de Estructuras Selectivas (Creado anteriormente)
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
        caso: "\"Imagina que necesitas imprimir en pantalla los números del 1 al 10. En lugar de escribir diez líneas de código repetitivas, creas un ciclo. Le dices a la computadora: 'Empieza con un contador en 1, muéstralo en pantalla, súmale 1 a ese contador y repite el proceso'. La máquina repetirá la instrucción de forma automática vuelta tras vuelta y se detendrá inmediatamente cuando el contador llegue a 11, logrando mostrar la lista en un instante.\"",
        conclusion: "Los ciclos nos evitan el trabajo aburrido de duplicar código manualmente. Nos permiten procesar tareas repetitivas de forma automática, exacta y en fracciones de segundo."
    },

    "Array_unidimensional": {
        titulo: "Arreglos Unidimensionales",
        concepto: "Un arreglo unidimensional es una estructura de datos que almacena varios elementos del mismo tipo en una sola fila de posiciones consecutivas.",
        ejemplos: "Vectores, Listas Simples, Índices",
        caso: "\"Imagina que necesitas guardar las 5 calificaciones de un alumno. En lugar de crear 5 variables individuales (como calif1, calif2, etc.), creas una sola fila de casilleros en la memoria llamada 'Calificaciones' con espacio para 5 datos. La computadora numera cada espacio desde el 0. Así, en la posición 0 guardas el 8.5, en la posición 1 el 9.0, y puedes leer o modificar cualquier nota rápidamente solo diciendo el número de casillero al que quieres entrar.\"",
        conclusion: "Los arreglos unidimensionales son ideales para manejar listas simples de datos bajo un único nombre, manteniendo la información agrupada, ordenada y fácil de acceder."
    },

    "Array_bidimensional": {
        titulo: "Arreglos Bidimensionales",
        concepto: "Un arreglo bidimensional organiza los datos en filas y columnas, similar a una tabla o matriz.",
        ejemplos: "Matrices, Tablas de datos, Cuadrículas",
        caso: "\"Imagina que ahora no quieres registrar las notas de un solo alumno, sino las calificaciones de varios alumnos de un grupo. Para esto usas una cuadrícula tipo Excel: cada fila representa a un estudiante diferente (Alumno 0, Alumno 1, Alumno 2) y cada columna representa una materia distinta (Matemáticas en Columna 0, Historia en Columna 1). Si el programa quiere revisar la nota de Historia del segundo alumno, va directo a la intersección exacta de la Fila 1, Columna 1.\"",
        conclusion: "Los arreglos bidimensionales son la estructura perfecta cuando los datos tienen relaciones más complejas, permitiéndonos crear mapas, tablas y bases de datos ordenadas en dos dimensiones."
    },

    "Recursividad": {
        titulo: "Recursividad",
        concepto: "La recursividad es una técnica donde una función se llama a sí misma para resolver un problema dividiéndolo en problemas más pequeños. Toda función recursiva debe tener una condición de parada para evitar llamadas infinitas.",
        ejemplos: "Caso Base, Caso Recursivo, Pila de Llamadas",
        caso: "\"Imagina que quieres calcular el factorial de un número (como el factorial de 4, que consiste en multiplicar 4x3x2x1). El enfoque recursivo resuelve esto diciendo: 'Para calcular el factorial de 4, primero necesito resolver el factorial de 3 y multiplicarlo por 4'. La función se detiene a sí misma y abre un subproceso para calcular el factorial de 3, el cual a su vez pide el de 2, y así sucesivamente. Cuando llega al caso base (el número 1), el programa deja de abrir subprocesos y empieza a regresar multiplicando los resultados hacia atrás hasta entregarte el valor final de 24.\"",
        conclusion: "La recursividad es una forma elegante de programar donde un problema gigante se desarma a sí mismo en piezas idénticas cada vez más pequeñas, solucionándose de adentro hacia afuera."
    }
};

function abrirConceptoModal(idTema) {
    const modal = document.getElementById('modal-concepto');
    const datos = diccionarioTemas[idTema] || diccionarioTemas["default"];

    if (!modal) return;

    // Actualización de los elementos con la versión de conceptos sencillos
    document.getElementById('modal-titulo').innerText = datos.titulo;
    document.getElementById('modal-descripcion-texto').innerText = datos.concepto;
    document.getElementById('modal-caso-practico').innerText = datos.caso;
    document.getElementById('modal-abstraccion-conclusión').innerText = datos.conclusion;

    // Ocultar elementos sobrantes del diseño anterior
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