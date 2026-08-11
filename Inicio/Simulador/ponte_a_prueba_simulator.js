// ============================================================
//  Simulador/ponte_a_prueba_simulator.js
//  Consola del apartado "Ponte a prueba": banco global de ejercicios
//  con bugs (GET /ejercicios/practica, ejercicios con modo='practica'
//  de cualquier subtema). El estudiante corrige codigo_con_errores
//  solo en las líneas marcadas como editables (soluciones_validacion.
//  lineas_editables), ejecuta con CSharpEngine y valida su salida
//  contra el backend (POST /ejercicios/:id/validar).
// ============================================================

// ── CSS del panel ───────────────────────────

(function injectPpStyles() {
    if (document.getElementById('pp-styles')) return;
    const style = document.createElement('style');
    style.id = 'pp-styles';
    style.textContent = `
        .pp-line-editable { background: rgba(224,82,99,0.15); }
        .pp-line-editable-gutter { border-left: 3px solid #e05263; }
        .pp-ejercicio-meta { font-size: 0.85em; opacity: .75; margin-bottom: 4px; }
        .pp-resultado {
            margin: 8px 14px; padding: 10px 14px; border-radius: 8px;
            font-family: monospace; white-space: pre-wrap; display: none;
        }
        .pp-resultado-ok    { background: rgba(4,170,109,0.15);   border: 1px solid #04aa6d; color: #04aa6d; }
        .pp-resultado-error { background: rgba(220,53,69,0.15);   border: 1px solid #dc3545; color: #dc3545; }
        .pp-resultado-info  { background: rgba(255,193,7,0.15);   border: 1px solid #ffc107; color: #ffc107; }

        .pp-stepper {
            display: flex; align-items: center; justify-content: center;
            gap: 14px; padding: 10px 14px 0;
        }
        .pp-stepper__label { font-size: 0.9rem; color: var(--white); min-width: 130px; text-align: center; }
        .pp-stepper__arrow {
            width: 30px; height: 30px; border-radius: 6px; flex-shrink: 0;
            background: transparent; border: 1px solid var(--console-border); color: var(--white);
            display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.85rem;
        }
        .pp-stepper__arrow:hover:not(:disabled) { border-color: #04aa6d; color: #04aa6d; }
        .pp-stepper__arrow:disabled { opacity: 0.3; cursor: not-allowed; }
        .pp-stepper__bar {
            height: 5px; margin: 8px 14px 0; background: #252a3a; border-radius: 3px; overflow: hidden;
        }
        .pp-stepper__bar i {
            display: block; height: 100%; width: 0%; background: #04aa6d; border-radius: 3px;
            transition: width 0.3s ease;
        }

        .pp-grupos {
            display: flex; flex-wrap: wrap; gap: 8px;
            padding: 10px 14px 0;
        }
        .pp-grupo-tab {
            background: transparent; border: 1px solid var(--console-border); color: var(--white);
            border-radius: 999px; padding: 6px 14px; font-size: 0.9rem; cursor: pointer;
            display: flex; align-items: center; gap: 6px;
        }
        .pp-grupo-tab:hover { border-color: #04aa6d; }
        .pp-grupo-tab.activo { background: #04aa6d; border-color: #04aa6d; color: #08131a; font-weight: 700; }
        .pp-grupo-tab .n {
            background: rgba(0,0,0,0.2); border-radius: 10px; padding: 0 7px; font-size: 0.85em;
        }
        .pp-grupo-tab.activo .n { background: rgba(0,0,0,0.15); }
        .pp-grupo-tab.completo:not(.activo) { border-color: #04aa6d; color: #04aa6d; }
    `;
    document.head.appendChild(style);
})();

// ── Utilidades ───────────────────────────────────────────────

function ppEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function ppFmtVal(v, type) {
    if (v === null || v === undefined) return { text: 'null' };
    if (type === 'bool' || typeof v === 'boolean') return { text: v ? 'true' : 'false' };
    if (type === 'char') return { text: "'" + v + "'" };
    if (type === 'string' || typeof v === 'string') return { text: '"' + v + '"' };
    return { text: String(v) };
}

function ppCellText(v) {
    if (v === null || v === undefined) return '·';
    if (typeof v === 'boolean') return v ? 'T' : 'F';
    return String(v);
}

function _ppBtns() {
    return [
        document.getElementById('btn-reiniciar'),
        document.getElementById('btn-paso-anterior'),
        document.getElementById('btn-paso-siguiente'),
        document.getElementById('btn-reproducir')
    ];
}

// ── SnapshotManager ──────────────────────────────────────────

class PpSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset()  { this.snaps = []; this.idx = -1; }
    load(snapshots) { this.snaps = snapshots || []; this.idx = this.snaps.length ? 0 : -1; }
    current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next()  { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev()  { if (this.idx > 0) this.idx--; return this.current(); }
    total() { return this.snaps.length; }
}

// ── Simulador (usa CSharpEngine como motor) ──────────────────

