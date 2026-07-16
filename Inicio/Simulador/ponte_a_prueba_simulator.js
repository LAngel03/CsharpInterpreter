// ============================================================
//  Simulador/ponte_a_prueba_simulator.js
//  Consola del apartado "Ponte a prueba": banco de ejercicios de
//  repaso general (sin tema fijo). Usa CSharpEngine como motor,
//  igual que Arreglos/Recursividad/Archivos, así que soporta
//  variables, arreglos, matrices, ciclos, condicionales y archivos.
//
//  CÓMO AGREGAR UN EJERCICIO NUEVO (mientras no venga de la API):
//    Agrega un objeto { enunciado, codigo } al arreglo
//    PP_EJERCICIOS.Ponte_a_prueba, más abajo en este archivo.
//    Cada objeto aparece como una pestaña "Ejercicio N" aparte.
//
//  Si en el backend se registra un subtema con slug "Ponte_a_prueba"
//  y una lista de ejercicios, esos se muestran automáticamente y el
//  respaldo local de este archivo deja de usarse.
// ============================================================

// ── CSS del panel de variables editables ───────────────────────

(function injectPpStyles() {
    if (document.getElementById('pp-styles')) return;
    const style = document.createElement('style');
    style.id = 'pp-styles';
    style.textContent = `
        #pp-vars-editable {
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            padding: 10px 14px;
            margin-bottom: 8px;
            background: #1e2130;
            border: 1px solid #3a3d4a;
            border-radius: 8px;
        }
        #pp-vars-editable:empty { display: none; }
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

const _PP_ICON_PLAY  = '<img src="../img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
const _PP_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

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
//  EJEMPLOS Y EJERCICIOS — RESPALDO local (usado si la API falla
//  o todavía no existe un subtema "Ponte_a_prueba" en el backend)
// ════════════════════════════════════════════════════════════

const PP_EXAMPLES = {
    Ponte_a_prueba: [
`// Bienvenido a "Ponte a prueba"
// Aqui repasaras, con retos combinados, todo lo que ya aprendiste:
// operadores, condicionales, ciclos, arreglos, recursividad y archivos.

string mensaje = "Listo para practicar";
int intentos = 3;

Console.WriteLine(mensaje);
Console.WriteLine("Intentos disponibles: " + intentos);`
    ]
};

// Banco de ejercicios local. Cada elemento se muestra como una pestaña
// "Ejercicio N" independiente. Deja el arreglo vacío mientras no haya
// retos listos; agrega objetos { enunciado, codigo } cuando los tengas.
const PP_EJERCICIOS = {
    Ponte_a_prueba: [
        // { enunciado: 'Enunciado del reto...', codigo: 'int x = 1;' }
    ]
};

// ════════════════════════════════════════════════════════════
//  CONEXIÓN CON LA API (con caché y respaldo local)
// ════════════════════════════════════════════════════════════

const ppCacheSubtemas = {};

function ppNormalizarEjemplos(codigo_ejemplo) {
    if (typeof codigo_ejemplo === 'string') return [codigo_ejemplo];
    if (Array.isArray(codigo_ejemplo)) return codigo_ejemplo;
    if (codigo_ejemplo && typeof codigo_ejemplo === 'object' && Array.isArray(codigo_ejemplo.ejemplos)) {
        return codigo_ejemplo.ejemplos;
    }
    return [];
}

async function ppObtenerDatosTema(slug) {
    if (ppCacheSubtemas[slug]) return ppCacheSubtemas[slug];
    try {
        if (!window.ApiClient || typeof window.ApiClient.obtenerSubtemaPorSlug !== 'function') {
            throw new Error('ApiClient.obtenerSubtemaPorSlug no está disponible');
        }
        const subtema = await window.ApiClient.obtenerSubtemaPorSlug(slug);
        if (!subtema) throw new Error('La API devolvió una respuesta vacía para "' + slug + '"');
        ppCacheSubtemas[slug] = subtema;
        return subtema;
    } catch (e) {
        console.warn(`Ponte a prueba "${slug}" no encontrado en la API, usando respaldo local`, e);
        return {
            definicion: (window.temas && window.temas[slug]) ? window.temas[slug].definicion : '',
            codigo_ejemplo: null,
            ejercicios: null,
            _apiError: e.message
        };
    }
}

function ppGetItemsLocal(tema) {
    const ex = PP_EXAMPLES[tema];
    const ejemplos = Array.isArray(ex) ? ex.slice() : (typeof ex === 'string' ? [ex] : ['']);
    const items = ejemplos.map((code, i) => ({
        label: ejemplos.length > 1 ? 'Ejemplo ' + (i + 1) : 'Ejemplo',
        codigo: code,
        enunciado: null,
        esEjercicio: false
    }));
    const ejercicios = PP_EJERCICIOS[tema] || [];
    ejercicios.forEach((ej, i) => {
        items.push({
            label: ejercicios.length > 1 ? 'Ejercicio ' + (i + 1) : 'Ejercicio',
            codigo: ej.codigo,
            enunciado: ej.enunciado,
            esEjercicio: true
        });
    });
    return items;
}

function ppGetItemsDesdeSubtema(subtema, slug) {
    if (!subtema || subtema.codigo_ejemplo === null || subtema.codigo_ejemplo === undefined) {
        return ppGetItemsLocal(slug);
    }

    const ejemplos = ppNormalizarEjemplos(subtema.codigo_ejemplo);
    if (!ejemplos.length) return ppGetItemsLocal(slug);

    const items = ejemplos.map((code, i) => ({
        label: ejemplos.length > 1 ? 'Ejemplo ' + (i + 1) : 'Ejemplo',
        codigo: code,
        enunciado: null,
        esEjercicio: false
    }));

    const ejercicios = Array.isArray(subtema.ejercicios) ? subtema.ejercicios : [];
    ejercicios.forEach((ej, i) => {
        items.push({
            label: ejercicios.length > 1 ? 'Ejercicio ' + (i + 1) : 'Ejercicio',
            codigo: ej.codigo_csharp,
            enunciado: ej.descripcion,
            esEjercicio: true
        });
    });
    return items;
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

// ── Estado global del módulo ──────────────────────────────────

const ppSim = new PonteApruebaSimulator();
let ppMonacoEditor = null;
let ppDecorations  = [];
let ppPlayTimer    = null;
let ppPlaying      = false;
let ppCurrentCode  = '';
let ppTemaActual   = '';

// ── Variables escalares editables ────────────────────────────

function ppExtraerVariablesEditables(ast) {
    if (!ast || !ast.body) return [];
    return ast.body
        .filter(n => n.type === 'VariableDeclaration' && n.init && n.init.type === 'Literal' && n.init.value !== null)
        .map(n => ({ name: n.name, dataType: n.dataType, raw: n.init.raw, value: n.init.value, line: n.line }));
}

function ppReconstruirCodigo(baseCode, variables, valoresNuevos) {
    const lineas = baseCode.split('\n');
    for (const v of variables) {
        const idx = v.line - 1;
        if (idx < 0 || idx >= lineas.length) continue;
        const nuevoValor = valoresNuevos[v.name];
        let valorFormateado;
        if (v.raw === 'string') {
            valorFormateado = '"' + String(nuevoValor).replace(/"/g, '\\"') + '"';
        } else if (v.raw === 'char') {
            valorFormateado = "'" + String(nuevoValor).charAt(0) + "'";
        } else if (v.raw === 'bool') {
            valorFormateado = (nuevoValor === true || nuevoValor === 'true') ? 'true' : 'false';
        } else {
            const num = parseFloat(nuevoValor);
            valorFormateado = isNaN(num) ? String(v.value) : String(num);
        }
        const regex = new RegExp('^(\\s*' + v.dataType + '\\s+' + v.name + '\\s*=\\s*).*?(;.*)$');
        lineas[idx] = lineas[idx].replace(regex, (_, antes, despues) => antes + valorFormateado + despues);
    }
    return lineas.join('\n');
}

function ppRenderInputsVariables(variables, codigoBase) {
    const host = document.getElementById('pp-vars-editable');
    if (!host) return;

    if (!variables.length) {
        host.innerHTML = '';
        host.dataset.ppVarsSignature = '';
        return;
    }

    const signature = variables.map(v => v.name + ':' + v.dataType).join('|');
    if (host.dataset.ppVarsSignature === signature) return;
    host.dataset.ppVarsSignature = signature;

    host.innerHTML = variables.map(v => {
        const tipoInput = (v.dataType === 'int' || v.dataType === 'double' || v.dataType === 'float' || v.dataType === 'long') ? 'number' : 'text';
        let inputHtml;
        if (v.dataType === 'bool') {
            inputHtml =
                '<select class="arr-var-input" data-var="' + v.name + '">' +
                    '<option value="true"'  + (v.value === true  ? ' selected' : '') + '>true</option>'  +
                    '<option value="false"' + (v.value === false ? ' selected' : '') + '>false</option>' +
                '</select>';
        } else {
            inputHtml =
                '<input class="arr-var-input" type="' + tipoInput + '" data-var="' + v.name + '" value="' + ppEscape(String(v.value)) + '"' +
                (tipoInput === 'number' && v.dataType !== 'int' && v.dataType !== 'long' ? ' step="0.01"' : '') + '>';
        }
        return (
            '<div class="arr-var-field">' +
                '<label>' + ppEscape(v.dataType) + ' ' + ppEscape(v.name) + '</label>' +
                inputHtml +
            '</div>'
        );
    }).join('');

    host.querySelectorAll('.arr-var-input').forEach(input => {
        const evento = input.tagName === 'SELECT' ? 'change' : 'input';
        input.addEventListener(evento, () => {
            const valoresNuevos = {};
            host.querySelectorAll('.arr-var-input').forEach(inp => {
                valoresNuevos[inp.dataset.var] = inp.tagName === 'SELECT' ? (inp.value === 'true') : inp.value;
            });
            const nuevoCodigo = ppReconstruirCodigo(codigoBase, variables, valoresNuevos);
            if (ppMonacoEditor) ppMonacoEditor.setValue(nuevoCodigo);
            ppEjecutarSinTocarInputs(nuevoCodigo);
        });
    });
}

function ppEjecutarSinTocarInputs(codigo) {
    const first = ppSim.load(codigo);
    ppRender(first, ppSim.info());
    const btns = _ppBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { ppPlaying = false; btns[3].innerHTML = _PP_ICON_PLAY; }
}

function ppCargarYEjecutar(codigo) {
    const first    = ppSim.load(codigo);
    const variables = ppExtraerVariablesEditables(ppSim.lastAst);
    ppRenderInputsVariables(variables, codigo);
    ppRender(first, ppSim.info());
    const btns = _ppBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { ppPlaying = false; btns[3].innerHTML = _PP_ICON_PLAY; }
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

// ── Inicialización del editor con sistema de tabs (async) ─────

async function initPonteApruebaSimulator(nombreTema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    ppTemaActual = nombreTema;

    let subtema, items, defOriginal;
    try {
        subtema = await ppObtenerDatosTema(nombreTema);
        items = ppGetItemsDesdeSubtema(subtema, nombreTema);
        defOriginal = subtema.definicion ||
            ((window.temas && window.temas[nombreTema]) ? window.temas[nombreTema].definicion : '');

        // Si aún no existe un subtema "Ponte_a_prueba" en el backend, se usa
        // el respaldo local en silencio (no es un error, es lo esperado).
        ppMostrarErrorApi(null);
    } catch (e) {
        console.error('Error inicializando "Ponte a prueba":', e);
        items = ppGetItemsLocal(nombreTema);
        defOriginal = (window.temas && window.temas[nombreTema]) ? window.temas[nombreTema].definicion : '';
    }

    if (!items || !items.length) {
        items = [{ label: 'Ejemplo', codigo: '// Todavía no hay ejercicios cargados.', enunciado: null, esEjercicio: false }];
    }

    if (!document.getElementById('pp-vars-editable')) {
        const varsHost = document.createElement('div');
        varsHost.id = 'pp-vars-editable';
        editorBody.parentNode.insertBefore(varsHost, editorBody);
    }

    if (!document.getElementById('pp-ejemplos-tabs') && items.length > 1) {
        const tabs = document.createElement('div');
        tabs.id = 'pp-ejemplos-tabs';
        tabs.innerHTML = items.map((it, i) =>
            '<button class="sim-tab' + (i === 0 ? ' activo' : '') +
            (it.esEjercicio ? ' ejercicio' : '') +
            '" data-idx="' + i + '">' + it.label + '</button>'
        ).join('');
        editorBody.parentNode.insertBefore(tabs, editorBody.parentNode.querySelector('#pp-vars-editable'));
    }

    const codigoInicial = items[0].codigo;
    ppCurrentCode = codigoInicial;
    if (items[0].enunciado) ppSetDescripcion(items[0].enunciado, true);
    else ppSetDescripcion(defOriginal, false);

    function activarTabs() {
        const tabs = document.getElementById('pp-ejemplos-tabs');
        if (!tabs) return;
        tabs.querySelectorAll('.sim-tab').forEach(btn => {
            btn.onclick = () => {
                ppStopPlay(_ppBtns());
                const idx = parseInt(btn.dataset.idx);
                const it  = items[idx];

                tabs.querySelectorAll('.sim-tab').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');

                if (it.enunciado) {
                    ppSetDescripcion(it.enunciado, true);
                } else {
                    ppSetDescripcion(defOriginal, false);
                }

                ppCurrentCode = it.codigo;
                if (ppMonacoEditor) ppMonacoEditor.setValue(it.codigo);
                ppCargarYEjecutar(it.codigo);
            };
        });
    }

    function crearEditor() {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            ppMonacoEditor = monaco.editor.create(editorBody, {
                value: codigoInicial,
                language: 'csharp',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                readOnly: true
            });
            ppConectarBotones();
            activarTabs();
            ppCargarYEjecutar(codigoInicial);
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
    const btnR = (btns && btns[3]) ? btns[3] : document.getElementById('btn-reproducir');
    if (btnR) btnR.innerHTML = _PP_ICON_PLAY;
}

function ppAutoPlay(btns) {
    const info = ppSim.info();
    if (info.index >= info.total - 1) { ppStopPlay(btns); return; }
    const state = ppSim.next();
    ppRender(state, ppSim.info());
    if (btns[1]) btns[1].disabled = (ppSim.info().index <= 0);
    ppPlayTimer = setTimeout(() => ppAutoPlay(btns), ppGetDelay());
}

// ── Conexión de botones ───────────────────────────────────────

function ppConectarBotones() {
    const btns = _ppBtns();

    if (btns[0]) btns[0].onclick = () => {
        ppStopPlay(btns);
        const codigoActual = ppMonacoEditor ? ppMonacoEditor.getValue() : ppCurrentCode;
        ppEjecutarSinTocarInputs(codigoActual);
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

    if (btns[3]) btns[3].onclick = () => {
        if (ppPlaying) { ppStopPlay(btns); return; }
        if (ppSim.info().total === 0) {
            const first = ppSim.load(ppMonacoEditor.getValue());
            ppRender(first, ppSim.info());
            if (!first || first.isError) return;
            if (btns[1]) btns[1].disabled = true;
        }
        ppPlaying = true;
        btns[3].innerHTML = _PP_ICON_PAUSE;
        ppPlayTimer = setTimeout(() => ppAutoPlay(btns), ppGetDelay());
    };

    const controls = document.querySelector('.editor-controls');
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
        }
        ppSim.clear();

        if (typeof _cargarTema === 'function') _cargarTema(nombreTema);

        if (nombreTema === 'Ponte_a_prueba') {
            setTimeout(() => initPonteApruebaSimulator(nombreTema), 0);
        }
    };
})();
