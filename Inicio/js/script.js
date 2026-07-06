//  HELPERS — mostrar / ocultar pantallas
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
//  SIDEBAR — abrir / cerrar en móvil
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

//  UTILIDAD — evitar que click y touchend se dupliquen

let _touchHandled = false;

function crearHandler(fn) {
    return {
        touch: (e) => {
            e.stopPropagation();
            _touchHandled = true;
            fn();
            setTimeout(() => { _touchHandled = false; }, 400);
        },
        click: (e) => {
            e.stopPropagation();
            if (_touchHandled) return;
            fn();
        }
    };
}
//  SUBMENÚ — acordeón
document.querySelectorAll('.nav-group .has-sub').forEach(btn => {
    const fn = () => {
        const group = btn.closest('.nav-group');
        const isOpen = group.classList.contains('open');
        document.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
        if (!isOpen) group.classList.add('open');
    };
    const h = crearHandler(fn);
    btn.addEventListener('touchend', h.touch);
    btn.addEventListener('click', h.click);
});

//  SUB-SUBMENÚ (3er nivel) — acordeón de simples / anidadas / compuestas
document.querySelectorAll('.nav-subgroup .has-sub2').forEach(btn => {
    const fn = () => {
        const sub = btn.closest('.nav-subgroup');
        const isOpen = sub.classList.contains('open');
        // cierra los subgrupos hermanos para que solo uno quede abierto
        sub.parentElement.querySelectorAll('.nav-subgroup.open')
            .forEach(s => s.classList.remove('open'));
        if (!isOpen) sub.classList.add('open');
    };
    const h = crearHandler(fn);
    btn.addEventListener('touchend', h.touch);
    btn.addEventListener('click', h.click);
});

//  NAVEGACIÓN — sub-botones finales

document.querySelectorAll('.nav-sub-btn:not(.has-sub2), .nav-sub2-btn, .nav-btn[data-tema]:not(.has-sub)').forEach(btn =>  {
    const fn = () => {
        const tema = btn.dataset.tema;
        if (!tema) return;
        if (tema === 'Glosario') return;
        limpiarPantalla();
        mostrarPantallaTema();
        cargarTema(tema);
        if (window.innerWidth < 768) closeSidebar();
    };
    const h = crearHandler(fn);
    btn.addEventListener('touchend', h.touch);
    btn.addEventListener('click', h.click);
});