class PonteApruebaSimulator {
    constructor() { this.snap = new PpSnapMgr(); this.lastAst = null; }
    load(code) {
        this.snap.reset();
        this.lastAst = null;
        let result;
        try {
            result = CSharpEngine.compileAndRun(code, { maxSteps: 20000 });
        } catch (e) {
            return {
                currentLine: e.line || 1, description: e.message, isError: true,
                variables: [], arrays: [], matrices: [], output: [], changed: []
            };
        }
        this.lastAst = result.ast;
        this.snap.load(result.snapshots);
        return this.snap.current();
    }
    next()  { return this.snap.next(); }
    prev()  { return this.snap.prev(); }
    clear() { this.snap.reset(); this.lastAst = null; }
    info()  { return { index: this.snap.idx, total: this.snap.total() }; }
}

// ════════════════════════════════════════════════════════════
//  CONEXIÓN CON LA API — banco global de ejercicios modo='practica'
// ════════════════════════════════════════════════════════════

let ppCachePracticas = null;

async function ppObtenerPracticas() {
    if (ppCachePracticas) return ppCachePracticas;
    if (!window.ApiClient || typeof window.ApiClient.listarEjerciciosPractica !== 'function') {
        throw new Error('ApiClient.listarEjerciciosPractica no está disponible');
    }
    const lista = await window.ApiClient.listarEjerciciosPractica();
    ppCachePracticas = Array.isArray(lista) ? lista : [];
    return ppCachePracticas;
}

// Título del tema — a diferencia de los otros simuladores, esta página
// reusa #tema-descripcion para el enunciado por pestaña (ppSetDescripcion),
// así que el título se pinta aparte en vez de con mostrarDescripcion().
function ppSetTitulo(titulo) {
    const elTitulo = document.getElementById('tema-titulo');
    if (elTitulo) elTitulo.innerHTML = titulo ? '<h2 class="tema-titulo-text">' + titulo + '</h2>' : '';
}

function ppSetDescripcion(html, esEjercicio) {
    const elDesc = document.getElementById('tema-descripcion');
    if (!elDesc) return;
    if (html) {
        elDesc.innerHTML = esEjercicio
            ? '<span class="sim-ejercicio-badge">Ejercicio: </span>' + html
            : html;
        elDesc.style.display = 'block';
        elDesc.classList.toggle('modo-ejercicio', !!esEjercicio);
    } else {
        elDesc.innerHTML = '';
        elDesc.style.display = 'none';
        elDesc.classList.remove('modo-ejercicio');
    }
}

function ppMostrarErrorApi(mensaje) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;
    let box = document.getElementById('pp-api-error');
    if (!mensaje) { if (box) box.remove(); return; }
    if (!box) {
        box = document.createElement('div');
        box.id = 'pp-api-error';
        box.className = 'sim-api-error';
        editorBody.parentNode.insertBefore(box, editorBody);
    }
    box.textContent = mensaje;
}

// ── Caja de resultado (validación / pista) ─────────────────────

function ppResultadoBox() {
    let box = document.getElementById('pp-resultado');
    if (!box) {
        box = document.createElement('div');
        box.id = 'pp-resultado';
        const desc = document.getElementById('tema-descripcion');
        if (desc && desc.parentNode) desc.parentNode.insertBefore(box, desc.nextSibling);
        else document.body.appendChild(box);
    }
    box.className = 'pp-resultado';
    box.style.display = 'block';
    return box;
}

function ppOcultarResultado() {
    const box = document.getElementById('pp-resultado');
    if (box) { box.style.display = 'none'; box.textContent = ''; }
    // Cancela cualquier "Comprobar" en curso (pausado o no) — evita que un
    // veredicto viejo aparezca al volver a este ejercicio, o que un "resume"
    // se confunda con el de otro ejercicio/tema.
    ppComprobarEnCurso = false;
    ppOnDoneComprobar = null;
    ppComprobarCodigoActivo = null;
}

// ── Estado global del módulo ──────────────────────────────────

const ppSim = new PonteApruebaSimulator();
let ppMonacoEditor = null;
let ppDecorations  = [];
let ppEditableDecorations = [];
let ppPlayTimer    = null;
let ppPlaying      = false;
let ppCurrentCode  = '';
let ppItemActual   = null;
let ppLineasEditablesActual = [];
let ppUltimoCodigoValido = '';
// "Comprobar" ahora se puede pausar/reanudar: mientras haya una corrida en
// curso (en_curso=true) el clic reanuda la animación en vez de reiniciar
// desde el paso 0 y volver a pedirle al backend que valide.
let ppComprobarEnCurso = false;
let ppOnDoneComprobar = null;
let ppComprobarCodigoActivo = null;

// Mismo ícono play/pausa que el resto de los simuladores, pero el texto del
// tooltip se queda en "Comprobar" — este botón no solo reproduce, también
// valida la solución contra el backend.
const _PP_ICON_PLAY  = '<img src="../img/iconos/play.png" alt="Comprobar"><span class="tooltip-text">Comprobar</span>';
const _PP_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Comprobar"><span class="tooltip-text">Comprobar</span>';

