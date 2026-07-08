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
        elDesc.classList.remove('modo-ejercicio');
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
    // fuera del dialog. La solución es insertar el tooltip DENTRO del
    // <dialog> y usar position:fixed con las coordenadas del mouse.
    // ──────────────────────────────────────────────────────────────────
    const modalDialog = document.getElementById('modal-concepto');
    const tooltipBox = document.createElement('div');
    tooltipBox.id = 'glosario-tooltip';
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

/* ============================================================
   GLOSARIO CONECTADO A LA API
   Lee términos y tips desde la base de datos (una sola llamada).
   Los marcadores [[palabra]] del texto se convierten en tooltips.
   ============================================================ */

/* --- Caché en memoria: se pide el glosario UNA vez por sesión --- */
let _glosarioCache = null;      // arreglo de términos tal como llega de la API
let _glosarioPorId = null;      // índice { id: término } para acceso rápido
let _glosarioPromesa = null;    // evita llamadas simultáneas duplicadas

/* Respaldo mínimo por si la API falla: los 5 conceptos de inicio.
   Así las tarjetas de la pantalla de inicio nunca quedan "muertas".
   Se indexan por la clave que usan los onclick de inicio.html. */
const GLOSARIO_RESPALDO = {
  Selectivas: {
    id: 'Selectivas', termino: 'Estructuras Selectivas',
    definicion: 'Las estructuras selectivas le permiten al programa tomar decisiones: ¿se cumple esta condición? Entonces haz esto; si no, haz aquello.',
    caso: 'Un alumno ingresa su promedio. Si es mayor o igual a 9, muestra "¡Tienes beca!". Si no, muestra "Sigue esforzándote".',
    conclusion: 'Piénsalo como un semáforo: según el color, decides si avanzas o te detienes.',
    glosario_tips: []
  },
  Ciclos: {
    id: 'Ciclos', termino: 'Ciclos',
    definicion: 'Un ciclo le dice al programa: repite estas instrucciones hasta que yo te diga que pares.',
    caso: 'Mostrar los números del 1 al 100. Con un ciclo escribes 3 líneas y el programa hace el resto.',
    conclusion: 'Los ciclos son como una lavadora: la enciendes, da las vueltas que necesita y se detiene sola.',
    glosario_tips: []
  },
  Array_unidimensional: {
    id: 'Array_unidimensional', termino: 'Arreglos Unidimensionales',
    definicion: 'Un arreglo unidimensional es como una fila de casilleros numerados que guardan el mismo tipo de información.',
    caso: 'Tienes 5 calificaciones. En vez de 5 variables, creas un arreglo con 5 espacios y accedes por su número.',
    conclusion: 'Como una regleta de chocolates: cada cuadrito es un espacio, y tomas cualquiera señalando su posición.',
    glosario_tips: []
  },
  Array_bidimensional: {
    id: 'Array_bidimensional', termino: 'Arreglos Bidimensionales',
    definicion: 'Un arreglo bidimensional organiza la información en filas y columnas, como una tabla.',
    caso: 'Tienes 3 alumnos y 4 materias. Cada fila es un alumno y cada columna una materia.',
    conclusion: 'Es como un asiento de cine: necesitas la fila Y la columna para encontrar tu lugar.',
    glosario_tips: []
  },
  Recursividad: {
    id: 'Recursividad', termino: 'Recursividad (concepto)',
    definicion: 'La recursividad es cuando una función se llama a sí misma, dividiendo un problema en partes más pequeñas.',
    caso: 'El factorial de 4 pregunta por el de 3, que pregunta por el de 2, hasta llegar a 1.',
    conclusion: 'Como abrir una caja que adentro tiene otra caja, y así hasta la última.',
    glosario_tips: []
  }
};

/* Trae el glosario de la API (o del caché si ya se pidió). */
async function obtenerGlosario() {
  if (_glosarioCache) return _glosarioCache;
  if (_glosarioPromesa) return _glosarioPromesa;   // ya hay una petición en curso

  _glosarioPromesa = (async () => {
    const datos = await window.ApiClient.listarGlosario();  // GET /api/glosario
    _glosarioCache = Array.isArray(datos) ? datos : [];
    _glosarioPorId = {};
    for (const t of _glosarioCache) _glosarioPorId[t.id] = t;
    return _glosarioCache;
  })();

  try {
    return await _glosarioPromesa;
  } catch (e) {
    _glosarioPromesa = null;   // permite reintentar en la siguiente
    throw e;
  }
}

/* Convierte los marcadores [[palabra]] del texto en <span> con tooltip,
   usando la lista de tips del término. Si no hay tip para un marcador,
   solo quita los corchetes y deja la palabra normal. */
function renderTips(texto, tips) {
  if (!texto) return '';
  const mapa = {};
  for (const t of (tips || [])) mapa[t.marcador.toLowerCase()] = t.explicacion;

  return texto.replace(/\[\[(.+?)\]\]/g, (_, palabra) => {
    const expl = mapa[palabra.toLowerCase()];
    if (!expl) return palabra;   // marcador sin tip: dejar palabra limpia
    return tip(palabra, expl);   // reutiliza tu función tip() existente
  });
}

