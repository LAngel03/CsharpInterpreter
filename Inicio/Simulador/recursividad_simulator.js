// ============================================================
//  Simulador/recursividad_simulator.js
//  Simulador paso a paso para el subtema "Recursividad".
//  Usa CSharpEngine como motor (soporta funciones y return).
// ============================================================

// ── Utilidades ───────────────────────────────────────────────

function recEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function recFmtVal(v, type) {
    if (v === null || v === undefined) return 'null';
    if (type === 'bool' || typeof v === 'boolean') return v ? 'true' : 'false';
    if (type === 'char') return "'" + v + "'";
    if (type === 'string' || typeof v === 'string') return '"' + v + '"';
    return String(v);
}

const _REC_ICON_PLAY  = '<img src="./img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
const _REC_ICON_PAUSE = '<img src="./img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

function _recBtns() {
    return [
        document.getElementById('btn-reiniciar'),
        document.getElementById('btn-paso-anterior'),
        document.getElementById('btn-paso-siguiente'),
        document.getElementById('btn-reproducir')
    ];
}

// ── SnapshotManager ──────────────────────────────────────────

class RecSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset()  { this.snaps = []; this.idx = -1; }
    load(snapshots) { this.snaps = snapshots || []; this.idx = this.snaps.length ? 0 : -1; }
    current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next()  { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev()  { if (this.idx > 0) this.idx--; return this.current(); }
    total() { return this.snaps.length; }
}

// ── Simulador (usa CSharpEngine como motor) ──────────────────

class RecursividadSimulator {
    constructor() { this.snap = new RecSnapMgr(); this.lastAst = null; }
    load(code) {
        this.snap.reset();
        this.lastAst = null;
        let result;
        try {
            result = CSharpEngine.compileAndRun(code, { maxSteps: 50000 });
        } catch (e) {
            return {
                currentLine: e.line || 1, description: e.message, isError: true,
                variables: [], arrays: [], matrices: [], output: [], changed: [], callStack: []
            };
        }
        this.lastAst = result.ast;
        if (result.error) {
            const errSnap = {
                currentLine: result.error.line || 1,
                description: result.error.message,
                isError: true,
                variables: [], arrays: [], matrices: [], output: result.output || [], changed: [], callStack: []
            };
            this.snap.load([errSnap]);
        } else {
            this.snap.load(result.snapshots);
        }
        return this.snap.current();
    }
    next()  { return this.snap.next(); }
    prev()  { return this.snap.prev(); }
    clear() { this.snap.reset(); this.lastAst = null; }
    info()  { return { index: this.snap.idx, total: this.snap.total() }; }
}

// ════════════════════════════════════════════════════════════
//  EJEMPLOS — 3 por módulo
// ════════════════════════════════════════════════════════════

const REC_EXAMPLES = {
    Recursividad: [

        // Ejemplo 1 — Factorial
`// Factorial: n! = n * (n-1) * ... * 1
// Caso base: Factorial(0) = 1
// Caso recursivo: Factorial(n) = n * Factorial(n-1)

static int Factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    int anterior = Factorial(n - 1);
    int resultado = n * anterior;
    return resultado;
}

int numero = 5;
int resultado = Factorial(numero);
Console.WriteLine("Factorial de " + numero + " = " + resultado);`,

        // Ejemplo 2 — Suma de 1 a n
`// Suma acumulativa: suma(n) = n + suma(n-1)
// Caso base: suma(1) = 1
// Caso recursivo: suma(n) = n + suma(n-1)

static int Suma(int n) {
    if (n <= 1) {
        return 1;
    }
    int resto = Suma(n - 1);
    int total = n + resto;
    return total;
}

int numero = 5;
int resultado = Suma(numero);
Console.WriteLine("Suma de 1 a " + numero + " = " + resultado);`,

        // Ejemplo 3 — Potencia
`// Potencia: base elevada a exp
// Caso base: Potencia(base, 0) = 1
// Caso recursivo: Potencia(base, exp) = base * Potencia(base, exp - 1)

static int Potencia(int base, int exp) {
    if (exp == 0) {
        return 1;
    }
    int resto = Potencia(base, exp - 1);
    int resultado = base * resto;
    return resultado;
}

int base = 2;
int exponente = 6;
int resultado = Potencia(base, exponente);
Console.WriteLine(base + " elevado a " + exponente + " = " + resultado);`
    ]
};