// ── Progresión lineal del banco de ejercicios, por módulo ──────
// ppGroups: un grupo por categoría (Ciclos, Arreglos, Recursividad...),
// cada uno con su propia lista de ejercicios y su propio avance —
// el alumno elige en qué módulo trabajar (pestañas ppRenderGrupos),
// pero dentro de un módulo la progresión sigue siendo lineal: currentIndex
// es el primer no resuelto DE ESE GRUPO (recalculado del servidor, nunca
// de localStorage, para sobrevivir a un F5 o cerrar sesión), y viewIndex
// es el que se está viendo (puede ser menor si el alumno retrocedió a
// revisar uno ya resuelto).
let ppGroups = [];
let ppGroupIndex = 0;

function ppGrupoActual() { return ppGroups[ppGroupIndex] || null; }

// ── Restricción de edición a las líneas marcadas ───────────────

function ppEsEdicionValida(nuevo, anterior, lineasPermitidas) {
    if (!lineasPermitidas || !lineasPermitidas.length) return true; // sin metadatos: no se restringe
    const nuevas = nuevo.split('\n');
    const viejas = anterior.split('\n');
    if (nuevas.length !== viejas.length) return false; // no se permite agregar/quitar líneas
    for (let i = 0; i < nuevas.length; i++) {
        if (nuevas[i] !== viejas[i] && !lineasPermitidas.includes(i + 1)) return false;
    }
    return true;
}

function ppOnEditorChange() {
    if (!ppMonacoEditor) return;
    const nuevo = ppMonacoEditor.getValue();
    if (nuevo === ppUltimoCodigoValido) return;
    if (ppEsEdicionValida(nuevo, ppUltimoCodigoValido, ppLineasEditablesActual)) {
        ppUltimoCodigoValido = nuevo;
    } else {
        const pos = ppMonacoEditor.getPosition();
        ppMonacoEditor.setValue(ppUltimoCodigoValido);
        if (pos) ppMonacoEditor.setPosition(pos);
    }
}

function ppResaltarLineasEditables(lineas) {
    if (!ppMonacoEditor || !window.monaco) return;
    const decos = (lineas || []).map(l => ({
        range: new monaco.Range(l, 1, l, 1),
        options: { isWholeLine: true, className: 'pp-line-editable', linesDecorationsClassName: 'pp-line-editable-gutter' }
    }));
    ppEditableDecorations = ppMonacoEditor.deltaDecorations(ppEditableDecorations, decos);
}

// ── Ejecutar código y refrescar los paneles ────────────────────

function ppEjecutar(codigo) {
    const first = ppSim.load(codigo);
    ppRender(first, ppSim.info());
    const btns = _ppBtns();
    if (btns[1]) btns[1].disabled = true;
    ppPlaying = false;
}

// ── Comprobar: reproduce la ejecución paso a paso y, hasta que esa
// reproducción termina (llega al último paso que se pudo ejecutar),
// pinta el veredicto del backend — no antes, aunque la red responda
// más rápido que la animación. El mismo botón funciona como play/pausa
// (ver ppConectarBotones): un clic mientras anima pausa sin perder el
// progreso ni volver a pedirle al backend que valide; un clic estando
// pausado reanuda desde donde se quedó.
function ppComprobarSolucion() {
    if (!ppItemActual || !ppItemActual.id || !ppMonacoEditor) return;
    const btns = _ppBtns();

    if (ppPlaying) { ppStopPlay(btns); return; }

    const codigo = ppMonacoEditor.getValue();

    if (!ppComprobarEnCurso || codigo !== ppComprobarCodigoActivo) {
        // Arranque en frío (primer clic, o el código cambió desde la última
        // corrida): reinicia desde el paso 0 y dispara la validación.
        ppOcultarResultado();
        ppEjecutar(codigo);

        // La llamada al backend se lanza ya (por la latencia de red), pero
        // el resultado se guarda y no se muestra hasta ppMostrarVeredicto().
        const veredictoPromise = ppValidarConBackend(codigo);
        ppComprobarEnCurso = true;
        ppComprobarCodigoActivo = codigo;
        ppOnDoneComprobar = () => veredictoPromise.then(v => {
            ppComprobarEnCurso = false;
            ppMostrarVeredicto(v);
        });
    }

    const dispararSiTermino = () => {
        if (!ppOnDoneComprobar) return;
        const cb = ppOnDoneComprobar;
        ppOnDoneComprobar = null;
        cb();
    };

    if (ppSim.info().total > 1) {
        ppPlaying = true;
        if (btns[3]) btns[3].innerHTML = _PP_ICON_PAUSE;
        ppPlayTimer = setTimeout(() => ppAutoPlay(btns, dispararSiTermino), ppGetDelay());
    } else {
        // Nada que animar (p. ej. error de compilación en el paso 0):
        // el veredicto se muestra en cuanto la validación responda.
        dispararSiTermino();
    }
}

// ── Validar solución contra el backend ─────────────────────────
// Devuelve el veredicto en vez de pintarlo — quien llama decide cuándo
// mostrarlo (ppComprobarSolucion espera a que termine la animación).

