/* ============================================================
   admin/js/admin-consola.js
   Consola de vista previa del panel de administrador: MISMA consola
   paso a paso que ven los estudiantes (Inicio/Simulador/*.js), pero
   reimplementada aquí para no mezclarse con esos archivos — el admin
   necesita el editor EDITABLE (no readOnly) y sus propios ids de DOM.

   Motor: usa CSharpEngine (Inicio/Simulador/engine.js), el mismo motor
   que ya usan los simuladores de Arreglos, Recursividad y Archivos —
   es el único que cubre TODO lo que un ejemplo/ejercicio puede traer
   (condicionales, ciclos, arreglos, matrices, funciones/recursividad,
   archivos simulados), a diferencia del intérprete propio de
   Inicio/Simulador/simulator.js que solo cubre un subconjunto.

   Expone window.AdmConsola con:
     crearEditor(container)   → crea el Monaco editable y arranca
     cargarCodigo(codigo)     → cambia el código (p.ej. al cambiar de
                                 pestaña) y vuelve a ejecutar
     obtenerCodigoActual()    → string con el código del editor
     enfocar()                → foco al editor
     limpiar()                → resetea el estado (al cambiar de tema)
   El editor real de Monaco queda accesible en AdmConsola.editor por si
   admin.js necesita su propio listener adicional (p.ej. markDirty).
   ============================================================ */