const REC_EJERCICIOS = {
    Recursividad: {
        enunciado: `Una escuela quiere calcular cuántos pasos sigue una cuenta regresiva: partiendo de un número entero positivo, el programa debe restarle 1 en cada llamada hasta llegar a cero y contar cuántas veces se llamó a sí mismo. Por ejemplo, si comienzas en 4, el conteo es 4 → 3 → 2 → 1 → 0, que son <strong>4 pasos</strong>. Usa recursividad: el <strong>caso base</strong> es cuando n es 0 (devuelve 0 pasos) y el <strong>caso recursivo</strong> suma 1 al resultado de llamar a la función con n − 1.`,
        codigo:
`// Cuenta cuantos pasos hasta llegar a 0
static int ContarPasos(int n) {
    if (n <= 0) {
        return 0;
    }
    int resto = ContarPasos(n - 1);
    int total = 1 + resto;
    return total;
}

int inicio = 4;
int pasos = ContarPasos(inicio);
Console.WriteLine("Pasos desde " + inicio + " hasta 0: " + pasos);`
    }
};

// ── Helpers de items ─────────────────────────────────────────

function recGetEjemplos(tema) {
    const ex = REC_EXAMPLES[tema];
    if (Array.isArray(ex)) return ex.slice();
    if (typeof ex === 'string') return [ex];
    return [''];
}

function recGetItems(tema) {
    const items = recGetEjemplos(tema).map((code, i) => ({
        label: 'Ejemplo ' + (i + 1),
        codigo: code,
        enunciado: null,
        esEjercicio: false
    }));
    const ej = REC_EJERCICIOS[tema];
    if (ej) items.push({ label: 'Ejercicio', codigo: ej.codigo, enunciado: ej.enunciado, esEjercicio: true });
    return items;
}