async function ppValidarConBackend(codigo) {
    let resultado;
    try {
        resultado = CSharpEngine.compileAndRun(codigo, { maxSteps: 20000 });
    } catch (e) {
        return { texto: 'El código no compiló: ' + (e.message || 'error desconocido'), clase: 'pp-resultado-error' };
    }
    if (resultado.error) {
        return { texto: 'Error al ejecutar: ' + (resultado.error.message || resultado.error), clase: 'pp-resultado-error' };
    }

    try {
        const veredicto = await window.ApiClient.validarEjercicio(ppItemActual.id, resultado.output || []);
        if (veredicto.correcto) {
            return {
                texto: '¡Correcto, redirigiendo a la siguiente lección!',
                clase: 'pp-resultado-ok',
                correcto: true,
                // primeraVez lo manda el backend — evita que un reintento sobre
                // un ejercicio ya resuelto vuelva a "avanzar" o sumar puntos.
                esNuevo: !!veredicto.primeraVez,
            };
        }
        return {
            texto: 'Aún no es correcto. Salida esperada:\n' + (veredicto.salida_esperada || []).join('\n'),
            clase: 'pp-resultado-error'
        };
    } catch (e) {
        return { texto: 'No se pudo validar: ' + e.message, clase: 'pp-resultado-error' };
    }
}

function ppMostrarVeredicto(v) {
    const caja = ppResultadoBox();
    caja.textContent = v.texto;
    caja.className = 'pp-resultado ' + v.clase;
    if (!v.correcto) return;

    if (ppItemActual) ppItemActual.resuelto = true;

    if (v.esNuevo) {
        // Invalida el caché: la próxima vez que se entre a esta pestaña
        // (o se recargue la página) se vuelve a pedir al backend, que es
        // la única fuente de verdad de qué se resolvió.
        ppCachePracticas = null;
        const grupo = ppGrupoActual();
        if (grupo) {
            grupo.currentIndex = grupo.items.findIndex(it => !it.resuelto);
            if (grupo.currentIndex === -1) grupo.currentIndex = grupo.items.length - 1;
        }
        ppRenderGrupos();
        ppRenderStepper();
        if (typeof window.actualizarProgresoUsuario === 'function') window.actualizarProgresoUsuario();
    }

    // Al resolver correctamente, pasa solo al siguiente ejercicio DE ESTE
    // MISMO módulo tras un segundo — si ya era el último de la categoría,
    // se queda aquí (cambiar de módulo lo sigue haciendo el alumno a mano).
    setTimeout(() => {
        const grupo = ppGrupoActual();
        if (!grupo || ppItemActual !== grupo.items[grupo.viewIndex]) return;
        if (grupo.viewIndex + 1 < grupo.items.length) {
            ppStopPlay(_ppBtns());
            ppIrA(grupo.viewIndex + 1);
        }
    }, 2000);
}

function ppMostrarPista() {
    const caja = ppResultadoBox();
    // Las líneas editables (en rojo) se quedan ocultas hasta que el alumno
    // pide la pista — así no delatan de entrada dónde está el bug.
    ppResaltarLineasEditables(ppLineasEditablesActual);
    if (!ppItemActual || !ppItemActual.pista) {
        caja.textContent = 'Este ejercicio no tiene pista disponible.';
        caja.className = 'pp-resultado pp-resultado-info';
        return;
    }
    caja.textContent = ppItemActual.pista;
    caja.className = 'pp-resultado pp-resultado-info';
}

// ── Render de memoria (variables, arreglos y matrices) ────────