//  HELPERS — actualizar título y definición en pantalla
function mostrarDescripcion(titulo, definicion) {
    const elTitulo = document.getElementById('tema-titulo');
    const elDesc = document.getElementById('tema-descripcion');
    if (elTitulo) elTitulo.innerHTML = titulo ? `<h2 class="tema-titulo-text">${titulo}</h2>` : '';
    if (elDesc) {
        elDesc.classList.remove('modo-ejercicio');   // ← AÑADE ESTA LÍNEA
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
    history.replaceState(null, '', '#' + nombreTema);
}

/* TOOLTIPS — palabras técnicas con explicación al pasar el cursor
Uso: tip('palabra', 'explicación corta')
Genera un <span class="glosario-tip"> con data-tip */

function tip(palabra, explicacion) {
    // Las comillas dobles dentro del atributo data-tip rompen el HTML
    // porque cierran el atributo antes de tiempo. Las escapamos a &quot;
    const textoSeguro = explicacion.replace(/"/g, '&quot;');
    return `<span class="glosario-tip" data-tip="${textoSeguro}">${palabra}</span>`;
}


//  VISTA DE GLOSARIO
const glosarioUnidades = [
    {
        unidad: 'Unidad II — Estructuras de control',
        terminos: [
            'datos_primitivos', 'datos_extendidos', 'espacio_memoria', 'rango_valores',
            'conversion_tipos', 'identificadores', 'variables', 'constantes',
            'palabras_reservadas', 'funciones_io', 'condicional_simple', 'condicional_doble',
            'condicional_multiple', 'condicional_anidada', 'repeticion_for', 'mientras_while'
        ]
    },
    {
        unidad: 'Unidad III — Subprogramas y recursividad',
        terminos: ['funciones', 'procedimientos', 'recursividad_term', 'procesos_recursivos']
    },
    {
        unidad: 'Unidad IV — Arreglos y archivos',
        terminos: ['arreglos', 'archivos']
    }
];

function cargarGlosario() {
    limpiarPantalla();
    mostrarPantallaTema();

    const temaTitulo = document.getElementById('tema-titulo');
    const temaDesc = document.getElementById('tema-descripcion');
    const gridModulos = document.getElementById('grid-modulos');

    if (temaTitulo) {
        temaTitulo.innerHTML = `<h2 class="fw-bold text-white mb-1">Conceptos</h2>`;
    }
    if (temaDesc) temaDesc.style.display = 'none';

    if (gridModulos) {
        gridModulos.className = '';
        let html = '';
        for (const grupo of glosarioUnidades) {
            html += `<h3 class="glosario-unidad-titulo">${grupo.unidad}</h3>`;
            html += `<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4 mb-5">`;
            for (const clave of grupo.terminos) {
                const datos = glosarioTerminos[clave];
                if (!datos) continue;
                // Para la tarjeta del glosario usamos el texto plano (sin HTML de tips)
                const conceptoPlano = datos.conceptoPlano || datos.concepto;
                html += `
                    <div class="col">
                        <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('${clave}')">
                            <h4 class="text-white fw-bold mb-1">${datos.titulo}</h4>
                            <p class="text-white small flex-grow-1 m-0 mt-2">${conceptoPlano.length > 90 ? conceptoPlano.slice(0, 90).trim() + '…' : conceptoPlano}</p>
                        </button>
                    </div>
                `;
            }
            html += `</div>`;
        }
        gridModulos.innerHTML = html;
    }
}

//  GESTIÓN DE EVENTOS DOM
document.addEventListener('DOMContentLoaded', () => {
    const btnInicio = document.getElementById('btn-inicio');
    const btnGlosario = document.getElementById('btn-glosario');

    if (btnInicio) {
        const hInicio = crearHandler(() => {
            mostrarPantallaInicio();
            history.replaceState(null, '', location.pathname);
            if (window.innerWidth < 768) closeSidebar();
        });
        btnInicio.addEventListener('touchend', hInicio.touch);
        btnInicio.addEventListener('click', hInicio.click);
    }

    if (btnGlosario) {
        const hGlosario = crearHandler(() => {
            cargarGlosario();
            if (window.innerWidth < 768) closeSidebar();
        });
        btnGlosario.addEventListener('touchend', hGlosario.touch);
        btnGlosario.addEventListener('click', hGlosario.click);
    }

    const hashTema = location.hash.slice(1);
    if (hashTema && window.temas && window.temas[hashTema]) {
        mostrarPantallaTema();
        cargarTema(hashTema);
    } else {
        mostrarPantallaInicio();
    }

    // ── Tooltip del modal ──────────────────────────────────────────────
    // El <dialog> vive en el "top layer" del navegador. Su ::backdrop
    // también vive ahí y tapa cualquier elemento con position:fixed
    // que esté fuera del dialog. La única solución real es insertar
    // el tooltip DENTRO del <dialog> y usar position:fixed con las
    // coordenadas absolutas del mouse (clientX/clientY). Al estar
    // dentro del top-layer, fixed se comporta como se espera y el
    // backdrop ya no lo puede tapar.
    // ──────────────────────────────────────────────────────────────────
    const modalDialog = document.getElementById('modal-concepto');
    const tooltipBox = document.createElement('div');
    tooltipBox.id = 'glosario-tooltip';
    // Insertarlo como PRIMER hijo del dialog para que quede por encima
    // del modal-content-wrapper y su backdrop interno.
    if (modalDialog) {
        modalDialog.insertBefore(tooltipBox, modalDialog.firstChild);
    } else {
        document.body.appendChild(tooltipBox);
    }

    document.addEventListener('mouseover', (e) => {
        const el = e.target.closest('.glosario-tip');
        if (!el) return;
        const texto = el.getAttribute('data-tip');
        if (!texto) return;

        // 1. Poner el texto y hacerlo visible PRIMERO para que el navegador
        //    calcule el tamaño real antes de leer offsetWidth/offsetHeight.
        tooltipBox.textContent = texto;
        tooltipBox.classList.add('visible');

        // 2. Leer dimensiones REALES ya renderizadas
        const tw = tooltipBox.offsetWidth;
        const th = tooltipBox.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Posición anclada al elemento (no al cursor), encima y centrada
        const elRect = el.getBoundingClientRect();
        let left = elRect.left + elRect.width / 2 - tw / 2;
        let top = elRect.top - th - 8;

        // Evitar que se salga de la pantalla
        if (left < 8) left = 8;
        if (left + tw > vw - 8) left = vw - tw - 8;
        if (top < 8) top = elRect.bottom + 8;   // aparece abajo si no cabe arriba
        if (top + th > vh - 8) top = vh - th - 8;

        tooltipBox.style.left = left + 'px';
        tooltipBox.style.top = top + 'px';
    });

    document.addEventListener('mouseout', (e) => {
        const el = e.target.closest('.glosario-tip');
        if (el) tooltipBox.classList.remove('visible');
    });
});


//DICCIONARIO

const diccionarioTemas = {
    "Selectivas": {
        titulo: "Estructuras Selectivas",
        concepto: `Las estructuras selectivas le permiten al programa tomar decisiones: "¿se cumple esta condición? Entonces haz esto; si no, haz aquello." Sin ellas, el programa haría siempre lo mismo sin importar lo que el usuario necesite.`,
        caso: `"Un alumno ingresa su promedio. Si es mayor o igual a 9, la pantalla muestra: '¡Tienes beca del 50%!'. Si no llega a 9, muestra: 'Sigue esforzándote'."`,
        conclusion: `Piénsalo como un semáforo: según el color que toque, decides si avanzas o te detienes. El programa hace exactamente eso con la información que recibe.`
    },
    "Ciclos": {
        titulo: "Ciclos",
        concepto: `Un ciclo es una orden que le dice al programa: "repite estas instrucciones hasta que yo te diga que pares." En vez de escribir cien veces la misma línea de código, escribes el ciclo una sola vez.`,
        caso: `"Quieres mostrar en pantalla los números del 1 al 100. Sin ciclo necesitarías 100 líneas de código. Con un ciclo, escribes 3 líneas y el programa hace el resto automáticamente."`,
        conclusion: `Los ciclos son como una lavadora: la metes en marcha, da las vueltas que necesita y se detiene sola. Tú no tienes que hacer nada más.`
    },
    "Array_unidimensional": {
        titulo: "Arreglos Unidimensionales",
        concepto: `Un arreglo unidimensional es como una fila de casilleros numerados. Todos guardan el mismo tipo de información y puedes acceder a cualquier casillero diciéndole al programa su número de posición.`,
        caso: `"Tienes 5 calificaciones que guardar. En lugar de crear 5 variables separadas (cal1, cal2, cal3…), creas un solo arreglo llamado 'calificaciones' con 5 espacios y accedes a cada uno por su número: calificaciones[0], calificaciones[1], etc."`,
        conclusion: `Imagina una regleta de chocolates: cada cuadrito es un espacio de tu arreglo. Todos están juntos, en orden, y puedes tomar cualquiera señalando su posición.`
    },
    "Array_bidimensional": {
        titulo: "Arreglos Bidimensionales",
        concepto: `Un arreglo bidimensional organiza la información en filas y columnas, como una hoja de cálculo o una tabla. Para llegar a un dato específico necesitas indicar en qué fila y en qué columna está.`,
        caso: `"Tienes 3 alumnos y 4 materias. Creas una tabla donde cada fila es un alumno y cada columna es una materia. Para ver la calificación del alumno 2 en la materia 3, pides: tabla[1][2]."`,
        conclusion: `Es como un asiento de cine: para encontrar tu lugar necesitas saber la fila Y la columna. Con dos números llegas exactamente al dato que buscas.`
    },
    "Recursividad": {
        titulo: "Recursividad",
        concepto: `La recursividad es cuando una función se llama a sí misma para resolver un problema grande, dividiéndolo en partes cada vez más pequeñas. Siempre debe tener un punto de parada, de lo contrario el programa nunca terminaría.`,
        caso: `"Para saber cuánto es el factorial de 4 (4×3×2×1), la función pregunta: '¿cuánto es el factorial de 3?', que a su vez pregunta por el de 2, luego el de 1. Cuando llega a 1, empieza a regresar resultados hasta completar la multiplicación."`,
        conclusion: `Es como abrir una caja que adentro tiene otra caja, que tiene otra más pequeña, y así hasta que llegas a la última. Luego regresas cerrando cajas una por una hasta terminar.`
    }
};

// ============================================================
//  GLOSARIO — términos del temario con tooltips en palabras técnicas
//  "conceptoPlano" es el texto sin HTML, para la vista previa de la tarjeta.
//  "concepto" es el texto con tooltips, para mostrar en el modal.
// ============================================================
const glosarioTerminos = {

    // ── Unidad II ──────────────────────────────────────────

    datos_primitivos: {
        titulo: "Datos primitivos",
        conceptoPlano: "Son los tipos de información más básicos que existen en un lenguaje de programación: números enteros, números con decimales, letras y valores de sí/no.",
        concepto: `Son los tipos de información más básicos que existen en un lenguaje de programación: números enteros, números con decimales, letras y valores de sí/no. El lenguaje los incluye desde el inicio, sin que tengas que hacer nada especial para usarlos.`,
        caso: `"Para guardar la edad de una persona usas un número entero (int). Para saber si un alumno aprobó o no, usas un valor de verdadero/falso (bool)."`,
        conclusion: `Los datos primitivos son los ingredientes más simples de la cocina de programación. Con ellos se construye todo lo demás.`
    },

    datos_extendidos: {
        titulo: "Datos extendidos",
        conceptoPlano: "Son tipos de información más complejos, construidos a partir de los datos primitivos. Sirven para guardar textos largos, listas de valores o grupos de información relacionada.",
        concepto: `Son tipos de información más complejos, construidos a partir de los ${tip('datos primitivos', 'Los más básicos: números, letras, verdadero/falso')}. Sirven para guardar textos largos, listas de valores o grupos de información relacionada.`,
        caso: `"Un texto (string) puede guardar el nombre completo de una persona: 'Ana García López'. Un arreglo puede guardar las calificaciones de todo un grupo de 30 alumnos en una sola estructura."`,
        conclusion: `Si los datos primitivos son ladrillos individuales, los datos extendidos son las paredes ya construidas: agrupan más información y hacen el trabajo más práctico.`
    },

    espacio_memoria: {
        titulo: "Espacio de memoria de cada tipo de dato",
        conceptoPlano: "Cuando el programa guarda un dato, la computadora le reserva un espacio físico en su memoria RAM. Cada tipo de dato ocupa un tamaño fijo, medido en bytes.",
        concepto: `Cuando el programa guarda un dato, la computadora le reserva un espacio físico en su ${tip('memoria RAM', 'La memoria de trabajo de la computadora: rápida pero temporal, se borra al apagar')}. Ese espacio se mide en ${tip('bytes', 'Unidad de medida de información digital. 1 byte equivale aproximadamente a un carácter de texto')}. Cada tipo de dato siempre ocupa el mismo tamaño, sin importar el valor que guardes.`,
        caso: `"Un número entero (int) siempre ocupa 4 bytes en memoria, ya sea que guardes el número 2 o el número 2,000,000. El espacio reservado depende del tipo, no del valor."`,
        conclusion: `Es como rentar una bodega: pagas por el tamaño del espacio aunque no lo llenes por completo. Por eso conviene elegir el tipo de dato más adecuado a lo que vayas a guardar.`
    },

    rango_valores: {
        titulo: "Rango de valores de cada tipo de dato",
        conceptoPlano: "Cada tipo de dato tiene un límite: un valor mínimo y un valor máximo que puede guardar. Si intentas guardar un número más grande del permitido, el dato se daña y obtienes resultados incorrectos.",
        concepto: `Cada tipo de dato tiene un límite: un valor mínimo y un valor máximo que puede guardar. Si intentas guardar un número más grande del permitido, ocurre un ${tip('desbordamiento', 'El valor supera el límite del tipo de dato y el programa lo recorta o lo reinicia desde el inicio del rango, dando un resultado incorrecto')} y obtienes resultados incorrectos.`,
        caso: `"Un número entero (int) puede guardar valores desde −2,147,483,648 hasta 2,147,483,647. Si intentas guardar 3,000,000,000, el número 'desborda' y el programa podría mostrar un valor negativo o incorrecto."`,
        conclusion: `Como un vaso de agua: si intentas llenarlo más de lo que cabe, se derrama. Lo mismo pasa con los datos cuando superan su límite.`
    },

    conversion_tipos: {
        titulo: "Conversión entre tipos de datos",
        conceptoPlano: "A veces necesitas transformar un dato de un tipo a otro: por ejemplo, convertir un texto que dice '25' en el número 25 para poder hacer cálculos con él. Eso es la conversión de tipos.",
        concepto: `A veces necesitas transformar un dato de un tipo a otro. Por ejemplo, convertir un texto que dice "25" en el número 25 para poder sumar. Hay dos formas: la ${tip('conversión implícita', 'El propio lenguaje la hace solo, de forma automática, cuando no hay riesgo de perder información')} (la hace el lenguaje solo) y la ${tip('conversión explícita', 'Tú le indicas al programa que convierta el dato, asumiendo la responsabilidad de que no se pierda información importante')} (tú se lo indicas).`,
        caso: `"El usuario escribe su edad en un cuadro de texto. El programa la recibe como texto ('17'), pero para calcular si es mayor de edad necesita el número 17. Le dices al programa que convierta ese texto en número y listo."`,
        conclusion: `Es como cambiar de moneda: tienes pesos y necesitas dólares para pagar. La conversión de tipos hace exactamente eso, cambia el "formato" del dato para que puedas usarlo donde lo necesitas.`
    },

    identificadores: {
        titulo: "Identificadores",
        conceptoPlano: "Un identificador es el nombre que le pones a algo en tu programa: a una variable, a una función, a una constante. Es como ponerle etiqueta a una caja para saber qué hay adentro.",
        concepto: `Un identificador es el nombre que le pones a algo en tu programa: a una ${tip('variable', 'Un espacio con nombre en la memoria donde guardas un valor que puede cambiar')}, a una ${tip('función', 'Un bloque de instrucciones con nombre que realiza una tarea específica')}, a una ${tip('constante', 'Un valor fijo que no cambia durante todo el programa')}. Es como ponerle etiqueta a una caja para saber qué hay adentro.`,
        caso: `"En lugar de llamar a tu variable 'x', la llamas 'edadAlumno'. Cuando alguien más lea el código (o tú mismo en 3 meses), sabrá de inmediato qué guarda esa variable, sin tener que adivinar."`,
        conclusion: `Un buen nombre lo cambia todo. 'x' no dice nada; 'precioTotal' lo dice todo. Los identificadores bien elegidos hacen que el código se lea casi como una oración en español.`
    },

    variables: {
        titulo: "Variables",
        conceptoPlano: "Una variable es un espacio reservado en la memoria de la computadora al que le pones un nombre. Puedes guardar un valor en ese espacio y cambiarlo las veces que necesites mientras el programa corre.",
        concepto: `Una variable es un espacio reservado en la ${tip('memoria RAM', 'La memoria de trabajo de la computadora: rápida y temporal, se borra cuando el programa termina')} de la computadora al que le pones un nombre. Puedes guardar un valor ahí y cambiarlo cuando quieras mientras el programa está corriendo.`,
        caso: `"En un videojuego, el marcador empieza en 0. Cada vez que el jugador anota un punto, el programa actualiza la variable 'puntos' sumándole 1. Al final de la partida puede valer 0, 50 o 1000, dependiendo de cómo le fue al jugador."`,
        conclusion: `Una variable es como una pizarra con nombre: puedes escribir algo, borrarlo y escribir algo nuevo cuantas veces quieras. El nombre siempre queda; lo que cambia es el contenido.`
    },

    constantes: {
        titulo: "Constantes",
        conceptoPlano: "Una constante es igual que una variable, con una diferencia importante: su valor se fija una sola vez al inicio y ya no puede cambiarse en ningún punto del programa.",
        concepto: `Una constante es igual que una ${tip('variable', 'Espacio en memoria cuyo valor puede cambiar durante el programa')}, con una diferencia clave: su valor se fija una sola vez al inicio y ya no puede cambiarse. Si alguien intenta modificarla, el ${tip('compilador', 'El programa que traduce tu código a instrucciones que la computadora puede ejecutar')} mostrará un error.`,
        caso: `"El valor de Pi (3.1416) nunca cambia. Lo declaras como constante una vez y lo usas en todos tus cálculos sin riesgo de que alguien lo modifique accidentalmente."`,
        conclusion: `Las constantes son como las reglas del juego: se definen al principio y todos las respetan. Evitan que un error humano cambie un valor que debería ser siempre el mismo.`
    },

    palabras_reservadas: {
        titulo: "Palabras reservadas",
        conceptoPlano: "Son palabras que el lenguaje de programación ya tiene tomadas para su propio uso. No puedes usarlas como nombre de tus variables o funciones porque el lenguaje las necesita para funcionar.",
        concepto: `Son palabras que el lenguaje ya tiene tomadas para su propio uso. El ${tip('compilador', 'El programa que traduce tu código a instrucciones que la computadora puede ejecutar')} las reconoce y les da un significado especial. No puedes usarlas como nombre de tus propias variables o funciones.`,
        caso: `"Si intentas llamar 'if' a una de tus variables, el programa dará error inmediatamente. 'if' ya le pertenece al lenguaje y significa 'si se cumple esta condición'. Lo mismo pasa con 'for', 'while', 'int', 'return', entre otras."`,
        conclusion: `Son como los nombres de los botones de un control remoto: ya tienen una función asignada y no puedes reasignarlos. El lenguaje los necesita para hacer lo que hace.`
    },

    funciones_io: {
        titulo: "Funciones de entrada y salida",
        conceptoPlano: "Son las instrucciones que permiten que el programa y el usuario se comuniquen. La entrada es cuando el usuario escribe o envía algo al programa. La salida es cuando el programa muestra un resultado en pantalla.",
        concepto: `Son las instrucciones que conectan al programa con el usuario. La ${tip('entrada (input)', 'Información que el usuario envía al programa: texto que escribe, botones que presiona, archivos que sube')} es cuando el usuario manda datos al programa. La ${tip('salida (output)', 'Información que el programa muestra al usuario: texto en pantalla, archivos generados, mensajes de error')} es cuando el programa muestra resultados.`,
        caso: `"El programa escribe en pantalla: '¿Cuántos años tienes?' — eso es salida. El usuario escribe '20' y presiona Enter — eso es entrada. Luego el programa responde: '¡Puedes votar!' — otra vez salida."`,
        conclusion: `Sin entrada y salida, el programa sería un cuarto oscuro sin puertas: haría cálculos pero nadie podría ver los resultados ni darle información. Son el puente entre el código y la persona.`
    },

    condicional_simple: {
        titulo: "Condicional simple",
        conceptoPlano: "Es la forma más básica de tomar una decisión en el código: si una condición se cumple, ejecuta estas instrucciones. Si no se cumple, el programa sigue de largo sin hacer nada especial.",
        concepto: `Es la forma más básica de tomar una decisión: ${tip('si', 'Palabra clave "if" en programación: evalúa si algo es verdad o mentira')} una condición se cumple, ejecuta un bloque de instrucciones. Si no se cumple, el programa simplemente sigue de largo sin hacer nada adicional.`,
        caso: `"Un cajero automático revisa: ¿tienes saldo suficiente? Si sí, realiza el retiro. Si no, el programa simplemente no hace nada (o en este caso podría mostrar un mensaje, pero eso ya sería un condicional doble)."`,
        conclusion: `Es como un portero: si cumples el requisito para entrar, te deja pasar. Si no, simplemente te ignora y sigue con otra cosa. Solo hay acción cuando la condición es verdadera.`
    },

    condicional_doble: {
        titulo: "Condicional doble",
        conceptoPlano: "Agrega un segundo camino al condicional simple: si la condición se cumple hace una cosa, y si NO se cumple hace otra diferente. Siempre se toma uno de los dos caminos.",
        concepto: `Agrega un segundo camino: ${tip('if', 'Evalúa si algo es verdad')} la condición se cumple, hace una cosa; ${tip('else', 'Significa "si no": se ejecuta cuando la condición del if no se cumplió')} (si no), hace otra diferente. El programa siempre tomará uno de los dos caminos, nunca ninguno.`,
        caso: `"Al terminar un examen, el programa revisa la calificación. Si es mayor o igual a 6 muestra: '¡Aprobado, felicidades!' Si es menor a 6 muestra: 'Reprobado, inténtalo de nuevo.' Siempre muestra uno de los dos mensajes."`,
        conclusion: `Como una bifurcación en el camino: de frente o a la derecha, pero siempre se avanza hacia alguno de los dos lados. No existe la opción de quedarse parado.`
    },

    condicional_multiple: {
        titulo: "Condicional múltiple",
        conceptoPlano: "Cuando hay más de dos opciones posibles, el condicional múltiple evalúa un valor y elige uno entre varios caminos. Es más ordenado que poner muchos condicionales dobles uno dentro del otro.",
        concepto: `Cuando hay más de dos opciones, el condicional múltiple evalúa un valor y elige uno entre varios caminos. Se puede escribir con ${tip('else if', 'Una condición adicional que se revisa solo si la anterior no se cumplió')} encadenados o con la instrucción ${tip('switch', 'Evalúa un valor y salta directamente al caso que coincida, como un selector de canales de TV')}, que es más limpia cuando hay muchas opciones.`,
        caso: `"Un programa recibe el número del día (1 al 7). Si es 1 muestra 'Lunes', si es 2 muestra 'Martes', y así hasta el 7. Con switch, el programa salta directo al caso correcto sin revisar los demás."`,
        conclusion: `Es como el menú de un restaurante: hay varios platillos, el mesero solo te trae el que pediste. No necesita revisar todos los demás, va directo a tu opción.`
    },

    condicional_anidada: {
        titulo: "Condicional anidada",
        conceptoPlano: "Es cuando pones un condicional dentro de otro condicional. La segunda decisión solo se evalúa si la primera ya se cumplió. Sirve para revisar condiciones más específicas, paso a paso.",
        concepto: `Es cuando pones un ${tip('condicional', 'Estructura que toma una decisión según si algo es verdad o mentira')} dentro de otro. La segunda decisión solo se evalúa si la primera ya resultó verdadera. Permite revisar condiciones más detalladas de forma organizada, de lo general a lo específico.`,
        caso: `"Un sistema de streaming primero revisa: ¿hay conexión a internet? Si sí, revisa: ¿el usuario tiene sesión iniciada? Si sí, revisa: ¿tiene suscripción activa? Solo si las tres condiciones son verdaderas, reproduce el contenido."`,
        conclusion: `Como abrir una caja fuerte con varios candados: primero abres el de afuera, luego el del medio, luego el de adentro. Cada candado solo se puede intentar si el anterior ya está abierto.`
    },

    repeticion_for: {
        titulo: "Repetición (For)",
        conceptoPlano: "El ciclo for repite un bloque de instrucciones un número exacto de veces. Desde el principio sabes cuántas repeticiones habrá porque el ciclo lleva un contador interno que avanza automáticamente.",
        concepto: `El ciclo for repite instrucciones un número exacto de veces. Usa un ${tip('contador', 'Una variable numérica que lleva la cuenta de cuántas veces ha repetido el ciclo')} que avanza automáticamente en cada vuelta. Cuando el contador llega al límite que definiste, el ciclo se detiene solo.`,
        caso: `"Quieres mostrar las tablas de multiplicar del 1 al 10. El for empieza con el contador en 1, hace la operación, lo sube a 2, repite, y así hasta llegar a 10. Tú solo escribiste el ciclo una vez."`,
        conclusion: `Es como programar una alarma para que suene 10 veces: le dices cuántas, y ella sola va contando. Cuando llega a 10, para. No tienes que estar pendiente de nada.`
    },

    mientras_while: {
        titulo: "Mientras (While)",
        conceptoPlano: "El ciclo while repite instrucciones mientras una condición sea verdadera. A diferencia del for, no necesitas saber de antemano cuántas veces va a repetirse; solo sabes cuándo debe detenerse.",
        concepto: `El ciclo while repite instrucciones mientras una condición sea verdadera. A diferencia del ${tip('for', 'Ciclo que repite un número exacto de veces usando un contador')}, no necesitas saber de antemano cuántas vueltas dará. El ciclo se detiene en el momento en que la condición deja de cumplirse.`,
        caso: `"Un juego de preguntas sigue mostrando preguntas mientras el jugador tenga vidas. Si empieza con 3 vidas, el ciclo corre. Cuando llega a 0 vidas, el while se detiene y aparece la pantalla de 'Game Over'."`,
        conclusion: `Es como escuchar música en repeat: sigue sonando mientras no la pares. No importa cuántas veces haya repetido, lo que importa es si la condición para continuar sigue siendo verdadera.`
    },

    // ── Unidad III ─────────────────────────────────────────

    funciones: {
        titulo: "Funciones",
        conceptoPlano: "Una función es un bloque de instrucciones al que le pones nombre y que hace una tarea específica. Puedes llamarla todas las veces que necesites sin tener que reescribir el código.",
        concepto: `Una función es un bloque de instrucciones con nombre que hace una tarea específica y, al terminar, te ${tip('devuelve un resultado', 'La función regresa un valor al lugar desde donde fue llamada, como si te diera una respuesta')}. Puedes llamarla desde cualquier parte de tu programa cuantas veces quieras.`,
        caso: `"Necesitas calcular el precio con descuento en varios puntos de tu tienda en línea. En lugar de escribir la fórmula 5 veces en distintos lugares, creas una función 'calcularDescuento' y simplemente la llamas cada vez que la necesitas."`,
        conclusion: `Una función es como una receta de cocina con nombre: la escribes una vez y la puedes seguir cuantas veces quieras. Si necesitas cambiar algo, lo cambias en un solo lugar y se actualiza en todo el programa.`
    },

    procedimientos: {
        titulo: "Procedimientos",
        conceptoPlano: "Un procedimiento es como una función, con una diferencia: no devuelve ningún resultado. Solo ejecuta una serie de instrucciones y termina. Se usa cuando necesitas que el programa haga algo, pero no necesitas que te diga nada de regreso.",
        concepto: `Un procedimiento es como una ${tip('función', 'Bloque de instrucciones con nombre que realiza una tarea y devuelve un resultado')}, con una diferencia: no devuelve ningún resultado al terminar. En C# se indica con la palabra ${tip('void', 'Significa "vacío": le dice al programa que este bloque de código no devolverá ningún valor al terminar')}. Solo ejecuta sus instrucciones y ya.`,
        caso: `"Un procedimiento 'mostrarMenu' imprime en pantalla las opciones del menú principal. Hace su trabajo (mostrar el texto) y termina. No necesita regresar ningún valor, solo realizar la acción."`,
        conclusion: `Si una función es como preguntarle algo a alguien y esperar respuesta, un procedimiento es darle una orden que solo necesitas que ejecute: "imprime esto", "limpia la pantalla", "guarda el archivo". Acción pura, sin respuesta.`
    },

    recursividad_term: {
        titulo: "Recursividad",
        conceptoPlano: "La recursividad es cuando una función se llama a sí misma para resolver un problema dividiéndolo en partes más pequeñas. Cada vez que se llama, el problema se hace un poco más simple, hasta llegar a un punto donde ya se puede resolver directamente.",
        concepto: `La recursividad es cuando una ${tip('función', 'Bloque de instrucciones con nombre que puede llamarse desde cualquier parte del programa')} se llama a sí misma. Con cada llamada, el problema se hace más pequeño. Toda función recursiva necesita un ${tip('caso base', 'La condición más simple del problema que la función puede resolver directamente, sin necesitar llamarse de nuevo')}: el punto donde ya no se llama más y empieza a devolver resultados.`,
        caso: `"Para calcular el factorial de 5 (5×4×3×2×1), la función pregunta: '¿cuánto es el factorial de 4?' Esa llama a la de 3, luego a la de 2, luego a la de 1. Cuando llega a 1 (el caso base), empieza a multiplicar de regreso: 1×2×3×4×5 = 120."`,
        conclusion: `Es como mirarte en dos espejos enfrentados: te ves a ti mismo dentro de ti mismo, cada vez más pequeño. Pero en algún punto la imagen se acaba (el caso base) y todo vuelve a colapsar hacia afuera con la respuesta final.`
    },

    procesos_recursivos: {
        titulo: "Procesos recursivos",
        conceptoPlano: "Cuando una función recursiva corre, cada llamada que hace queda en pausa, esperando la respuesta de la siguiente. Esto forma una pila de tareas pendientes. Cuando se llega al caso base, todas se resuelven en orden inverso, de la más interna a la más externa.",
        concepto: `Cuando una ${tip('función recursiva', 'Función que se llama a sí misma para resolver versiones más pequeñas del mismo problema')} corre, cada llamada queda pausada en una ${tip('pila de llamadas', 'Lista interna del programa que lleva el registro de todas las funciones que están esperando su respuesta, apiladas como platos')} esperando la respuesta de la siguiente. Al llegar al ${tip('caso base', 'La versión más simple del problema que se resuelve directamente, sin más llamadas recursivas')}, las respuestas se devuelven en orden inverso, de la más interna a la más externa.`,
        caso: `"Imagina que apilas platos: cada llamada recursiva es un plato nuevo encima. Cuando llegas al caso base (el fondo de la pila), empiezas a retirar platos de arriba hacia abajo, resolviendo cada uno con la respuesta del que estaba debajo."`,
        conclusion: `Entender la pila de llamadas te ayuda a saber exactamente qué está haciendo el programa en cada momento. También te explica por qué una recursividad sin caso base es peligrosa: la pila seguiría creciendo hasta que el programa colapse.`
    },

    // ── Unidad IV ──────────────────────────────────────────

    arreglos: {
        titulo: "Arreglos",
        conceptoPlano: "Un arreglo es una estructura que te permite guardar varios valores del mismo tipo bajo un solo nombre. Para acceder a un valor específico usas su número de posición, llamado índice.",
        concepto: `Un arreglo es una estructura que guarda varios valores del mismo tipo bajo un solo nombre. Para llegar a un valor específico usas su número de posición, llamado ${tip('índice', 'El número que indica en qué posición dentro del arreglo está un valor. Siempre empieza desde 0, no desde 1')}. Importante: el primer elemento está en el índice 0, no en el 1.`,
        caso: `"Tienes las calificaciones de 30 alumnos. En lugar de crear 30 variables (cal1, cal2, cal3…), creas un arreglo 'calificaciones' con 30 espacios. Para ver la calificación del primer alumno pides calificaciones[0]; para el décimo, calificaciones[9]."`,
        conclusion: `Un arreglo es como una lista numerada en un cuaderno: todos los datos están juntos, en orden, y puedes ir directo al que necesitas sabiendo su número de renglón. Mucho más práctico que tener una hoja por cada dato.`
    },

    archivos: {
        titulo: "Archivos",
        conceptoPlano: "Los archivos permiten guardar información de forma permanente en el disco duro de la computadora. A diferencia de las variables (que se borran cuando el programa termina), lo que guardas en un archivo sigue ahí aunque apagues la computadora.",
        concepto: `Los archivos guardan información de forma permanente en el ${tip('disco duro', 'El almacenamiento permanente de la computadora. A diferencia de la RAM, no se borra al apagar')}. A diferencia de las ${tip('variables', 'Espacios en memoria RAM que solo existen mientras el programa está corriendo. Al cerrarlo, desaparecen')}, los archivos conservan los datos aunque el programa se cierre o la computadora se apague.`,
        caso: `"Un juego guarda tu progreso en un archivo. La próxima vez que lo abres, lee ese archivo y restaura exactamente dónde te quedaste: tu nivel, tu inventario y tus puntos. Sin archivos, empezarías desde cero cada vez."`,
        conclusion: `Los archivos son la memoria a largo plazo del programa. Las variables son lo que recuerda mientras está despierto; los archivos son lo que recuerda al día siguiente. Sin ellos, cada vez que abrirías el programa sería como la primera vez.`
    }
};

// MODAL — abrir con innerHTML para que los tips funcionen

function abrirConceptoModal(idTema) {
    const modal = document.getElementById('modal-concepto');
    const datos = glosarioTerminos[idTema] || diccionarioTemas[idTema] || diccionarioTemas["Selectivas"];
    if (!modal) return;

    document.getElementById('modal-titulo').innerText = datos.titulo;

    // innerHTML para que los <span class="glosario-tip"> se rendericen
    document.getElementById('modal-descripcion-texto').innerHTML = datos.concepto;
    document.getElementById('modal-caso-practico').innerHTML = datos.caso;
    document.getElementById('modal-abstraccion-conclusión').innerHTML = datos.conclusion;

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