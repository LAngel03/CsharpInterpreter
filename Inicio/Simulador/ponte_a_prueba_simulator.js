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
        .pp-line-editable { background: rgba(4,170,109,0.15); }
        .pp-line-editable-gutter { border-left: 3px solid #04aa6d; }
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

// ── Progresión lineal del banco de ejercicios ──────────────────
// ppItems: banco completo (con "resuelto" que manda la API, ya filtrado
// por el usuario autenticado). ppCurrentIndex: el primer no resuelto —
// el límite real de avance, recalculado siempre desde el servidor (nunca
// desde localStorage), así que sobrevive a un F5 o a cerrar sesión.
// ppViewIndex: el que se está viendo ahora mismo (puede ser menor que
// ppCurrentIndex si el alumno retrocedió a revisar uno ya resuelto).
let ppItems = [];
let ppCurrentIndex = 0;
let ppViewIndex = 0;

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
// más rápido que la animación. Este botón sustituye al viejo
// "Reproducir" (ver ppConectarBotones).

function ppComprobarSolucion() {
    if (!ppItemActual || !ppItemActual.id || !ppMonacoEditor) return;
    const btns = _ppBtns();
    ppStopPlay(btns);
    const codigo = ppMonacoEditor.getValue();

    ppOcultarResultado();
    ppEjecutar(codigo);

    // La llamada al backend se lanza ya (por la latencia de red), pero
    // el resultado se guarda y no se muestra hasta ppMostrarVeredicto().
    const veredictoPromise = ppValidarConBackend(codigo);
    const mostrarAlTerminar = () => { veredictoPromise.then(ppMostrarVeredicto); };

    if (ppSim.info().total > 1) {
        ppPlaying = true;
        ppPlayTimer = setTimeout(() => ppAutoPlay(btns, mostrarAlTerminar), ppGetDelay());
    } else {
        // Nada que animar (p. ej. error de compilación en el paso 0):
        // el veredicto se muestra en cuanto la validación responda.
        mostrarAlTerminar();
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
                texto: '¡Correcto! +' + veredicto.puntos + ' puntos',
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
        ppCurrentIndex = ppItems.findIndex(it => !it.resuelto);
        if (ppCurrentIndex === -1) ppCurrentIndex = ppItems.length - 1;
        ppRenderStepper();
        if (typeof window.actualizarProgresoUsuario === 'function') window.actualizarProgresoUsuario();
    }
}

function ppMostrarPista() {
    const caja = ppResultadoBox();
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

// Solo se puede navegar entre 0 y ppCurrentIndex (el primer no resuelto):
// retroceder para revisar está permitido, adelantarse no.
function ppIrA(idx) {
    if (idx < 0 || idx > ppCurrentIndex || idx >= ppItems.length) return;
    ppViewIndex = idx;
    const it = ppItems[idx];
    ppAplicarItem(it);
    if (ppMonacoEditor) ppMonacoEditor.setValue(it.codigo);
    ppResaltarLineasEditables(it.lineasEditables);
    ppEjecutar(it.codigo);
    ppRenderStepper();
}

// Número a mostrar para el ejercicio en idx — NO es su posición en el
// arreglo (esa cambia cada vez que el banco crece y se vuelve a mezclar),
// sino su lugar real entre los resueltos: si ya está resuelto, cuántos
// resueltos hay hasta su posición inclusive; si es el actual (sin resolver),
// el conteo total de resueltos + 1. Así siempre coincide con lo que cuenta
// el backend (usuarios.ejercicios_resueltos), sin importar cómo se haya
// reordenado el banco para este alumno.
function ppNumeroMostrado(idx) {
    const it = ppItems[idx];
    if (it.resuelto) return ppItems.slice(0, idx + 1).filter(x => x.resuelto).length;
    return ppItems.filter(x => x.resuelto).length + 1;
}

function ppRenderStepper() {
    const label = document.getElementById('pp-step-label');
    const prevBtn = document.getElementById('pp-step-prev');
    const nextBtn = document.getElementById('pp-step-next');
    const fill = document.getElementById('pp-stepper-fill');
    if (label) label.textContent = 'Ejercicio ' + ppNumeroMostrado(ppViewIndex) + ' de ' + ppItems.length;
    if (prevBtn) prevBtn.disabled = (ppViewIndex <= 0);
    if (nextBtn) nextBtn.disabled = (ppViewIndex >= ppCurrentIndex);
    if (fill) {
        const resueltos = ppItems.filter(it => it.resuelto).length;
        const pct = ppItems.length ? Math.round((resueltos / ppItems.length) * 100) : 0;
        fill.style.width = pct + '%';
    }
}

// ── Inicialización del editor (async) ──────────────────────────

async function initPonteApruebaSimulator(nombreTema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    ppSetTitulo('Ponte a prueba');

    let items;
    try {
        const practicas = await ppObtenerPracticas();
        items = practicas.map((ej, i) => ({
            id: ej.id,
            label: 'Ejercicio ' + (i + 1),
            codigo: ej.codigo_con_errores || '',
            enunciado: ej.descripcion || '',
            subtemaTitulo: (ej.subtemas && ej.subtemas.titulo) || '',
            lineasEditables: (ej.soluciones_validacion && ej.soluciones_validacion.lineas_editables) || [],
            pista: (ej.soluciones_validacion && ej.soluciones_validacion.pista) || '',
            resuelto: !!ej.resuelto,
        }));
        ppMostrarErrorApi(null);
    } catch (e) {
        console.error('Error cargando "Ponte a prueba":', e);
        items = [];
        ppMostrarErrorApi('No se pudieron cargar los ejercicios de práctica.');
    }

    if (!items.length) {
        items = [{
            id: null, label: 'Sin ejercicios',
            codigo: '// Todavía no hay ejercicios de práctica cargados.',
            enunciado: '', subtemaTitulo: '', lineasEditables: [], pista: '', resuelto: false
        }];
    }

    ppItems = items;
    // El límite de avance sale siempre de "resuelto" (lo manda la API según
    // el usuario autenticado) — nunca de localStorage, así que un F5, un
    // cambio de pestaña o cerrar sesión y volver a entrar cae en el mismo
    // ejercicio donde el alumno se quedó.
    ppCurrentIndex = items.findIndex(it => !it.resuelto);
    if (ppCurrentIndex === -1) ppCurrentIndex = items.length - 1; // ya resolvió todo el banco
    ppViewIndex = ppCurrentIndex;

    if (!document.getElementById('pp-stepper') && items.length > 1) {
        const stepper = document.createElement('div');
        stepper.id = 'pp-stepper';
        stepper.className = 'pp-stepper';
        stepper.innerHTML =
            '<button class="pp-stepper__arrow" id="pp-step-prev">◀</button>' +
            '<span class="pp-stepper__label" id="pp-step-label"></span>' +
            '<button class="pp-stepper__arrow" id="pp-step-next">▶</button>';
        editorBody.parentNode.insertBefore(stepper, editorBody);

        const bar = document.createElement('div');
        bar.className = 'pp-stepper__bar';
        bar.innerHTML = '<i id="pp-stepper-fill"></i>';
        editorBody.parentNode.insertBefore(bar, editorBody);

        document.getElementById('pp-step-prev').onclick = () => { ppStopPlay(_ppBtns()); ppIrA(ppViewIndex - 1); };
        document.getElementById('pp-step-next').onclick = () => { ppStopPlay(_ppBtns()); ppIrA(ppViewIndex + 1); };
    }

    ppAplicarItem(items[ppViewIndex]);
    ppRenderStepper();

    function crearEditor() {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            ppMonacoEditor = monaco.editor.create(editorBody, {
                value: items[ppViewIndex].codigo,
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
            ppResaltarLineasEditables(items[ppViewIndex].lineasEditables);
            ppEjecutar(items[ppViewIndex].codigo);
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

function ppStopPlay() {
    clearTimeout(ppPlayTimer);
    ppPlayTimer = null;
    ppPlaying   = false;
    // A diferencia de los otros simuladores, aquí btns[3] ya no es un
    // botón play/pausa — es "Comprobar" de forma permanente (ver
    // ppConectarBotones), así que no se le toca el innerHTML al detener.
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

    if (btns[0]) btns[0].onclick = () => {
        ppStopPlay(btns);
        const codigoActual = ppMonacoEditor ? ppMonacoEditor.getValue() : ppCurrentCode;
        ppEjecutar(codigoActual);
    };

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
    // (consolas.js). En esta página no hay reproducción suelta: el mismo
    // botón reproduce la ejecución paso a paso Y valida contra el backend
    // a la vez (ver ppComprobarSolucion). El resto de los simuladores
    // siguen usando el botón original sin tocar — esto es solo un
    // relabel del elemento dentro de esta página.
    if (btns[3]) {
        btns[3].innerHTML = 'Comprobar';
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