function ppBuildForBoxHtml(forCtx) {
    if (!forCtx) return '';
    const val    = forCtx.varValue !== null ? forCtx.varValue : '?';
    const valStr = ppEscape(String(val));
    const varRe         = new RegExp('\\b' + forCtx.varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    const condWithVal   = ppEscape(forCtx.condText.replace(varRe,   String(val)));
    const updateWithVal = ppEscape(forCtx.updateText.replace(varRe, String(val)));
    let condBadge = '';
    if (forCtx.condResult !== null) {
        const yes = forCtx.condResult;
        condBadge = '<span class="sim-for-badge ' + (yes ? 'sim-for-t' : 'sim-for-f') + '">' +
            (yes ? 'verdadero' : 'falso') + '</span>';
    }
    return '<div class="sim-for-panel">' +
        '<div class="sim-for-header">⟳ ciclo <b>for</b></div>' +
        '<div class="sim-for-parts">' +
            '<div class="sim-for-part">' +
                '<div class="sim-for-label">inicializador</div>' +
                '<code class="sim-for-code">' + ppEscape(forCtx.varName) + ' = <b class="sim-for-t">' + valStr + '</b></code>' +
            '</div>' +
            '<div class="sim-for-part">' +
                '<div class="sim-for-label">condición</div>' +
                '<code class="sim-for-code">' + condWithVal + '</code>' +
                (condBadge ? '<div class="sim-for-now">' + condBadge + '</div>' : '') +
            '</div>' +
            '<div class="sim-for-part">' +
                '<div class="sim-for-label">avance</div>' +
                '<code class="sim-for-code">' + updateWithVal + '</code>' +
            '</div>' +
        '</div>' +
    '</div>';
}

function ppBuildMemoriaHtml(state) {
    const ch = new Set(state.changed || []);
    const rd = new Set(state.read || []);
    let html = ppBuildForBoxHtml(state.forCtx);

    if (state.variables && state.variables.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
        state.variables.forEach(v => {
            const f = ppFmtVal(v.value, v.type);
            const changed = ch.has(v.name);
            html += '<div class="cs-var-row' + (changed ? ' cs-flash' : '') + '">' +
                ppEscape(v.type) + ' <b>' + ppEscape(v.name) + '</b> = ' + ppEscape(f.text) + '</div>';
        });
        html += '</div>';
    }

    if (state.arrays && state.arrays.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Arreglos<span class="n">' + state.arrays.length + '</span></div>';
        state.arrays.forEach(a => {
            html += '<div class="cs-arr"><div class="cs-arr-name">' + ppEscape(a.type) + '[] <b>' + ppEscape(a.name) + '</b><span class="meta">.Length = ' + a.length + '</span></div>';
            html += '<div class="cs-cells">';
            for (let i = 0; i < a.length; i++) {
                const val   = a.values[i];
                const isch  = ch.has(a.name + '[' + i + ']');
                const isrd  = !isch && rd.has(a.name + '[' + i + ']');
                const extra = isch ? ' cs-flash' : (isrd ? ' cs-read' : '');
                html += '<div class="cs-cell-wrap">' +
                    '<div class="cs-cell-idx' + (isrd ? ' cs-read-idx' : '') + '">' + i + '</div>' +
                    '<div class="cs-cell' + (val === null ? ' cs-null' : '') + extra + '">' + ppEscape(ppCellText(val)) + '</div>' +
                    '</div>';
            }
            html += '</div></div>';
        });
        html += '</div>';
    }

    if (state.matrices && state.matrices.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Matrices<span class="n">' + state.matrices.length + '</span></div>';
        state.matrices.forEach(m => {
            html += '<div class="cs-mtx"><div class="cs-mtx-name">' + ppEscape(m.type) + '[,] <b>' + ppEscape(m.name) + '</b><span class="meta">' + m.rows + ' × ' + m.cols + '</span></div>';
            html += '<table class="cs-mtx-table"><tr><th></th>';
            for (let c = 0; c < m.cols; c++) html += '<th>C' + c + '</th>';
            html += '</tr>';
            for (let r = 0; r < m.rows; r++) {
                html += '<tr><th>F' + r + '</th>';
                for (let c = 0; c < m.cols; c++) {
                    const val   = m.values[r][c];
                    const key   = m.name + '[' + r + ',' + c + ']';
                    const isch  = ch.has(key);
                    const isrd  = !isch && rd.has(key);
                    const extra = isch ? ' cs-flash' : (isrd ? ' cs-read' : '');
                    html += '<td><div class="cs-mcell' + (val === null ? ' cs-null' : '') + extra + '">' + ppEscape(ppCellText(val)) + '</div></td>';
                }
                html += '</tr>';
            }
            html += '</table></div>';
        });
        html += '</div>';
    }

    if (!html) html = '<div class="cs-empty-hint">Aún no hay datos en memoria en este paso.</div>';
    return html;
}

function ppRender(state, info) {
    if (!state) { ppClearPanels(); return; }
    ppHighlightLine(state.currentLine, state.isError);

    const panelPaso = document.getElementById('panel-paso');
    if (panelPaso) {
        const src = (ppMonacoEditor && state.currentLine)
            ? ppEscape(ppMonacoEditor.getModel().getLineContent(state.currentLine).trim())
            : '';
        panelPaso.innerHTML =
            (state.currentLine ? '<div class="cs-step-line">Línea ' + state.currentLine + ': ' + src + '</div>' : '') +
            '<div class="cs-step-note' + (state.isError ? ' iserr' : '') + '">' + ppEscape(state.description || '') + '</div>';
    }

    const panelVars = document.getElementById('panel-vars');
    if (panelVars) panelVars.innerHTML = ppBuildMemoriaHtml(state);

    const panelSalida = document.getElementById('panel-salida');
    if (panelSalida) panelSalida.textContent = (state.output || []).join('\n');

    if (info && info.total > 0) {
        const stepEl = document.querySelector('.ctrl-step');
        if (stepEl) stepEl.textContent = 'Paso ' + (info.index + 1) + ' / ' + info.total;
        const fill = document.querySelector('.pbar i');
        if (fill) fill.style.width = ((info.index + 1) / info.total * 100) + '%';
    }
}

function ppHighlightLine(line, isError) {
    if (!ppMonacoEditor) return;
    if (!line || line < 1) { ppDecorations = ppMonacoEditor.deltaDecorations(ppDecorations, []); return; }
    const cls = isError ? 'cs-line-error' : 'cs-line-active';
    ppDecorations = ppMonacoEditor.deltaDecorations(ppDecorations, [{
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: cls }
    }]);
    ppMonacoEditor.revealLineInCenter(line);
}