function recSetDescripcion(html, esEjercicio) {
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

// ── Estado global del módulo ──────────────────────────────────

const recSim = new RecursividadSimulator();
let recMonacoEditor = null;
let recDecorations  = [];
let recPlayTimer    = null;
let recPlaying      = false;
let recCurrentCode  = '';
let recTemaActual   = '';

// ── Variables escalares editables (sólo del cuerpo principal) ──

function recExtraerVariablesEditables(ast) {
    if (!ast || !ast.body) return [];
    return ast.body
        .filter(n => n.type === 'VariableDeclaration' && n.init && n.init.type === 'Literal' && n.init.value !== null)
        .map(n => ({ name: n.name, dataType: n.dataType, raw: n.init.raw, value: n.init.value, line: n.line }));
}

function recReconstruirCodigo(baseCode, variables, valoresNuevos) {
    const lineas = baseCode.split('\n');
    for (const v of variables) {
        const idx = v.line - 1;
        if (idx < 0 || idx >= lineas.length) continue;
        const nuevoValor = valoresNuevos[v.name];
        let valorFormateado;
        if (v.raw === 'string') {
            valorFormateado = '"' + String(nuevoValor).replace(/"/g, '\\"') + '"';
        } else if (v.raw === 'bool') {
            valorFormateado = (nuevoValor === true || nuevoValor === 'true') ? 'true' : 'false';
        } else {
            const num = parseFloat(nuevoValor);
            valorFormateado = isNaN(num) ? String(v.value) : String(num);
        }
        const regex = new RegExp('^(\\s*' + v.dataType + '\\s+' + v.name + '\\s*=\\s*).*?(;.*)$');
        lineas[idx] = lineas[idx].replace(regex, (_, a, d) => a + valorFormateado + d);
    }
    return lineas.join('\n');
}

function recRenderInputsVariables(variables, codigoBase) {
    let host = document.getElementById('rec-vars-editable');
    if (!host) return;
    if (!variables.length) {
        host.innerHTML = '';
        host.dataset.recVarsSignature = '';
        return;
    }
    const signature = variables.map(v => v.name + ':' + v.dataType).join('|');
    if (host.dataset.recVarsSignature === signature) return;
    host.dataset.recVarsSignature = signature;

    host.innerHTML = variables.map(v => {
        const tipoInput = (v.dataType === 'int' || v.dataType === 'double' || v.dataType === 'float') ? 'number' : 'text';
        const inputHtml = v.dataType === 'bool'
            ? '<select class="arr-var-input" data-var="' + v.name + '">' +
              '<option value="true"' + (v.value === true ? ' selected' : '') + '>true</option>' +
              '<option value="false"' + (v.value === false ? ' selected' : '') + '>false</option>' +
              '</select>'
            : '<input class="arr-var-input" type="' + tipoInput + '" data-var="' + v.name + '" value="' + recEscape(String(v.value)) + '">';
        return '<div class="arr-var-field"><label>' + recEscape(v.dataType) + ' ' + recEscape(v.name) + '</label>' + inputHtml + '</div>';
    }).join('');

    host.querySelectorAll('.arr-var-input').forEach(input => {
        const evento = input.tagName === 'SELECT' ? 'change' : 'input';
        input.addEventListener(evento, () => {
            const vals = {};
            host.querySelectorAll('.arr-var-input').forEach(inp => {
                vals[inp.dataset.var] = inp.tagName === 'SELECT' ? (inp.value === 'true') : inp.value;
            });
            const nuevoCodigo = recReconstruirCodigo(codigoBase, variables, vals);
            if (recMonacoEditor) recMonacoEditor.setValue(nuevoCodigo);
            recEjecutarSinTocarInputs(nuevoCodigo);
        });
    });
}

function recEjecutarSinTocarInputs(codigo) {
    const first = recSim.load(codigo);
    recRender(first, recSim.info());
    const btns = _recBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { recPlaying = false; btns[3].innerHTML = _REC_ICON_PLAY; }
}

function recCargarYEjecutar(codigo) {
    const first = recSim.load(codigo);
    const variables = recExtraerVariablesEditables(recSim.lastAst);
    recRenderInputsVariables(variables, codigo);
    recRender(first, recSim.info());
    const btns = _recBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { recPlaying = false; btns[3].innerHTML = _REC_ICON_PLAY; }
}

// ── Render de la pila de llamadas ─────────────────────────────

function recBuildCallStackHtml(callStack) {
    if (!callStack || !callStack.length) return '';
    let html = '<div class="rec-stack-panel"><div class="rec-stack-header">Pila de llamadas<span class="n">' + callStack.length + '</span></div>';
    for (let i = callStack.length - 1; i >= 0; i--) {
        const frame = callStack[i];
        const argsStr = Object.entries(frame.args).map(([k, v]) => k + ' = ' + recEscape(String(v))).join(', ');
        const depth = callStack.length - 1 - i;
        html += '<div class="rec-frame" style="margin-left:' + (depth * 12) + 'px">' +
            '<span class="rec-frame-name">' + recEscape(frame.name) + '</span>' +
            '<span class="rec-frame-args">(' + recEscape(argsStr) + ')</span>' +
            '</div>';
    }
    html += '</div>';
    return html;
}

// ── Render principal ──────────────────────────────────────────

function recBuildMemoriaHtml(state) {
    const ch = new Set(state.changed || []);
    let html = recBuildCallStackHtml(state.callStack);

    if (state.variables && state.variables.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
        state.variables.forEach(v => {
            const val = recFmtVal(v.value, v.type);
            const changed = ch.has(v.name);
            html += '<div class="cs-var-row' + (changed ? ' cs-flash' : '') + '">' +
                recEscape(v.type) + ' <b>' + recEscape(v.name) + '</b> = ' + recEscape(val) + '</div>';
        });
        html += '</div>';
    }

    return html;
}

function recHighlight(line, isError) {
    if (!recMonacoEditor) return;
    const cls = isError ? 'lineFalse' : 'lineHighlight';
    recDecorations = recMonacoEditor.deltaDecorations(recDecorations, [{
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: cls }
    }]);
    recMonacoEditor.revealLineInCenter(line);
}

function recClearPanels() {
    if (recMonacoEditor) recDecorations = recMonacoEditor.deltaDecorations(recDecorations, []);
    const panelPaso = document.getElementById('panel-paso');
    const panelVars = document.getElementById('panel-vars');
    const panelSalida = document.getElementById('panel-salida');
    const stepEl = document.querySelector('.ctrl-step');
    const fill = document.querySelector('.pbar i');
    if (panelPaso) panelPaso.innerHTML = '';
    if (panelVars) panelVars.innerHTML = '';
    if (panelSalida) panelSalida.textContent = '';
    if (stepEl) stepEl.textContent = 'Paso 0 / 0';
    if (fill) fill.style.width = '0%';
}

function recRender(state, info) {
    if (!state) { recClearPanels(); return; }

    const line = state.currentLine || 0;
    if (line > 0) recHighlight(line, state.isError);

    const panelPaso = document.getElementById('panel-paso');
    if (panelPaso) {
        const src = (recMonacoEditor && line > 0)
            ? recEscape(recMonacoEditor.getModel().getLineContent(line).trim())
            : '';
        const noteClass = state.isError ? ' err' : '';
        panelPaso.innerHTML =
            (line > 0 ? '<div class="sim-line-ref">Línea ' + line + (src ? ': ' + src : '') + '</div>' : '') +
            (state.description ? '<div class="sim-note' + noteClass + '">' + recEscape(state.description) + '</div>' : '');
    }

    const panelVars = document.getElementById('panel-vars');
    if (panelVars) panelVars.innerHTML = recBuildMemoriaHtml(state);

    const panelSalida = document.getElementById('panel-salida');
    if (panelSalida) panelSalida.textContent = (state.output || []).join('\n');

    if (info && info.total > 0) {
        const stepEl = document.querySelector('.ctrl-step');
        if (stepEl) stepEl.textContent = 'Paso ' + (info.index + 1) + ' / ' + info.total;
        const fill = document.querySelector('.pbar i');
        if (fill) fill.style.width = ((info.index + 1) / info.total * 100) + '%';
    }
}

// ── Controles ─────────────────────────────────────────────────

function recGetDelay() {
    const slider = document.getElementById('sim-speed-slider');
    const val = slider ? parseInt(slider.value) : 40;
    return Math.round(2000 - (val / 100) * 1800);
}

function recStopPlay(btns) {
    clearTimeout(recPlayTimer);
    recPlayTimer = null;
    recPlaying = false;
    const btnR = (btns && btns[3]) ? btns[3] : _recBtns()[3];
    if (btnR) btnR.innerHTML = _REC_ICON_PLAY;
}

function recConectarBotones() {
    const btns = _recBtns();
    const [btnRei, btnAnt, btnSig, btnRep] = btns;

    if (btnRei) btnRei.onclick = () => {
        recStopPlay(btns);
        recCargarYEjecutar(recCurrentCode);
    };
    if (btnAnt) btnAnt.onclick = () => {
        recStopPlay(btns);
        const state = recSim.prev();
        recRender(state, recSim.info());
        if (btnAnt) btnAnt.disabled = recSim.info().index === 0;
    };
    if (btnSig) btnSig.onclick = () => {
        recStopPlay(btns);
        const state = recSim.next();
        recRender(state, recSim.info());
        if (btnAnt) btnAnt.disabled = recSim.info().index === 0;
    };
    if (btnRep) btnRep.onclick = () => {
        if (recPlaying) { recStopPlay(btns); return; }
        recPlaying = true;
        btnRep.innerHTML = _REC_ICON_PAUSE;
        const tick = () => {
            if (!recPlaying) return;
            const info = recSim.info();
            if (info.index >= info.total - 1) { recStopPlay(btns); return; }
            const state = recSim.next();
            recRender(state, recSim.info());
            if (btnAnt) btnAnt.disabled = recSim.info().index === 0;
            recPlayTimer = setTimeout(tick, recGetDelay());
        };
        recPlayTimer = setTimeout(tick, recGetDelay());
    };

    const slider = document.getElementById('sim-speed-slider');
    const speedVal = document.querySelector('.sim-speed-val');
    if (slider && speedVal) {
        slider.oninput = () => { speedVal.textContent = slider.value + '%'; };
    }
}

// ── CSS de la pila de llamadas (inyectado una vez) ────────────

(function injectRecStyles() {
    if (document.getElementById('rec-styles')) return;
    const style = document.createElement('style');
    style.id = 'rec-styles';
    style.textContent = `
        .rec-stack-panel {
            background: #1a1d2a;
            border: 1px solid #3d4160;
            border-radius: 8px;
            padding: 8px 10px;
            margin-bottom: 8px;
        }
        .rec-stack-header {
            font-size: 0.68rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: #7c85c2;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .rec-stack-header .n {
            background: #2d3050;
            color: #a0a8d4;
            border-radius: 10px;
            padding: 0 6px;
            font-size: 0.75em;
        }
        .rec-frame {
            display: flex;
            align-items: baseline;
            gap: 4px;
            padding: 3px 6px;
            border-left: 2px solid #04AA6D;
            margin-bottom: 3px;
            background: #0f1018;
            border-radius: 0 4px 4px 0;
            font-size: 0.82rem;
        }
        .rec-frame-name {
            color: #04AA6D;
            font-weight: 700;
            font-family: 'Consolas', monospace;
        }
        .rec-frame-args {
            color: #c5cae9;
            font-family: 'Consolas', monospace;
        }
        #rec-vars-editable {
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            padding: 10px 14px;
            margin-bottom: 8px;
            background: #1e2130;
            border: 1px solid #3a3d4a;
            border-radius: 8px;
        }
        #rec-vars-editable:empty { display: none; }
    `;
    document.head.appendChild(style);
})();

// ── Hook en cargarTema ────────────────────────────────────────

(function wrapCargarTemaRecursividad() {
    const _prevCargarTema = window.cargarTema;

    window.cargarTema = function (nombreTema) {
        // Limpiar estado de recursividad al salir del módulo
        recStopPlay(_recBtns());
        if (recMonacoEditor) {
            recMonacoEditor.dispose();
            recMonacoEditor = null;
            recDecorations = [];
        }
        recSim.clear();

        if (typeof _prevCargarTema === 'function') _prevCargarTema(nombreTema);

        if (nombreTema !== 'Recursividad') return;

        recTemaActual = nombreTema;
        recPlaying = false;

        const editorBody = document.getElementById('editor-body');
        if (!editorBody) return;

        const items = recGetItems(nombreTema);
        recCurrentCode = items[0].codigo;

        // Pestañas (primero, van encima de los inputs)
        let tabsEl = document.getElementById('sim-ejemplos-tabs');
        if (!tabsEl && items.length > 1) {
            tabsEl = document.createElement('div');
            tabsEl.id = 'sim-ejemplos-tabs';
            editorBody.parentNode.insertBefore(tabsEl, editorBody);
        }

        // Panel de variables editables (debajo de las pestañas)
        if (!document.getElementById('rec-vars-editable')) {
            const varsHost = document.createElement('div');
            varsHost.id = 'rec-vars-editable';
            editorBody.parentNode.insertBefore(varsHost, editorBody);
        }
        if (tabsEl) {
            tabsEl.innerHTML = items.map((it, i) =>
                '<button class="sim-tab' + (i === 0 ? ' activo' : '') +
                (it.esEjercicio ? ' ejercicio' : '') +
                '" data-idx="' + i + '">' + it.label + '</button>'
            ).join('');
            tabsEl.querySelectorAll('.sim-tab').forEach(btn => {
                btn.onclick = () => {
                    recStopPlay(_recBtns());
                    const idx = parseInt(btn.dataset.idx);
                    const it = items[idx];
                    tabsEl.querySelectorAll('.sim-tab').forEach(b => b.classList.remove('activo'));
                    btn.classList.add('activo');
                    const defHtml = (window.temas && window.temas['Recursividad']) ? window.temas['Recursividad'].definicion : '';
                    recSetDescripcion(it.enunciado || defHtml, !!it.enunciado);
                    recCurrentCode = it.codigo;
                    if (recMonacoEditor) recMonacoEditor.setValue(it.codigo);
                    recCargarYEjecutar(it.codigo);
                };
            });
        }

        // Descripción inicial
        const defHtml = (window.temas && window.temas['Recursividad']) ? window.temas['Recursividad'].definicion : '';
        recSetDescripcion(defHtml, false);

        function crearEditorRec() {
            require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
            require(['vs/editor/editor.main'], function () {
                recMonacoEditor = monaco.editor.create(editorBody, {
                    value: recCurrentCode,
                    language: 'csharp',
                    theme: 'vs-dark',
                    automaticLayout: true,
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    readOnly: true
                });
                recConectarBotones();
                recCargarYEjecutar(recCurrentCode);
            });
        }

        if (window.monaco) crearEditorRec();
        else if (window.require) crearEditorRec();
        else {
            const loader = document.createElement('script');
            loader.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.js';
            loader.onload = crearEditorRec;
            document.head.appendChild(loader);
        }
    };
})();
