// ============================================================
//  Simulador/array_simulator.js
//  Simulador paso a paso para los subtemas "Arreglos unidimensionales"
//  y "Arreglos bidimensionales" (matrices).
//  Se conecta a los paneles del workspace existente (consolas.js),
//  igual que Simulador/simulator.js, pero usa el motor genérico
//  Simulador/engine.js (window.CSharpEngine) que soporta
//  arreglos, matrices y ciclos for/while/do-while internamente.
//
//  El editor Monaco queda en modo solo-lectura. Las variables
//  escalares declaradas con un valor literal en el nivel superior
//  del programa se exponen como inputs editables encima del editor.
//+
// ── Utilidades ───────────────────────────────────────────────

function arrEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function arrFmtVal(v, type) {
    if (v === null || v === undefined) return { text: 'null' };
    if (type === 'bool' || typeof v === 'boolean') return { text: v ? 'true' : 'false' };
    if (type === 'char') return { text: "'" + v + "'" };
    if (type === 'string' || typeof v === 'string') return { text: '"' + v + '"' };
    return { text: String(v) };
}

function arrCellText(v) {
    if (v === null || v === undefined) return '·';
    if (typeof v === 'boolean') return v ? 'T' : 'F';
    return String(v);
}

// ── Iconos del botón reproducir/pausar (igual que simulator.js) ──
const _ARR_ICON_PLAY = '<img src="../img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
const _ARR_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

// ── Botones por ID (compatibles con consolas.js) ────────────────
//  Devuelve SIEMPRE [reiniciar, anterior, siguiente, reproducir].
function _arrBtns() {
    return [
        document.getElementById('btn-reiniciar'),
        document.getElementById('btn-paso-anterior'),
        document.getElementById('btn-paso-siguiente'),
        document.getElementById('btn-reproducir')
    ];
}

// ── SnapshotManager (envuelve los snapshots del motor) ─────────

class ArrSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset() { this.snaps = []; this.idx = -1; }
    load(snapshots) { this.snaps = snapshots || []; this.idx = this.snaps.length ? 0 : -1; }
    current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next() { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev() { if (this.idx > 0) this.idx--; return this.current(); }
    total() { return this.snaps.length; }
}

// ── Simulador (usa CSharpEngine como motor) ─────────────────────

class ArraySimulator {
    constructor() { this.snap = new ArrSnapMgr(); this.lastAst = null; }
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
    next() { return this.snap.next(); }
    prev() { return this.snap.prev(); }
    clear() { this.snap.reset(); this.lastAst = null; }
    info() { return { index: this.snap.idx, total: this.snap.total() }; }
}

// ── Ejemplos de código ──────────────────────────────────────────

const ARR_EXAMPLES = {
    Array_unidimensional:
`int[] numeros = new int[5];

for (int i = 0; i < numeros.Length; i++) {
  numeros[i] = (i + 1) * 10;
}

int suma = 0;
for (int i = 0; i < numeros.Length; i++) {
  suma += numeros[i];
}

Console.WriteLine("Elemento [2] = " + numeros[2]);
Console.WriteLine("Longitud = " + numeros.Length);
Console.WriteLine("Suma total = " + suma);`,

    Array_bidimensional:
`// Llenado y recorrido de una matriz 3x2
int[,] matriz = new int[3,2];

for (int f = 0; f < matriz.GetLength(0); f++) {
  for (int c = 0; c < matriz.GetLength(1); c++) {
    matriz[f,c] = (f + 1) * (c + 1);
  }
}

Console.WriteLine("matriz[2,1] = " + matriz[2,1]);
Console.WriteLine("Filas: " + matriz.GetLength(0));
Console.WriteLine("Columnas: " + matriz.GetLength(1));`
};

// ── Estado global del módulo ────────────────────────────────────

const arrSim = new ArraySimulator();
let arrMonacoEditor   = null;
let arrDecorations    = [];
let arrPlayTimer      = null;
let arrPlaying        = false;
let arrCurrentExample = '';

// ── Variables escalares editables ───────────────────────────────

function arrExtraerVariablesEditables(ast) {
    if (!ast || !ast.body) return [];
    return ast.body
        .filter(n => n.type === 'VariableDeclaration' && n.init && n.init.type === 'Literal' && n.init.value !== null)
        .map(n => ({ name: n.name, dataType: n.dataType, raw: n.init.raw, value: n.init.value, line: n.line }));
}