function ppClearPanels() {
    if (ppMonacoEditor) ppDecorations = ppMonacoEditor.deltaDecorations(ppDecorations, []);
    const panelPaso   = document.getElementById('panel-paso');
    const panelVars   = document.getElementById('panel-vars');
    const panelSalida = document.getElementById('panel-salida');
    const stepEl      = document.querySelector('.ctrl-step');
    const fill        = document.querySelector('.pbar i');
    if (panelPaso)   panelPaso.innerHTML    = '';
    if (panelVars)   panelVars.innerHTML    = '';
    if (panelSalida) panelSalida.textContent = '';
    if (stepEl)      stepEl.textContent     = 'Paso 0 / 0';
    if (fill)        fill.style.width       = '0%';
}

// ── Navegación lineal (selector "Ejercicio N de M") ────────────

function ppAplicarItem(it) {
    ppItemActual = it;
    ppLineasEditablesActual = it.lineasEditables;
    ppCurrentCode = it.codigo;
    ppUltimoCodigoValido = it.codigo;
    ppSetDescripcion(
        (it.subtemaTitulo ? '<div class="pp-ejercicio-meta">Tema: <b>' + ppEscape(it.subtemaTitulo) + '</b></div>' : '') +
        (it.enunciado || ''),
        true
    );
    ppOcultarResultado();
}

// Solo se puede navegar entre 0 y currentIndex del grupo activo (el primer
// no resuelto DE ESE MÓDULO): retroceder para revisar está permitido,
// adelantarse no.
function ppIrA(idx) {
    const grupo = ppGrupoActual();
    if (!grupo) return;
    if (idx < 0 || idx > grupo.currentIndex || idx >= grupo.items.length) return;
    grupo.viewIndex = idx;
    const it = grupo.items[idx];
    ppAplicarItem(it);
    if (ppMonacoEditor) ppMonacoEditor.setValue(it.codigo);
    // El resaltado en rojo de las líneas editables no se muestra de entrada
    // en cada ejercicio — se revela solo al pedir la pista (ppMostrarPista).
    ppResaltarLineasEditables([]);
    ppEjecutar(it.codigo);
    ppRenderStepper();
}

// Cambia de módulo (pestaña de categoría) y muestra su ejercicio actual.
function ppIrAGrupo(grupoIdx) {
    if (grupoIdx < 0 || grupoIdx >= ppGroups.length || grupoIdx === ppGroupIndex) return;
    ppGroupIndex = grupoIdx;
    const grupo = ppGrupoActual();
    ppRenderGrupos();
    ppIrA(grupo.viewIndex);
}

// Progreso GLOBAL (todos los módulos/temas combinados) para el contador
// "Ejercicio N de M" de arriba: el alumno pidió que ese número no dependa
// de en qué tema esté parado, a diferencia de las pestañas "Ciclos 1/12",
// etc., que sí siguen siendo por tema.
function ppProgresoGlobal() {
    const grupo = ppGrupoActual();
    const total = ppGroups.reduce((sum, g) => sum + g.items.length, 0);
    const resueltos = ppGroups.reduce((sum, g) => sum + g.items.filter(x => x.resuelto).length, 0);
    if (!grupo) return { n: 0, total, resueltos };

    const it = grupo.items[grupo.viewIndex];
    let n;
    if (it.resuelto) {
        // Resueltos de los módulos anteriores + resueltos de este módulo hasta el actual (inclusive)
        n = 0;
        for (const g of ppGroups) {
            if (g === grupo) {
                n += g.items.slice(0, grupo.viewIndex + 1).filter(x => x.resuelto).length;
                break;
            }
            n += g.items.filter(x => x.resuelto).length;
        }
    } else {
        n = resueltos + 1;
    }
    return { n, total, resueltos };
}

function ppRenderStepper() {
    const grupo = ppGrupoActual();
    const label = document.getElementById('pp-step-label');
    const prevBtn = document.getElementById('pp-ejercicio-prev');
    const nextBtn = document.getElementById('pp-ejercicio-next');
    const fill = document.getElementById('pp-stepper-fill');
    if (!grupo) return;
    const { n, total, resueltos } = ppProgresoGlobal();
    if (label) label.textContent = 'Ejercicio ' + n + ' de ' + total;
    if (prevBtn) prevBtn.disabled = (grupo.viewIndex <= 0);
    if (nextBtn) nextBtn.disabled = (grupo.viewIndex >= grupo.currentIndex);
    if (fill) {
        const pct = total ? Math.round((resueltos / total) * 100) : 0;
        fill.style.width = pct + '%';
    }
}

// Pestañas de módulo/categoría — una por grupo, con su progreso "X/Y".
function ppRenderGrupos() {
    let tabs = document.getElementById('pp-grupos');
    const editorBody = document.getElementById('editor-body');
    if (!tabs) {
        if (!editorBody || ppGroups.length < 2) return;
        tabs = document.createElement('div');
        tabs.id = 'pp-grupos';
        tabs.className = 'pp-grupos';
        editorBody.parentNode.insertBefore(tabs, editorBody);
    }
    tabs.innerHTML = ppGroups.map((g, i) => {
        const resueltos = g.items.filter(it => it.resuelto).length;
        const completo = resueltos === g.items.length;
        return '<button class="pp-grupo-tab' + (i === ppGroupIndex ? ' activo' : '') + (completo ? ' completo' : '') +
            '" data-idx="' + i + '">' + ppEscape(g.categoria) +
            '<span class="n">' + resueltos + '/' + g.items.length + '</span></button>';
    }).join('');
    tabs.querySelectorAll('.pp-grupo-tab').forEach(btn => {
        btn.onclick = () => { ppStopPlay(_ppBtns()); ppIrAGrupo(parseInt(btn.dataset.idx)); };
    });
}