(function () {
    "use strict";

    function admEscape(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function admFmtVal(v, type) {
        if (v === null || v === undefined) return 'null';
        if (type === 'bool' || typeof v === 'boolean') return v ? 'true' : 'false';
        if (type === 'char') return "'" + v + "'";
        if (type === 'string' || typeof v === 'string') return '"' + v + '"';
        return String(v);
    }

    const _ADM_ICON_PLAY  = '<img src="../img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
    const _ADM_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

    // ── SnapshotManager (idéntico en espíritu al de los simuladores de alumno) ──
    class AdmSnapMgr {
        constructor() { this.snaps = []; this.idx = -1; }
        reset() { this.snaps = []; this.idx = -1; }
        load(snapshots) { this.snaps = snapshots || []; this.idx = this.snaps.length ? 0 : -1; }
        current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
        next() { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
        prev() { if (this.idx > 0) this.idx--; return this.current(); }
        total() { return this.snaps.length; }
    }

    // ── Simulador (usa CSharpEngine como motor) ──
    class AdmSimulator {
        constructor() { this.snap = new AdmSnapMgr(); this.lastAst = null; }
        load(code) {
            this.snap.reset();
            this.lastAst = null;
            if (typeof CSharpEngine === 'undefined') {
                return {
                    currentLine: 1, description: 'CSharpEngine no está cargado.', isError: true,
                    variables: [], arrays: [], matrices: [], output: [], changed: [], callStack: [], files: {}
                };
            }
            let result;
            try {
                result = CSharpEngine.compileAndRun(code, { maxSteps: 50000 });
            } catch (e) {
                return {
                    currentLine: e.line || 1, description: e.message, isError: true,
                    variables: [], arrays: [], matrices: [], output: [], changed: [], callStack: [], files: {}
                };
            }
            this.lastAst = result.ast;
            if (result.error) {
                this.snap.load([{
                    currentLine: result.error.line || 1,
                    description: result.error.message,
                    isError: true,
                    variables: [], arrays: [], matrices: [], output: result.output || [], changed: [], callStack: [], files: {}
                }]);
            } else {
                this.snap.load(result.snapshots);
            }
            return this.snap.current();
        }
        next() { return this.snap.next(); }
        prev() { return this.snap.prev(); }
        clear() { this.snap.reset(); this.lastAst = null; }
        info() { return { index: this.snap.idx, total: this.snap.total() }; }
    }

    // ── Estado del módulo ──
    const admSim = new AdmSimulator();
    let admEditor = null;
    let admDecorations = [];
    let admPlayTimer = null;
    let admPlaying = false;
    let admCurrentCode = '';
    let admControlesConectados = false;

    function _admBtns() {
        return [
            document.getElementById('adm-btn-reiniciar'),
            document.getElementById('adm-btn-anterior'),
            document.getElementById('adm-btn-siguiente'),
            document.getElementById('adm-btn-reproducir')
        ];
    }

    // ── Variables escalares editables (mismo truco que en Inicio/Simulador) ──
    function admExtraerVariablesEditables(ast) {
        if (!ast || !ast.body) return [];
        return ast.body
            .filter(n => n.type === 'VariableDeclaration' && n.init && n.init.type === 'Literal' && n.init.value !== null)
            .map(n => ({ name: n.name, dataType: n.dataType, raw: n.init.raw, value: n.init.value, line: n.line }));
    }

    function admReconstruirCodigo(baseCode, variables, valoresNuevos) {
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

    function admRenderInputsVariables(variables, codigoBase) {
        const host = document.getElementById('adm-vars-editable');
        if (!host) return;
        if (!variables.length) {
            host.innerHTML = '';
            host.dataset.admVarsSignature = '';
            return;
        }
        const signature = variables.map(v => v.name + ':' + v.dataType).join('|');
        if (host.dataset.admVarsSignature === signature) return;
        host.dataset.admVarsSignature = signature;

        host.innerHTML = variables.map(v => {
            const tipoInput = (v.dataType === 'int' || v.dataType === 'double' || v.dataType === 'float') ? 'number' : 'text';
            const inputHtml = v.dataType === 'bool'
                ? '<select class="arr-var-input" data-var="' + v.name + '">' +
                  '<option value="true"' + (v.value === true ? ' selected' : '') + '>true</option>' +
                  '<option value="false"' + (v.value === false ? ' selected' : '') + '>false</option>' +
                  '</select>'
                : '<input class="arr-var-input" type="' + tipoInput + '" data-var="' + v.name + '" value="' + admEscape(String(v.value)) + '">';
            return '<div class="arr-var-field"><label>' + admEscape(v.dataType) + ' ' + admEscape(v.name) + '</label>' + inputHtml + '</div>';
        }).join('');

        host.querySelectorAll('.arr-var-input').forEach(input => {
            const evento = input.tagName === 'SELECT' ? 'change' : 'input';
            input.addEventListener(evento, () => {
                const vals = {};
                host.querySelectorAll('.arr-var-input').forEach(inp => {
                    vals[inp.dataset.var] = inp.tagName === 'SELECT' ? (inp.value === 'true') : inp.value;
                });
                const nuevoCodigo = admReconstruirCodigo(codigoBase, variables, vals);
                // Edición real (cambia el código que se guarda): SÍ debe pasar
                // por el listener normal de Monaco, así que no se silencia.
                if (admEditor) admEditor.setValue(nuevoCodigo);
            });
        });
    }

    // ── Render de memoria: variables, pila de llamadas, arreglos, matrices, archivos ──
    function admBuildCallStackHtml(callStack) {
        if (!callStack || !callStack.length) return '';
        let html = '<div class="rec-stack-panel"><div class="rec-stack-header">Pila de llamadas<span class="n">' + callStack.length + '</span></div>';
        for (let i = callStack.length - 1; i >= 0; i--) {
            const frame = callStack[i];
            const argsStr = Object.entries(frame.args).map(([k, v]) => k + ' = ' + admEscape(String(v))).join(', ');
            const depth = callStack.length - 1 - i;
            html += '<div class="rec-frame" style="margin-left:' + (depth * 12) + 'px">' +
                '<span class="rec-frame-name">' + admEscape(frame.name) + '</span>' +
                '<span class="rec-frame-args">(' + admEscape(argsStr) + ')</span>' +
                '</div>';
        }
        html += '</div>';
        return html;
    }

    function admBuildFilesHtml(files, prevFiles) {
        if (!files || Object.keys(files).length === 0) return '';
        prevFiles = prevFiles || {};
        let html = '<div class="arc-fs-panel"><div class="arc-fs-header">Sistema de archivos virtual<span class="n">' + Object.keys(files).length + '</span></div>';
        for (const [nombre, contenido] of Object.entries(files)) {
            const esNuevo = !(nombre in prevFiles) || prevFiles[nombre] !== contenido;
            const lineas = String(contenido).split('\n');
            const preview = lineas.slice(0, 6).map(l => admEscape(l)).join('<br>');
            const masLineas = lineas.length > 6 ? '<span class="arc-more">+' + (lineas.length - 6) + ' líneas más</span>' : '';
            html += '<div class="arc-file' + (esNuevo ? ' arc-file-changed' : '') + '">' +
                '<div class="arc-file-name">📄 ' + admEscape(nombre) + '</div>' +
                '<div class="arc-file-content">' + preview + (masLineas ? '<br>' + masLineas : '') + '</div>' +
                '</div>';
        }
        html += '</div>';
        return html;
    }

    function admBuildForBoxHtml(forCtx) {
        if (!forCtx) return '';
        const val = forCtx.varValue !== null ? forCtx.varValue : '?';
        const valStr = admEscape(String(val));
        const varRe = new RegExp('\\b' + forCtx.varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        const condWithVal = admEscape(forCtx.condText.replace(varRe, String(val)));
        const updateWithVal = admEscape(forCtx.updateText.replace(varRe, String(val)));
        let condBadge = '';
        if (forCtx.condResult !== null) {
            const yes = forCtx.condResult;
            condBadge = '<span class="sim-for-badge ' + (yes ? 'sim-for-t' : 'sim-for-f') + '">' + (yes ? 'verdadero' : 'falso') + '</span>';
        }
        return '<div class="sim-for-panel">' +
            '<div class="sim-for-header">⟳ ciclo <b>for</b></div>' +
            '<div class="sim-for-parts">' +
                '<div class="sim-for-part"><div class="sim-for-label">inicializador</div>' +
                    '<code class="sim-for-code">' + admEscape(forCtx.varName) + ' = <b class="sim-for-t">' + valStr + '</b></code></div>' +
                '<div class="sim-for-part"><div class="sim-for-label">condición</div>' +
                    '<code class="sim-for-code">' + condWithVal + '</code>' +
                    (condBadge ? '<div class="sim-for-now">' + condBadge + '</div>' : '') + '</div>' +
                '<div class="sim-for-part"><div class="sim-for-label">avance</div>' +
                    '<code class="sim-for-code">' + updateWithVal + '</code></div>' +
            '</div></div>';
    }

    function admBuildMemoriaHtml(state, prevState) {
        const ch = new Set(state.changed || []);
        const rd = new Set(state.read || []);
        let html = admBuildCallStackHtml(state.callStack) + admBuildForBoxHtml(state.forCtx);

        if (state.variables && state.variables.length) {
            html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
            state.variables.forEach(v => {
                const val = admFmtVal(v.value, v.type);
                const changed = ch.has(v.name);
                html += '<div class="cs-var-row' + (changed ? ' cs-flash' : '') + '">' +
                    admEscape(v.type) + ' <b>' + admEscape(v.name) + '</b> = ' + admEscape(val) + '</div>';
            });
            html += '</div>';
        }

        if (state.arrays && state.arrays.length) {
            html += '<div class="cs-mem-block"><div class="cs-mem-head">Arreglos<span class="n">' + state.arrays.length + '</span></div>';
            state.arrays.forEach(a => {
                html += '<div class="cs-arr"><div class="cs-arr-name">' + admEscape(a.type) + '[] <b>' + admEscape(a.name) + '</b><span class="meta">.Length = ' + a.length + '</span></div>';
                html += '<div class="cs-cells">';
                for (let i = 0; i < a.length; i++) {
                    const val = a.values[i];
                    const isch = ch.has(a.name + '[' + i + ']');
                    const isrd = !isch && rd.has(a.name + '[' + i + ']');
                    const extra = isch ? ' cs-flash' : (isrd ? ' cs-read' : '');
                    html += '<div class="cs-cell-wrap">' +
                        '<div class="cs-cell-idx' + (isrd ? ' cs-read-idx' : '') + '">' + i + '</div>' +
                        '<div class="cs-cell' + (val === null ? ' cs-null' : '') + extra + '">' + admEscape(val === null ? 'null' : String(val)) + '</div>' +
                        '</div>';
                }
                html += '</div></div>';
            });
            html += '</div>';
        }

        if (state.matrices && state.matrices.length) {
            html += '<div class="cs-mem-block"><div class="cs-mem-head">Matrices<span class="n">' + state.matrices.length + '</span></div>';
            state.matrices.forEach(m => {
                html += '<div class="cs-mtx"><div class="cs-mtx-name">' + admEscape(m.type) + '[,] <b>' + admEscape(m.name) + '</b><span class="meta">' + m.rows + ' × ' + m.cols + '</span></div>';
                html += '<table class="cs-mtx-table"><tr><th></th>';
                for (let c = 0; c < m.cols; c++) html += '<th>C' + c + '</th>';
                html += '</tr>';
                for (let r = 0; r < m.rows; r++) {
                    html += '<tr><th>F' + r + '</th>';
                    for (let c = 0; c < m.cols; c++) {
                        const val = m.values[r][c];
                        const key = m.name + '[' + r + ',' + c + ']';
                        const isch = ch.has(key);
                        const isrd = !isch && rd.has(key);
                        const extra = isch ? ' cs-flash' : (isrd ? ' cs-read' : '');
                        html += '<td><div class="cs-mcell' + (val === null ? ' cs-null' : '') + extra + '">' + admEscape(val === null ? 'null' : String(val)) + '</div></td>';
                    }
                    html += '</tr>';
                }
                html += '</table></div>';
            });
            html += '</div>';
        }

        const prevFiles = prevState ? prevState.files : {};
        html += admBuildFilesHtml(state.files, prevFiles);

        if (!html) html = '<div class="cs-empty-hint">Aún no hay datos en memoria en este paso.</div>';
        return html;
    }

    let _admPrevState = null;

    function admHighlight(line, isError) {
        if (!admEditor || !window.monaco) return;
        const cls = isError ? 'cs-line-error' : 'cs-line-active';
        admDecorations = admEditor.deltaDecorations(admDecorations, [{
            range: new monaco.Range(line, 1, line, 1),
            options: { isWholeLine: true, className: cls }
        }]);
        admEditor.revealLineInCenter(line);
    }

    function admClearPanels() {
        if (admEditor) admDecorations = admEditor.deltaDecorations(admDecorations, []);
        const panelPaso = document.getElementById('adm-panel-paso');
        const panelVars = document.getElementById('adm-panel-vars');
        const panelSalida = document.getElementById('adm-panel-salida');
        const stepEl = document.getElementById('adm-ctrl-step');
        const fill = document.getElementById('adm-pbar-fill');
        if (panelPaso) panelPaso.innerHTML = '';
        if (panelVars) panelVars.innerHTML = '';
        if (panelSalida) panelSalida.textContent = '';
        if (stepEl) stepEl.textContent = 'Paso 0 / 0';
        if (fill) fill.style.width = '0%';
        _admPrevState = null;
    }

    function admRender(state, info) {
        if (!state) { admClearPanels(); return; }

        const line = state.currentLine || 0;
        if (line > 0) admHighlight(line, state.isError);

        const panelPaso = document.getElementById('adm-panel-paso');
        if (panelPaso) {
            const src = (admEditor && line > 0)
                ? admEscape(admEditor.getModel().getLineContent(line).trim())
                : '';
            panelPaso.innerHTML =
                (line > 0 ? '<div class="cs-step-line">Línea ' + line + (src ? ': ' + src : '') + '</div>' : '') +
                '<div class="cs-step-note' + (state.isError ? ' iserr' : '') + '">' + admEscape(state.description || '') + '</div>';
        }

        const panelVars = document.getElementById('adm-panel-vars');
        if (panelVars) panelVars.innerHTML = admBuildMemoriaHtml(state, _admPrevState);

        const panelSalida = document.getElementById('adm-panel-salida');
        if (panelSalida) panelSalida.textContent = (state.output || []).join('\n');

        if (info && info.total > 0) {
            const stepEl = document.getElementById('adm-ctrl-step');
            if (stepEl) stepEl.textContent = 'Paso ' + (info.index + 1) + ' / ' + info.total;
            const fill = document.getElementById('adm-pbar-fill');
            if (fill) fill.style.width = ((info.index + 1) / info.total * 100) + '%';
        }

        _admPrevState = state;
    }

    // ── Ejecutar código (recompila y arranca desde el paso 1) ──
    function admEjecutar(codigo) {
        admCurrentCode = codigo;
        const first = admSim.load(codigo);
        const variables = admExtraerVariablesEditables(admSim.lastAst);
        admRenderInputsVariables(variables, codigo);
        admRender(first, admSim.info());
        const btns = _admBtns();
        if (btns[1]) btns[1].disabled = true;
        if (btns[3]) { admPlaying = false; btns[3].innerHTML = _ADM_ICON_PLAY; }
    }

    // ── Controles de reproducción ──
    function admGetDelay() {
        const slider = document.getElementById('adm-speed-slider');
        const val = slider ? parseInt(slider.value) : 40;
        return Math.round(2000 - (val / 100) * 1800);
    }

    function admStopPlay(btns) {
        clearTimeout(admPlayTimer);
        admPlayTimer = null;
        admPlaying = false;
        const btnR = (btns && btns[3]) ? btns[3] : _admBtns()[3];
        if (btnR) btnR.innerHTML = _ADM_ICON_PLAY;
    }

    function admConectarControles() {
        if (admControlesConectados) return;
        admControlesConectados = true;

        const btns = _admBtns();
        const [btnRei, btnAnt, btnSig, btnRep] = btns;

        if (btnRei) btnRei.onclick = () => {
            admStopPlay(btns);
            admEjecutar(admEditor ? admEditor.getValue() : admCurrentCode);
        };
        if (btnAnt) btnAnt.onclick = () => {
            admStopPlay(btns);
            const state = admSim.prev();
            admRender(state, admSim.info());
            if (btnAnt) btnAnt.disabled = admSim.info().index === 0;
        };
        if (btnSig) btnSig.onclick = () => {
            admStopPlay(btns);
            const state = admSim.next();
            admRender(state, admSim.info());
            if (btnAnt) btnAnt.disabled = admSim.info().index === 0;
        };
        if (btnRep) btnRep.onclick = () => {
            if (admPlaying) { admStopPlay(btns); return; }
            admPlaying = true;
            btnRep.innerHTML = _ADM_ICON_PAUSE;
            const tick = () => {
                if (!admPlaying) return;
                const info = admSim.info();
                if (info.index >= info.total - 1) { admStopPlay(btns); return; }
                const state = admSim.next();
                admRender(state, admSim.info());
                if (btnAnt) btnAnt.disabled = admSim.info().index === 0;
                admPlayTimer = setTimeout(tick, admGetDelay());
            };
            admPlayTimer = setTimeout(tick, admGetDelay());
        };

        const slider = document.getElementById('adm-speed-slider');
        const speedVal = document.getElementById('adm-speed-val');
        if (slider && speedVal) {
            slider.oninput = () => { speedVal.textContent = (parseFloat(slider.value) / 40).toFixed(1) + '×'; };
        }
    }

    // ── API pública ──
    function crearEditor(container) {
        if (admEditor || !container) return;
        admEditor = monaco.editor.create(container, {
            value: '',
            language: 'csharp',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            readOnly: false
        });
        admConectarControles();
        // Siempre corre la simulación con el código que haya en pantalla,
        // sea por escritura real o por un setValue() programático (cambio
        // de pestaña) — admin.js decide aparte si eso cuenta como "dirty".
        admEditor.onDidChangeModelContent(() => {
            admEjecutar(admEditor.getValue());
        });
    }

    function cargarCodigo(codigo) {
        if (!admEditor) return;
        admEditor.setValue(codigo || '');
        // Si el código no cambió respecto al anterior, setValue() no dispara
        // onDidChangeModelContent — se fuerza la ejecución para que el panel
        // de la derecha siempre refleje la pestaña activa.
        admEjecutar(admEditor.getValue());
    }

    function obtenerCodigoActual() {
        return admEditor ? admEditor.getValue() : admCurrentCode;
    }

    function enfocar() {
        if (admEditor) admEditor.focus();
    }

    function limpiar() {
        admStopPlay(_admBtns());
        admSim.clear();
        admClearPanels();
    }

    window.AdmConsola = {
        crearEditor,
        cargarCodigo,
        obtenerCodigoActual,
        enfocar,
        limpiar,
        get editor() { return admEditor; }
    };
})();