/* Vista de Glosario: agrupa por la columna 'unidad' de la BD. */
async function cargarGlosario() {
  limpiarPantalla();
  mostrarPantallaTema();

  const temaTitulo = document.getElementById('tema-titulo');
  const temaDesc = document.getElementById('tema-descripcion');
  const gridModulos = document.getElementById('grid-modulos');

  if (temaTitulo) temaTitulo.innerHTML = `<h2 class="fw-bold text-white mb-1">Conceptos</h2>`;
  if (temaDesc) temaDesc.style.display = 'none';
  if (!gridModulos) return;

  gridModulos.className = '';
  gridModulos.innerHTML = `<p class="cs-empty-hint">Cargando glosario…</p>`;

  let terminos;
  try {
    terminos = await obtenerGlosario();
  } catch (e) {
    gridModulos.innerHTML =
      `<div class="sim-api-error">No se pudo cargar el glosario desde el servidor. Revisa tu conexión e inténtalo de nuevo.</div>`;
    return;
  }

  // Agrupar por unidad. El orden se fuerza aquí para que siempre salga
  // en este orden, sin importar cómo lleguen de la API. Los "General"
  // NO se muestran en el glosario porque ya aparecen en la pantalla de
  // inicio. Cualquier unidad no listada se agrega al final.
  const ORDEN_UNIDADES = ['Unidad II', 'Unidad III', 'Unidad IV', 'Operadores'];
  const UNIDADES_OCULTAS = ['General'];

  const porUnidad = {};
  for (const t of terminos) {
    const u = t.unidad || 'General';
    if (UNIDADES_OCULTAS.includes(u)) continue;   // se omite en el glosario
    (porUnidad[u] = porUnidad[u] || []).push(t);
  }

  // Ordenar términos dentro de cada unidad por id (orden estable)
  for (const u in porUnidad) {
    porUnidad[u].sort((a, b) => (a.id || 0) - (b.id || 0));
  }

  const grupos = [];
  for (const u of ORDEN_UNIDADES) {
    if (porUnidad[u]) { grupos.push({ unidad: u, terminos: porUnidad[u] }); delete porUnidad[u]; }
  }
  for (const u in porUnidad) {
    grupos.push({ unidad: u, terminos: porUnidad[u] });
  }

  let html = '';
  for (const grupo of grupos) {
    html += `<h3 class="glosario-unidad-titulo">${grupo.unidad}</h3>`;
    html += `<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4 mb-5">`;
    for (const t of grupo.terminos) {
      // Vista previa: texto sin marcadores ni HTML
      const plano = (t.definicion || '').replace(/\[\[(.+?)\]\]/g, '$1');
      const corto = plano.length > 90 ? plano.slice(0, 90).trim() + '…' : plano;
      html += `
        <div class="col">
          <button class="card h-100 p-4 w-100 text-start modular-card-btn" onclick="abrirConceptoModal('${t.id}')">
            <h4 class="text-white fw-bold mb-1">${t.termino}</h4>
            <p class="text-white small flex-grow-1 m-0 mt-2">${corto}</p>
          </button>
        </div>`;
    }
    html += `</div>`;
  }
  gridModulos.innerHTML = html;
}

/* Modal de concepto. Acepta un id numérico (término de la BD) o una
   clave de respaldo ('Selectivas', 'Ciclos', etc.) para las tarjetas
   de la pantalla de inicio. */
async function abrirConceptoModal(idTema) {
  const modal = document.getElementById('modal-concepto');
  if (!modal) return;

  // Si el caché aún no existe, intentar cargarlo (para las tarjetas de inicio
  // que pueden abrirse antes de visitar la vista de Glosario)
  if (!_glosarioPorId) {
    try { await obtenerGlosario(); } catch (e) { /* usaremos respaldo */ }
  }

  // Buscar el término: primero en caché de la API, luego en respaldo
  let datos = null;
  if (_glosarioPorId && _glosarioPorId[idTema]) {
    datos = _glosarioPorId[idTema];
  } else if (GLOSARIO_RESPALDO[idTema]) {
    datos = GLOSARIO_RESPALDO[idTema];
  } else if (_glosarioCache) {
    // Último recurso: buscar por termino coincidente
    datos = _glosarioCache.find(t => t.termino === idTema) || null;
  }

  if (!datos) datos = GLOSARIO_RESPALDO.Selectivas;

  document.getElementById('modal-titulo').innerText = datos.termino || 'Concepto';

  // innerHTML para que los <span class="glosario-tip"> se rendericen
  document.getElementById('modal-descripcion-texto').innerHTML =
    renderTips(datos.definicion, datos.glosario_tips);
  document.getElementById('modal-caso-practico').innerHTML = datos.caso || '';
  document.getElementById('modal-abstraccion-conclusión').innerHTML = datos.conclusion || '';

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