// ── Inicialización del editor (async) ──────────────────────────

async function initPonteApruebaSimulator(nombreTema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    ppSetTitulo('Ponte a prueba');

    let grupos;
    try {
        const practicas = await ppObtenerPracticas(); // [{ categoria_id, categoria, ejercicios: [...] }, ...]
        grupos = practicas
            .filter(g => Array.isArray(g.ejercicios) && g.ejercicios.length)
            .map(g => {
                const items = g.ejercicios.map((ej, i) => ({
                    id: ej.id,
                    label: 'Ejercicio ' + (i + 1),
                    codigo: ej.codigo_con_errores || '',
                    enunciado: ej.descripcion || '',
                    subtemaTitulo: (ej.subtemas && ej.subtemas.titulo) || '',
                    lineasEditables: (ej.soluciones_validacion && ej.soluciones_validacion.lineas_editables) || [],
                    pista: (ej.soluciones_validacion && ej.soluciones_validacion.pista) || '',
                    resuelto: !!ej.resuelto,
                }));
                let currentIndex = items.findIndex(it => !it.resuelto);
                if (currentIndex === -1) currentIndex = items.length - 1; // ya resolvió todo el módulo
                return { categoriaId: g.categoria_id, categoria: g.categoria, items, currentIndex, viewIndex: currentIndex };
            });
        ppMostrarErrorApi(null);
    } catch (e) {
        console.error('Error cargando "Ponte a prueba":', e);
        grupos = [];
        ppMostrarErrorApi('No se pudieron cargar los ejercicios de práctica.');
    }

    if (!grupos.length) {
        grupos = [{
            categoriaId: 0, categoria: 'Ponte a prueba',
            items: [{
                id: null, label: 'Sin ejercicios',
                codigo: '// Todavía no hay ejercicios de práctica cargados.',
                enunciado: '', subtemaTitulo: '', lineasEditables: [], pista: '', resuelto: false
            }],
            currentIndex: 0, viewIndex: 0
        }];
    }

    ppGroups = grupos;
    // Arranca en el primer módulo que todavía tenga pendientes; si ya
    // resolvió todo, se queda en el primero.
    ppGroupIndex = grupos.findIndex(g => g.items.some(it => !it.resuelto));
    if (ppGroupIndex === -1) ppGroupIndex = 0;
    const grupoInicial = ppGrupoActual();

    if (!document.getElementById('pp-stepper')) {
        // Ya no lleva flechas — solo el contador. La navegación entre
        // ejercicios se hizo con botones propios en la barra de abajo
        // (ver "Ejercicio anterior"/"Siguiente ejercicio" en ppConectarBotones).
        const stepper = document.createElement('div');
        stepper.id = 'pp-stepper';
        stepper.className = 'pp-stepper';
        stepper.innerHTML = '<span class="pp-stepper__label" id="pp-step-label"></span>';
        editorBody.parentNode.insertBefore(stepper, editorBody);

        const bar = document.createElement('div');
        bar.className = 'pp-stepper__bar';
        bar.innerHTML = '<i id="pp-stepper-fill"></i>';
        editorBody.parentNode.insertBefore(bar, editorBody);
    }

    ppRenderGrupos();
    ppAplicarItem(grupoInicial.items[grupoInicial.viewIndex]);
    ppRenderStepper();

    function crearEditor() {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            ppMonacoEditor = monaco.editor.create(editorBody, {
                value: grupoInicial.items[grupoInicial.viewIndex].codigo,
                language: 'csharp',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                readOnly: false
            });
            ppMonacoEditor.onDidChangeModelContent(ppOnEditorChange);
            ppConectarBotones();
            ppEjecutar(grupoInicial.items[grupoInicial.viewIndex].codigo);
        });
    }

    if (window.monaco) {
        crearEditor();
    } else if (window.require) {
        crearEditor();
    } else {
        const loader = document.createElement('script');
        loader.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.js';
        loader.onload = crearEditor;
        document.head.appendChild(loader);
    }
}

// ── Auto-reproducción ─────────────────────────────────────────

function ppGetDelay() {
    const slider = document.getElementById('pp-speed-slider');
    const val = slider ? parseInt(slider.value) : 40;
    return Math.round(2000 - (val / 100) * 1800);
}

function ppStopPlay(btns) {
    clearTimeout(ppPlayTimer);
    ppPlayTimer = null;
    ppPlaying   = false;
    const list = btns || _ppBtns();
    if (list[3]) list[3].innerHTML = _PP_ICON_PLAY;
}