// Reconstruye el código fuente completo sustituyendo SOLO los valores
// de las variables editables indicadas, sin tocar el resto del programa.
function arrReconstruirCodigo(baseCode, variables, valoresNuevos) {
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

// Dibuja el panel de inputs encima del editor. Solo reconstruye el HTML
// si las variables editables cambiaron (cantidad/nombres/tipos), para no
// perder el foco mientras el usuario escribe.
function arrRenderInputsVariables(variables, codigoBase) {
    const host = document.getElementById('arr-vars-editable');
    if (!host) return;

    if (!variables.length) {
        host.innerHTML = '';
        host.dataset.arrVarsSignature = '';
        return;
    }

    const signature = variables.map(v => v.name + ':' + v.dataType).join('|');
    if (host.dataset.arrVarsSignature === signature) return;
    host.dataset.arrVarsSignature = signature;

    host.innerHTML = variables.map(v => {
        const tipoInput = (v.dataType === 'int' || v.dataType === 'double' || v.dataType === 'float' || v.dataType === 'long') ? 'number' : 'text';
        let inputHtml;
        if (v.dataType === 'bool') {
            inputHtml =
                '<select class="arr-var-input" data-var="' + v.name + '">' +
                    '<option value="true"' + (v.value === true ? ' selected' : '') + '>true</option>' +
                    '<option value="false"' + (v.value === false ? ' selected' : '') + '>false</option>' +
                '</select>';
        } else {
            inputHtml =
                '<input class="arr-var-input" type="' + tipoInput + '" data-var="' + v.name + '" value="' + arrEscape(String(v.value)) + '"' +
                (tipoInput === 'number' && v.dataType !== 'int' && v.dataType !== 'long' ? ' step="0.01"' : '') + '>';
        }
        return (
            '<div class="arr-var-field">' +
                '<label>' + arrEscape(v.dataType) + ' ' + arrEscape(v.name) + '</label>' +
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
            const nuevoCodigo = arrReconstruirCodigo(codigoBase, variables, valoresNuevos);
            if (arrMonacoEditor) arrMonacoEditor.setValue(nuevoCodigo);
            arrEjecutarSinTocarInputs(nuevoCodigo);
        });
    });
}

// Ejecuta sin volver a dibujar el panel de inputs (evita perder el foco).
function arrEjecutarSinTocarInputs(codigo) {
    const first = arrSim.load(codigo);
    arrRender(first, arrSim.info());

    const btns = _arrBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { arrPlaying = false; btns[3].innerHTML = _ARR_ICON_PLAY; }
}

// Carga el código, detecta variables editables, dibuja sus inputs
// y muestra el primer paso.
function arrCargarYEjecutar(codigo) {
    const first = arrSim.load(codigo);
    const variables = arrExtraerVariablesEditables(arrSim.lastAst);
    arrRenderInputsVariables(variables, codigo);
    arrRender(first, arrSim.info());

    const btns = _arrBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { arrPlaying = false; btns[3].innerHTML = _ARR_ICON_PLAY; }
}

// ── Render de memoria (variables, arreglos y matrices) ──────────

