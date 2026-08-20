// Console for the "Ponte a prueba" section: loads buggy exercises from the practice bank, lets the student fix only the editable lines, and validates the result against the backend.

// Injects the CSS used by this panel

(function injectPpStyles() {
    if (document.getElementById('pp-styles')) return;
    const style = document.createElement('style');
    style.id = 'pp-styles';
    style.textContent = `
        .pp-line-editable { background: rgba(224,82,99,0.15); }
        .pp-line-editable-gutter { border-left: 3px solid #e05263; }
        .pp-ejercicio-meta { font-size: 0.95em; opacity: .75; margin-bottom: 4px; }
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
        /* Categoría 100% resuelta: naranja SIEMPRE, incluso si es la que
           tienes abierta ahora mismo — antes ":not(.activo)" la ocultaba
           justo cuando terminabas el último ejercicio de esa categoría. */
        .pp-grupo-tab.completo { border-color: #ff9f43; color: #ff9f43; }
        .pp-grupo-tab.completo.activo { background: #ff9f43; border-color: #ff9f43; color: #08131a; }
        .pp-grupo-tab.completo .n { background: rgba(0,0,0,0.2); }
        .pp-grupo-tab.completo.activo .n { background: rgba(0,0,0,0.15); }
    `;
    document.head.appendChild(style);
})();

// Utility helpers

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

// Tracks the list of execution snapshots and the current position within them

class PpSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset()  { this.snaps = []; this.idx = -1; }
    load(snapshots) { this.snaps = snapshots || []; this.idx = this.snaps.length ? 0 : -1; }
    current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next()  { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev()  { if (this.idx > 0) this.idx--; return this.current(); }
    total() { return this.snaps.length; }
}

// Runs a piece of code through CSharpEngine and exposes step-by-step navigation

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

// API connection: fetches the global bank of exercises with modo='practica'

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

// Sets the page title separately, since the description element is reused for the exercise statement
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

// Result box shared by the validation verdict and the hint display

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
    // clears any in-progress "Comprobar" run so a stale verdict can't resurface later
    ppComprobarEnCurso = false;
    ppOnDoneComprobar = null;
    ppComprobarCodigoActivo = null;
}

// Module-wide state

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
// tracks whether a "Comprobar" run is active, so a click can pause/resume it instead of restarting
let ppComprobarEnCurso = false;
let ppOnDoneComprobar = null;
let ppComprobarCodigoActivo = null;

// play/pause icon markup for the combined Comprobar/play button
const _PP_ICON_PLAY  = '<img src="../img/iconos/play.png" alt="Comprobar"><span class="tooltip-text">Comprobar</span>';
const _PP_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Comprobar"><span class="tooltip-text">Comprobar</span>';

// Per-module exercise groups: each group tracks its own linear progress (currentIndex/viewIndex)
let ppGroups = [];
let ppGroupIndex = 0;

function ppGrupoActual() { return ppGroups[ppGroupIndex] || null; }

// Restricts editing to the lines marked as editable

function ppEsEdicionValida(nuevo, anterior, lineasPermitidas) {
    if (!lineasPermitidas || !lineasPermitidas.length) return true;
    const nuevas = nuevo.split('\n');
    const viejas = anterior.split('\n');
    if (nuevas.length !== viejas.length) return false;
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

// Runs the given code and refreshes all the display panels

function ppEjecutar(codigo) {
    const first = ppSim.load(codigo);
    ppRender(first, ppSim.info());
    const btns = _ppBtns();
    if (btns[1]) btns[1].disabled = true;
    ppPlaying = false;
}

// Plays back the execution step by step and shows the backend verdict only once playback finishes; the same button pauses/resumes an in-progress run
function ppComprobarSolucion() {
    if (!ppItemActual || !ppItemActual.id || !ppMonacoEditor) return;
    const btns = _ppBtns();

    if (ppPlaying) { ppStopPlay(btns); return; }

    const codigo = ppMonacoEditor.getValue();

    if (!ppComprobarEnCurso || codigo !== ppComprobarCodigoActivo) {
        // cold start: code changed since last run, so restart from step 0 and trigger validation
        ppOcultarResultado();
        ppEjecutar(codigo);

        // fires the backend call now, but the verdict is held until ppMostrarVeredicto shows it
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
        // nothing to animate (e.g. a compile error on step 0): show the verdict as soon as it arrives
        dispararSiTermino();
    }
}

// Runs the code and checks its output against the backend; returns the verdict without displaying it
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
                // primeraVez comes from the backend, so retrying a solved exercise doesn't re-award progress
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
        // invalidates the cache so the next tab load re-fetches solved state from the backend
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

    // advances to the next exercise within the same module after a short delay, once solved
    setTimeout(() => {
        const grupo = ppGrupoActual();
        if (!grupo || ppItemActual !== grupo.items[grupo.viewIndex]) return;
        if (grupo.viewIndex + 1 < grupo.items.length) {
            ppStopPlay(_ppBtns());
            ppIrA(grupo.viewIndex + 1);
        }
    }, 2000);
}