// onDone (opcional) se dispara una sola vez, justo al llegar al último
// paso que se pudo ejecutar — lo usa ppComprobarSolucion para no pintar
// el veredicto hasta que la animación termina.
function ppAutoPlay(btns, onDone) {
    const info = ppSim.info();
    if (info.index >= info.total - 1) {
        ppStopPlay(btns);
        if (onDone) onDone();
        return;
    }
    const state = ppSim.next();
    ppRender(state, ppSim.info());
    if (btns[1]) btns[1].disabled = (ppSim.info().index <= 0);
    ppPlayTimer = setTimeout(() => ppAutoPlay(btns, onDone), ppGetDelay());
}

// ── Conexión de botones ───────────────────────────────────────

function ppConectarBotones() {
    const btns = _ppBtns();

    // "Volver al inicio" (texto del skeleton compartido) confunde aquí: no
    // navega a ningún lado, solo vuelve a ejecutar el código actual desde
    // el paso 1. Se renombra a algo que describa lo que realmente hace.
    if (btns[0]) {
        btns[0].textContent = 'Reiniciar ejercicio';
        btns[0].onclick = () => {
            ppStopPlay(btns);
            const codigoActual = ppMonacoEditor ? ppMonacoEditor.getValue() : ppCurrentCode;
            ppEjecutar(codigoActual);
        };
    }

    // Reemplazan a las flechas que antes vivían junto al contador de arriba
    // (ver el bloque de "pp-stepper" más abajo) — misma función, nueva
    // ubicación, para no repetir la navegación de ejercicios dos veces.
    const controlsEl = document.querySelector('.editor-controls');
    if (controlsEl && btns[1] && !document.getElementById('pp-ejercicio-prev')) {
        const prevEj = document.createElement('button');
        prevEj.className = 'ctrl-btn';
        prevEj.id = 'pp-ejercicio-prev';
        prevEj.textContent = 'Ejercicio anterior';
        prevEj.onclick = () => { ppStopPlay(_ppBtns()); ppIrA(ppGrupoActual().viewIndex - 1); };
        controlsEl.insertBefore(prevEj, btns[1]);

        const nextEj = document.createElement('button');
        nextEj.className = 'ctrl-btn';
        nextEj.id = 'pp-ejercicio-next';
        nextEj.textContent = 'Siguiente ejercicio';
        nextEj.onclick = () => { ppStopPlay(_ppBtns()); ppIrA(ppGrupoActual().viewIndex + 1); };
        controlsEl.insertBefore(nextEj, btns[1]);

        ppRenderStepper();
    }

    if (btns[1]) {
        btns[1].disabled = true;
        btns[1].onclick = () => {
            ppStopPlay(btns);
            const state = ppSim.prev();
            ppRender(state, ppSim.info());
            btns[1].disabled = (ppSim.info().index <= 0);
        };
    }

    if (btns[2]) btns[2].onclick = () => {
        ppStopPlay(btns);
        const state = ppSim.next();
        ppRender(state, ppSim.info());
        if (btns[1]) btns[1].disabled = (ppSim.info().index <= 0);
    };

    // btns[3] era el botón "Reproducir" del skeleton compartido
    // (consolas.js). Aquí conserva el ícono play/pausa, pero el tooltip se
    // queda en "Comprobar": el mismo botón reproduce la ejecución paso a
    // paso Y valida contra el backend a la vez (ver ppComprobarSolucion).
    if (btns[3]) {
        btns[3].innerHTML = _PP_ICON_PLAY;
        btns[3].onclick = ppComprobarSolucion;
    }

    const controls = document.querySelector('.editor-controls');

    // "Pista" va en la misma fila que Comprobar, justo antes — prev/anterior
    // y siguiente se conservan tal cual, sin tocarlos.
    if (controls && btns[3] && !document.getElementById('pp-btn-pista')) {
        const pista = document.createElement('button');
        pista.className = 'ctrl-btn';
        pista.id = 'pp-btn-pista';
        pista.textContent = 'Pista';
        pista.onclick = ppMostrarPista;
        controls.insertBefore(pista, btns[3]);
    }
    if (controls && !document.getElementById('pp-speed-slider')) {
        const speedRow = document.createElement('div');
        speedRow.className = 'sim-speed-row';
        speedRow.innerHTML =
            '<label>Velocidad</label>' +
            '<input type="range" id="pp-speed-slider" min="1" max="100" value="40">' +
            '<span class="sim-speed-val" id="pp-speed-val">1×</span>';
        controls.appendChild(speedRow);

        const slider = document.getElementById('pp-speed-slider');
        const valLbl = document.getElementById('pp-speed-val');
        slider.addEventListener('input', () => {
            valLbl.textContent = (parseFloat(slider.value) / 40).toFixed(1) + '×';
        });
    }

}

// ── Hook a cargarTema ─────────────────────────────────────────

(function () {
    const _cargarTema = window.cargarTema;
    window.cargarTema = function (nombreTema) {
        ppStopPlay(null);
        if (ppMonacoEditor) {
            ppMonacoEditor.dispose();
            ppMonacoEditor = null;
            ppDecorations  = [];
            ppEditableDecorations = [];
        }
        ppSim.clear();
        ppOcultarResultado();

        if (typeof _cargarTema === 'function') _cargarTema(nombreTema);

        if (nombreTema === 'Ponte_a_prueba') {
            setTimeout(() => initPonteApruebaSimulator(nombreTema), 0);
        }
    };
})();