function arrBuildMemoriaHtml(state) {
    const ch = new Set(state.changed || []);
    let html = '';

    if (state.variables && state.variables.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
        state.variables.forEach(v => {
            const f = arrFmtVal(v.value, v.type);
            html += '<div class="cs-var-row">' + arrEscape(v.type) + ' <b>' + arrEscape(v.name) + '</b> = ' + arrEscape(f.text) + '</div>';
        });
        html += '</div>';
    }

    if (state.arrays && state.arrays.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Arreglos<span class="n">' + state.arrays.length + '</span></div>';
        state.arrays.forEach(a => {
            html += '<div class="cs-arr"><div class="cs-arr-name">' + arrEscape(a.type) + '[] <b>' + arrEscape(a.name) + '</b><span class="meta">.Length = ' + a.length + '</span></div>';
            html += '<div class="cs-cells">';
            for (let i = 0; i < a.length; i++) {
                const val = a.values[i];
                const isch = ch.has(a.name + '[' + i + ']');
                html += '<div class="cs-cell-wrap"><div class="cs-cell-idx">' + i + '</div>' +
                    '<div class="cs-cell' + (val === null ? ' cs-null' : '') + (isch ? ' cs-flash' : '') + '">' + arrEscape(arrCellText(val)) + '</div></div>';
            }
            html += '</div></div>';
        });
        html += '</div>';
    }

    if (state.matrices && state.matrices.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Matrices<span class="n">' + state.matrices.length + '</span></div>';
        state.matrices.forEach(m => {
            html += '<div class="cs-mtx"><div class="cs-mtx-name">' + arrEscape(m.type) + '[,] <b>' + arrEscape(m.name) + '</b><span class="meta">' + m.rows + ' × ' + m.cols + '</span></div>';
            html += '<table class="cs-mtx-table"><tr><th></th>';
            for (let c = 0; c < m.cols; c++) html += '<th>C' + c + '</th>';
            html += '</tr>';
            for (let r = 0; r < m.rows; r++) {
                html += '<tr><th>F' + r + '</th>';
                for (let c = 0; c < m.cols; c++) {
                    const val = m.values[r][c];
                    const isch = ch.has(m.name + '[' + r + ',' + c + ']');
                    html += '<td><div class="cs-mcell' + (val === null ? ' cs-null' : '') + (isch ? ' cs-flash' : '') + '">' + arrEscape(arrCellText(val)) + '</div></td>';
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

function arrRender(state, info) {
    if (!state) { arrClearPanels(); return; }
    arrHighlightLine(state.currentLine, state.isError);

    const panelPaso = document.getElementById('panel-paso');
    if (panelPaso) {
        const src = (arrMonacoEditor && state.currentLine)
            ? arrEscape(arrMonacoEditor.getModel().getLineContent(state.currentLine).trim())
            : '';
        panelPaso.innerHTML =
            (state.currentLine ? '<div class="cs-step-line">Línea ' + state.currentLine + ': ' + src + '</div>' : '') +
            '<div class="cs-step-note' + (state.isError ? ' iserr' : '') + '">' + arrEscape(state.description || '') + '</div>';
    }

    const panelVars = document.getElementById('panel-vars');
    if (panelVars) panelVars.innerHTML = arrBuildMemoriaHtml(state);

    const panelSalida = document.getElementById('panel-salida');
    if (panelSalida) panelSalida.textContent = (state.output || []).join('\n');

    if (info && info.total > 0) {
        const stepEl = document.querySelector('.ctrl-step');
        if (stepEl) stepEl.textContent = 'Paso ' + (info.index + 1) + ' / ' + info.total;
        const fill = document.querySelector('.pbar i');
        if (fill) fill.style.width = ((info.index + 1) / info.total * 100) + '%';
    }
}

function arrHighlightLine(line, isError) {
    if (!arrMonacoEditor) return;
    if (!line || line < 1) { arrDecorations = arrMonacoEditor.deltaDecorations(arrDecorations, []); return; }
    const cls = isError ? 'cs-line-error' : 'cs-line-active';
    arrDecorations = arrMonacoEditor.deltaDecorations(arrDecorations, [{
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: cls }
    }]);
    arrMonacoEditor.revealLineInCenter(line);
}

function arrClearPanels() {
    if (arrMonacoEditor) arrDecorations = arrMonacoEditor.deltaDecorations(arrDecorations, []);
    const panelPaso   = document.getElementById('panel-paso');
    const panelVars   = document.getElementById('panel-vars');
    const panelSalida = document.getElementById('panel-salida');
    const stepEl      = document.querySelector('.ctrl-step');
    const fill        = document.querySelector('.pbar i');
    if (panelPaso)   panelPaso.innerHTML   = '';
    if (panelVars)   panelVars.innerHTML   = '';
    if (panelSalida) panelSalida.textContent = '';
    if (stepEl)      stepEl.textContent    = 'Paso 0 / 0';
    if (fill)        fill.style.width      = '0%';
}

// ── Inicialización del editor ─────────────────────────────────

function initArraySimulator(nombreTema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    if (!document.getElementById('arr-vars-editable')) {
        const varsHost = document.createElement('div');
        varsHost.id = 'arr-vars-editable';
        editorBody.parentNode.insertBefore(varsHost, editorBody);
    }

    const codigoInicial = ARR_EXAMPLES[nombreTema] || ARR_EXAMPLES.Array_unidimensional;
    arrCurrentExample = codigoInicial;

    function crearEditor() {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            arrMonacoEditor = monaco.editor.create(editorBody, {
                value: codigoInicial,
                language: 'csharp',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                readOnly: true
            });
            arrConectarBotones();
            arrCargarYEjecutar(codigoInicial);
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

function arrGetDelay() {
    const slider = document.getElementById('arr-speed-slider');
    const val = slider ? parseInt(slider.value) : 40;
    return Math.round(2000 - (val / 100) * 1800);
}

function arrStopPlay(btns) {
    clearTimeout(arrPlayTimer);
    arrPlayTimer = null;
    arrPlaying   = false;
    const btnR = (btns && btns[3]) ? btns[3] : document.getElementById('btn-reproducir');
    if (btnR) btnR.innerHTML = _ARR_ICON_PLAY;
}

function arrAutoPlay(btns) {
    const info = arrSim.info();
    if (info.index >= info.total - 1) {
        arrStopPlay(btns);
        return;
    }
    const state = arrSim.next();
    arrRender(state, arrSim.info());
    if (btns[1]) btns[1].disabled = (arrSim.info().index <= 0);
    arrPlayTimer = setTimeout(() => arrAutoPlay(btns), arrGetDelay());
}

// ── Conexión de botones ───────────────────────────────────────

function arrConectarBotones() {
    const btns = _arrBtns();

    // [0] Volver al inicio → restaura el ejemplo original y reejecuta.
    if (btns[0]) btns[0].onclick = () => {
        arrStopPlay(btns);
        if (arrMonacoEditor) arrMonacoEditor.setValue(arrCurrentExample);
        arrCargarYEjecutar(arrCurrentExample);
    };

    // [1] Paso anterior
    if (btns[1]) {
        btns[1].disabled = true;
        btns[1].onclick = () => {
            arrStopPlay(btns);
            const state = arrSim.prev();
            arrRender(state, arrSim.info());
            btns[1].disabled = (arrSim.info().index <= 0);
        };
    }

    // [2] Paso siguiente
    if (btns[2]) btns[2].onclick = () => {
        arrStopPlay(btns);
        const state = arrSim.next();
        arrRender(state, arrSim.info());
        if (btns[1]) btns[1].disabled = (arrSim.info().index <= 0);
    };

    // [3] Reproducir / Pausar
    if (btns[3]) btns[3].onclick = () => {
        if (arrPlaying) {
            arrStopPlay(btns);
            return;
        }
        if (arrSim.info().total === 0) {
            const first = arrSim.load(arrMonacoEditor.getValue());
            arrRender(first, arrSim.info());
            if (!first || first.isError) return;
            if (btns[1]) btns[1].disabled = true;
        }
        arrPlaying = true;
        btns[3].innerHTML = _ARR_ICON_PAUSE;
        arrPlayTimer = setTimeout(() => arrAutoPlay(btns), arrGetDelay());
    };

    const controls = document.querySelector('.editor-controls');
    if (controls && !document.getElementById('arr-speed-slider')) {
        const speedRow = document.createElement('div');
        speedRow.className = 'sim-speed-row';
        speedRow.innerHTML =
            '<label>Velocidad</label>' +
            '<input type="range" id="arr-speed-slider" min="1" max="100" value="40">' +
            '<span class="sim-speed-val" id="arr-speed-val">1×</span>';
        controls.appendChild(speedRow);

        const slider = document.getElementById('arr-speed-slider');
        const valLbl = document.getElementById('arr-speed-val');
        slider.addEventListener('input', () => {
            const mult = (parseFloat(slider.value) / 40).toFixed(1);
            valLbl.textContent = mult + '×';
        });
    }
}

// ── Hook a cargarTema ─────────────────────────────────────────
//  Envuelve la versión de cargarTema ya envuelta por simulator.js,
//  sin modificar ese archivo. Cada wrapper limpia solo su propio
//  simulador antes de delegar al siguiente.

(function () {
    const _cargarTema = window.cargarTema;
    window.cargarTema = function (nombreTema) {
        arrStopPlay(null);
        if (arrMonacoEditor) {
            arrMonacoEditor.dispose();
            arrMonacoEditor = null;
            arrDecorations  = [];
        }
        arrSim.clear();

        if (typeof _cargarTema === 'function') _cargarTema(nombreTema);

        if (nombreTema === 'Array_unidimensional' || nombreTema === 'Array_bidimensional') {
            setTimeout(() => initArraySimulator(nombreTema), 0);
        }
    };
})();