// Reveals the editable-line highlight and shows the exercise hint text
function ppMostrarPista() {
    const caja = ppResultadoBox();
    ppResaltarLineasEditables(ppLineasEditablesActual);
    if (!ppItemActual || !ppItemActual.pista) {
        caja.textContent = 'Este ejercicio no tiene pista disponible.';
        caja.className = 'pp-resultado pp-resultado-info';
        return;
    }
    caja.textContent = ppItemActual.pista;
    caja.className = 'pp-resultado pp-resultado-info';
}

// Renders memory state: variables, arrays and matrices

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

// Matches a simple "x = a + b" or "x = a * b" assignment line, to show the operands instead of just the result
const PP_BINOP_LINE_RE = /^(?:int|double|float|string|bool|char)?\s*([A-Za-z_]\w*)\s*=\s*(\w+)\s*([+*])\s*(\w+)\s*;?$/;

// Formats a matched binary-operation line as "a + b = value"
function ppDesglosarBinop(match, val) {
    if (!match) return null;
    const simbolo = match[3] === '*' ? '×' : match[3];
    return ppEscape(match[2]) + ' ' + simbolo + ' ' + ppEscape(match[4]) + ' = ' + ppEscape(val);
}

function ppBuildMemoriaHtml(state) {
    const ch = new Set(state.changed || []);
    const rd = new Set(state.read || []);
    let html = ppBuildForBoxHtml(state.forCtx);

    const lineaActual = (ppMonacoEditor && state.currentLine)
        ? ppMonacoEditor.getModel().getLineContent(state.currentLine).trim()
        : '';
    const binopMatch = lineaActual.match(PP_BINOP_LINE_RE);

    if (state.variables && state.variables.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
        state.variables.forEach(v => {
            const f = ppFmtVal(v.value, v.type);
            const changed = ch.has(v.name);
            const desglose = (changed && binopMatch && binopMatch[1] === v.name) ? ppDesglosarBinop(binopMatch, f.text) : null;
            html += '<div class="cs-var-row' + (changed ? ' cs-flash' : '') + '">' +
                ppEscape(v.type) + ' <b>' + ppEscape(v.name) + '</b> = ' + (desglose || ppEscape(f.text)) + '</div>';
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

// Linear navigation between exercises ("Exercise N of M")

function ppAplicarItem(it) {
    ppItemActual = it;
    ppLineasEditablesActual = it.lineasEditables;
    ppCurrentCode = it.codigo;
    ppUltimoCodigoValido = it.codigo;
    ppSetDescripcion(
        (it.titulo ? '<div class="pp-ejercicio-meta">Titulo: <b>' + ppEscape(it.titulo) + '</b></div>' : '') +
        (it.subtemaTitulo ? '<div class="pp-ejercicio-meta">Tema: <b>' + ppEscape(it.subtemaTitulo) + '</b></div>' : '') +
        (it.enunciado || ''),
        true
    );
    ppOcultarResultado();
}

// Navigates to exercise idx within the active group; only allows going back to review, not skipping ahead unsolved
function ppIrA(idx) {
    const grupo = ppGrupoActual();
    if (!grupo) return;
    if (idx < 0 || idx > grupo.currentIndex || idx >= grupo.items.length) return;
    grupo.viewIndex = idx;
    const it = grupo.items[idx];
    ppAplicarItem(it);
    if (ppMonacoEditor) ppMonacoEditor.setValue(it.codigo);
    // editable-line highlight starts hidden; ppMostrarPista reveals it when the hint is requested
    ppResaltarLineasEditables([]);
    ppEjecutar(it.codigo);
    ppRenderStepper();
}

// Switches the active module tab and shows its current exercise
function ppIrAGrupo(grupoIdx) {
    if (grupoIdx < 0 || grupoIdx >= ppGroups.length || grupoIdx === ppGroupIndex) return;
    ppGroupIndex = grupoIdx;
    const grupo = ppGrupoActual();
    ppRenderGrupos();
    ppIrA(grupo.viewIndex);
}

// Computes progress across all modules combined, for the top "Exercise N of M" counter
function ppProgresoGlobal() {
    const grupo = ppGrupoActual();
    const total = ppGroups.reduce((sum, g) => sum + g.items.length, 0);
    const resueltos = ppGroups.reduce((sum, g) => sum + g.items.filter(x => x.resuelto).length, 0);
    if (!grupo) return { n: 0, total, resueltos };

    const it = grupo.items[grupo.viewIndex];
    let n;
    if (it.resuelto) {
        // sums solved exercises from earlier modules plus solved ones in this module up to the current one
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

// Renders one tab per module group, showing its "solved/total" progress
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

// Loads the exercise bank from the API and sets up the Monaco editor
async function initPonteApruebaSimulator(nombreTema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    ppSetTitulo('Ponte a prueba');

    let grupos;
    try {
        const practicas = await ppObtenerPracticas();
        grupos = practicas
            .filter(g => Array.isArray(g.ejercicios) && g.ejercicios.length)
            .map(g => {
                const items = g.ejercicios.map((ej, i) => ({
                    id: ej.id,
                    label: 'Ejercicio ' + (i + 1),
                    titulo: ej.titulo || 'Ejercicio ' + (i + 1),
                    codigo: ej.codigo_con_errores || '',
                    enunciado: ej.descripcion || '',
                    subtemaTitulo: (ej.subtemas && ej.subtemas.titulo) || '',
                    lineasEditables: (ej.soluciones_validacion && ej.soluciones_validacion.lineas_editables) || [],
                    pista: (ej.soluciones_validacion && ej.soluciones_validacion.pista) || '',
                    resuelto: !!ej.resuelto,
                }));
                let currentIndex = items.findIndex(it => !it.resuelto);
                if (currentIndex === -1) currentIndex = items.length - 1;
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
    // starts on the first module with pending exercises, or the first module if all are solved
    ppGroupIndex = grupos.findIndex(g => g.items.some(it => !it.resuelto));
    if (ppGroupIndex === -1) ppGroupIndex = 0;
    const grupoInicial = ppGrupoActual();

    if (!document.getElementById('pp-stepper')) {
        // builds the stepper counter element; actual navigation is wired up in ppConectarBotones
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

// Automatic playback controls

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

// Advances one step at a time on a timer; onDone fires once when the last step is reached
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

// Wires up the editor control buttons
function ppConectarBotones() {
    const btns = _ppBtns();

    // relabels the shared "restart" button, since here it just re-runs the current code from step 1
    if (btns[0]) {
        btns[0].textContent = 'Reiniciar ejercicio';
        btns[0].onclick = () => {
            ppStopPlay(btns);
            const codigoActual = ppMonacoEditor ? ppMonacoEditor.getValue() : ppCurrentCode;
            ppEjecutar(codigoActual);
        };
    }

    // adds the "previous/next exercise" buttons next to the step controls
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

    // btns[3] is the shared "play" button, repurposed here to both animate and validate (ppComprobarSolucion)
    if (btns[3]) {
        btns[3].innerHTML = _PP_ICON_PLAY;
        btns[3].onclick = ppComprobarSolucion;
    }

    const controls = document.querySelector('.editor-controls');

    // adds the "Pista" (hint) button right before the Comprobar button
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

// Hooks into the shared cargarTema navigation to initialize/teardown this simulator

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
