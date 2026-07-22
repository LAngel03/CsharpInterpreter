// ============================================================
//  Simulador/archivos_simulator.js
//  Simulador paso a paso para el subtema "Archivos".
//  Usa CSharpEngine como motor con filesystem virtual.
// ============================================================

// ── Utilidades ───────────────────────────────────────────────

function arcEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function arcFmtVal(v, type) {
    if (v === null || v === undefined) return 'null';
    if (type === 'bool' || typeof v === 'boolean') return v ? 'true' : 'false';
    if (type === 'string' || typeof v === 'string') return '"' + v + '"';
    return String(v);
}

const _ARC_ICON_PLAY  = '<img src="../img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
const _ARC_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

function _arcBtns() {
    return [
        document.getElementById('btn-reiniciar'),
        document.getElementById('btn-paso-anterior'),
        document.getElementById('btn-paso-siguiente'),
        document.getElementById('btn-reproducir')
    ];
}

// ── SnapshotManager ──────────────────────────────────────────

class ArcSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset()  { this.snaps = []; this.idx = -1; }
    load(s)  { this.snaps = s || []; this.idx = this.snaps.length ? 0 : -1; }
    current(){ return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next()   { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev()   { if (this.idx > 0) this.idx--; return this.current(); }
    total()  { return this.snaps.length; }
}

// ── Simulador (usa CSharpEngine) ─────────────────────────────

class ArchivosSimulator {
    constructor() { this.snap = new ArcSnapMgr(); this.lastAst = null; }
    load(code) {
        this.snap.reset();
        this.lastAst = null;
        let result;
        try {
            result = CSharpEngine.compileAndRun(code, { maxSteps: 20000 });
        } catch (e) {
            return { currentLine: e.line || 1, description: e.message, isError: true,
                     variables: [], arrays: [], matrices: [], output: [], changed: [], files: {} };
        }
        this.lastAst = result.ast;
        if (result.error) {
            const s = { currentLine: result.error.line || 1, description: result.error.message,
                        isError: true, variables: [], arrays: [], matrices: [],
                        output: result.output || [], changed: [], files: {} };
            this.snap.load([s]);
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
//  EJEMPLOS Y EJERCICIO — conectados a la API (subtema "Archivos")
// ════════════════════════════════════════════════════════════

const arcCacheSubtemas = {};

async function arcObtenerDatosTema(slug) {
    if (arcCacheSubtemas[slug]) return arcCacheSubtemas[slug];
    try {
        if (!window.ApiClient || typeof window.ApiClient.obtenerSubtemaPorSlug !== 'function') {
            throw new Error('window.ApiClient.obtenerSubtemaPorSlug no está disponible');
        }
        const subtema = await window.ApiClient.obtenerSubtemaPorSlug(slug);
        if (!subtema) throw new Error('La API devolvió una respuesta vacía para "' + slug + '"');
        arcCacheSubtemas[slug] = subtema;
        return subtema;
    } catch (e) {
        console.warn(`Subtema "${slug}" no encontrado en la API`, e);
        return { codigo_ejemplo: null, _apiError: e.message }; // null => sin datos, se avisa en pantalla
    }
}

function arcGetItemsDesdeSubtema(subtema) {
    if (subtema.codigo_ejemplo === null) {
        return [{ label: 'Ejemplo 1', codigo: '// No se pudo cargar el ejemplo desde la API.', enunciado: null, esEjercicio: false }];
    }

    // Los ejemplos vienen de su propia tabla (subtema.ejemplos), ya
    // ordenados por "orden" desde el backend.
    const ejemplosDb = Array.isArray(subtema.ejemplos) ? subtema.ejemplos : [];
    const items = ejemplosDb.map((ej, i) => ({
        label: ejemplosDb.length > 1 ? 'Ejemplo ' + (i + 1) : 'Ejemplo',
        codigo: ej.codigo || '',
        enunciado: ej.enunciado || null,
        titulo: ej.titulo || null,
        esEjercicio: false
    }));

    // Los ejercicios vienen APARTE, en subtema.ejercicios (lista de la BD).
    // Campos reales: titulo, descripcion (enunciado) y codigo_csharp (solución).
    const ejercicios = Array.isArray(subtema.ejercicios) ? subtema.ejercicios : [];
    ejercicios.forEach((ej, i) => {
        items.push({
            label: ejercicios.length > 1 ? 'Ejercicio ' + (i + 1) : 'Ejercicio',
            codigo: ej.codigo_csharp,
            enunciado: ej.descripcion,
            titulo: ej.titulo || null,
            esEjercicio: true
        });
    });

    if (!items.length) {
        items.push({ label: 'Ejemplo 1', codigo: '// La API no devolvió ejemplos para este tema.', enunciado: null, esEjercicio: false });
    }
    return items;
}

// Recuadro del enunciado propio del ejemplo/ejercicio activo — va debajo del
// concepto general del tema (#tema-descripcion, que no se toca aquí).
// tipo: 'ejercicio' | 'ejemplo' | null (oculta el recuadro, no hay enunciado)
function arcSetDescripcion(html, tipo, titulo) {
    const el = document.getElementById('tema-enunciado');
    if (!el) return;
    if (html && tipo) {
        let prefijo = '';
        if (tipo === 'ejercicio') prefijo = '<span class="sim-ejercicio-badge">Ejercicio: </span>' + (titulo ? '<strong>' + titulo + '</strong><br>' : '');
        else if (tipo === 'ejemplo') prefijo = '<span class="sim-ejemplo-badge">Ejemplo: </span>' + (titulo ? '<strong>' + titulo + '</strong><br>' : '');
        el.innerHTML = prefijo + html;
        el.style.display = 'block';
        el.classList.toggle('modo-ejercicio', tipo === 'ejercicio');
        el.classList.toggle('modo-ejemplo', tipo === 'ejemplo');
    } else {
        el.innerHTML = ''; el.style.display = 'none'; el.classList.remove('modo-ejercicio', 'modo-ejemplo');
    }
}

// Muestra (o limpia) un mensaje de error visible arriba del editor.
function arcMostrarErrorApi(mensaje) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;
    let box = document.getElementById('sim-api-error');
    if (!mensaje) {
        if (box) box.remove();
        return;
    }
    if (!box) {
        box = document.createElement('div');
        box.id = 'sim-api-error';
        box.className = 'sim-api-error';
        editorBody.parentNode.insertBefore(box, editorBody);
    }
    box.textContent = mensaje;
}

// ── Estado global ─────────────────────────────────────────────

const arcSim = new ArchivosSimulator();
let arcMonacoEditor = null;
let arcDecorations  = [];
let arcPlayTimer    = null;
let arcPlaying      = false;
let arcCurrentCode  = '';
let arcTemaActual   = '';

// ── Variables escalares editables ────────────────────────────

function arcExtraerVariablesEditables(ast) {
    if (!ast || !ast.body) return [];
    return ast.body
        .filter(n => n.type === 'VariableDeclaration' && n.init && n.init.type === 'Literal' && n.init.value !== null)
        .map(n => ({ name: n.name, dataType: n.dataType, raw: n.init.raw, value: n.init.value, line: n.line }));
}

function arcReconstruirCodigo(baseCode, variables, valoresNuevos) {
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

function arcRenderInputsVariables(variables, codigoBase) {
    const host = document.getElementById('arc-vars-editable');
    if (!host) return;
    if (!variables.length) { host.innerHTML = ''; host.dataset.arcVarsSignature = ''; return; }
    const signature = variables.map(v => v.name + ':' + v.dataType).join('|');
    if (host.dataset.arcVarsSignature === signature) return;
    host.dataset.arcVarsSignature = signature;

    host.innerHTML = variables.map(v => {
        const tipoInput = (v.dataType === 'int' || v.dataType === 'double' || v.dataType === 'float') ? 'number' : 'text';
        const inputHtml = v.dataType === 'bool'
            ? '<select class="arr-var-input" data-var="' + v.name + '">' +
              '<option value="true"' + (v.value === true ? ' selected' : '') + '>true</option>' +
              '<option value="false"' + (v.value === false ? ' selected' : '') + '>false</option>' +
              '</select>'
            : '<input class="arr-var-input" type="' + tipoInput + '" data-var="' + v.name + '" value="' + arcEscape(String(v.value)) + '">';
        return '<div class="arr-var-field"><label>' + arcEscape(v.dataType) + ' ' + arcEscape(v.name) + '</label>' + inputHtml + '</div>';
    }).join('');

    host.querySelectorAll('.arr-var-input').forEach(input => {
        const evento = input.tagName === 'SELECT' ? 'change' : 'input';
        input.addEventListener(evento, () => {
            const vals = {};
            host.querySelectorAll('.arr-var-input').forEach(inp => {
                vals[inp.dataset.var] = inp.tagName === 'SELECT' ? (inp.value === 'true') : inp.value;
            });
            const nuevoCodigo = arcReconstruirCodigo(codigoBase, variables, vals);
            if (arcMonacoEditor) arcMonacoEditor.setValue(nuevoCodigo);
            arcEjecutarSinTocarInputs(nuevoCodigo);
        });
    });
}

function arcEjecutarSinTocarInputs(codigo) {
    const first = arcSim.load(codigo);
    arcRender(first, arcSim.info());
    const btns = _arcBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { arcPlaying = false; btns[3].innerHTML = _ARC_ICON_PLAY; }
}

function arcCargarYEjecutar(codigo) {
    const first = arcSim.load(codigo);
    const variables = arcExtraerVariablesEditables(arcSim.lastAst);
    arcRenderInputsVariables(variables, codigo);
    arcRender(first, arcSim.info());
    const btns = _arcBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { arcPlaying = false; btns[3].innerHTML = _ARC_ICON_PLAY; }
}

// ── Panel de archivos virtuales ───────────────────────────────

function arcBuildFilesHtml(files, prevFiles) {
    if (!files || Object.keys(files).length === 0) return '';
    prevFiles = prevFiles || {};

    let html = '<div class="arc-fs-panel"><div class="arc-fs-header">Sistema de archivos virtual<span class="n">' + Object.keys(files).length + '</span></div>';
    for (const [nombre, contenido] of Object.entries(files)) {
        const esNuevo = !(nombre in prevFiles) || prevFiles[nombre] !== contenido;
        const lineas = contenido.split('\n');
        const preview = lineas.slice(0, 6).map(l => arcEscape(l)).join('<br>');
        const masLineas = lineas.length > 6 ? '<span class="arc-more">+' + (lineas.length - 6) + ' líneas más</span>' : '';
        html += '<div class="arc-file' + (esNuevo ? ' arc-file-changed' : '') + '">' +
            '<div class="arc-file-name">📄 ' + arcEscape(nombre) + '</div>' +
            '<div class="arc-file-content">' + preview + (masLineas ? '<br>' + masLineas : '') + '</div>' +
            '</div>';
    }
    html += '</div>';
    return html;
}

// ── Render de variables ───────────────────────────────────────

function arcBuildMemoriaHtml(state, prevState) {
    const ch = new Set(state.changed || []);
    let html = '';

    if (state.variables && state.variables.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
        state.variables.forEach(v => {
            const val = arcFmtVal(v.value, v.type);
            html += '<div class="cs-var-row' + (ch.has(v.name) ? ' cs-flash' : '') + '">' +
                arcEscape(v.type) + ' <b>' + arcEscape(v.name) + '</b> = ' + arcEscape(val) + '</div>';
        });
        html += '</div>';
    }

    const prevFiles = prevState ? prevState.files : {};
    html += arcBuildFilesHtml(state.files, prevFiles);

    return html;
}

// ── Highlight ─────────────────────────────────────────────────

function arcHighlight(line, isError) {
    if (!arcMonacoEditor) return;
    const cls = isError ? 'lineFalse' : 'lineHighlight';
    arcDecorations = arcMonacoEditor.deltaDecorations(arcDecorations, [{
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: cls }
    }]);
    arcMonacoEditor.revealLineInCenter(line);
}

function arcClearPanels() {
    if (arcMonacoEditor) arcDecorations = arcMonacoEditor.deltaDecorations(arcDecorations, []);
    ['panel-paso', 'panel-vars', 'panel-salida'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { id === 'panel-salida' ? el.textContent = '' : el.innerHTML = ''; }
    });
    const stepEl = document.querySelector('.ctrl-step');
    const fill = document.querySelector('.pbar i');
    if (stepEl) stepEl.textContent = 'Paso 0 / 0';
    if (fill) fill.style.width = '0%';
}

let _arcPrevState = null;

function arcRender(state, info) {
    if (!state) { arcClearPanels(); return; }

    const line = state.currentLine || 0;
    if (line > 0) arcHighlight(line, state.isError);

    const panelPaso = document.getElementById('panel-paso');
    if (panelPaso) {
        const src = (arcMonacoEditor && line > 0)
            ? arcEscape(arcMonacoEditor.getModel().getLineContent(line).trim()) : '';
        const noteClass = state.isError ? ' err' : '';
        panelPaso.innerHTML =
            (line > 0 ? '<div class="sim-line-ref">Línea ' + line + (src ? ': ' + src : '') + '</div>' : '') +
            (state.description ? '<div class="sim-note' + noteClass + '">' + arcEscape(state.description) + '</div>' : '');
    }

    const panelVars = document.getElementById('panel-vars');
    if (panelVars) panelVars.innerHTML = arcBuildMemoriaHtml(state, _arcPrevState);

    const panelSalida = document.getElementById('panel-salida');
    if (panelSalida) panelSalida.textContent = (state.output || []).join('\n');

    _arcPrevState = state;

    if (info && info.total > 0) {
        const stepEl = document.querySelector('.ctrl-step');
        if (stepEl) stepEl.textContent = 'Paso ' + (info.index + 1) + ' / ' + info.total;
        const fill = document.querySelector('.pbar i');
        if (fill) fill.style.width = ((info.index + 1) / info.total * 100) + '%';
    }
}

// ── Controles ─────────────────────────────────────────────────

function arcGetDelay() {
    const slider = document.getElementById('sim-speed-slider');
    return Math.round(2000 - ((slider ? parseInt(slider.value) : 40) / 100) * 1800);
}

function arcStopPlay(btns) {
    clearTimeout(arcPlayTimer);
    arcPlayTimer = null; arcPlaying = false;
    const btnR = (btns && btns[3]) ? btns[3] : _arcBtns()[3];
    if (btnR) btnR.innerHTML = _ARC_ICON_PLAY;
}

function arcConectarBotones() {
    const btns = _arcBtns();
    const [btnRei, btnAnt, btnSig, btnRep] = btns;

    if (btnRei) btnRei.onclick = () => { arcStopPlay(btns); arcCargarYEjecutar(arcCurrentCode); };
    if (btnAnt) btnAnt.onclick = () => {
        arcStopPlay(btns);
        const state = arcSim.prev();
        arcRender(state, arcSim.info());
        if (btnAnt) btnAnt.disabled = arcSim.info().index === 0;
    };
    if (btnSig) btnSig.onclick = () => {
        arcStopPlay(btns);
        const state = arcSim.next();
        arcRender(state, arcSim.info());
        if (btnAnt) btnAnt.disabled = arcSim.info().index === 0;
    };
    if (btnRep) btnRep.onclick = () => {
        if (arcPlaying) { arcStopPlay(btns); return; }
        arcPlaying = true;
        btnRep.innerHTML = _ARC_ICON_PAUSE;
        const tick = () => {
            if (!arcPlaying) return;
            const info = arcSim.info();
            if (info.index >= info.total - 1) { arcStopPlay(btns); return; }
            const state = arcSim.next();
            arcRender(state, arcSim.info());
            if (btnAnt) btnAnt.disabled = arcSim.info().index === 0;
            arcPlayTimer = setTimeout(tick, arcGetDelay());
        };
        arcPlayTimer = setTimeout(tick, arcGetDelay());
    };

    const slider = document.getElementById('sim-speed-slider');
    const speedVal = document.querySelector('.sim-speed-val');
    if (slider && speedVal) slider.oninput = () => { speedVal.textContent = slider.value + '%'; };
}

// ── CSS ───────────────────────────────────────────────────────

(function injectArcStyles() {
    if (document.getElementById('arc-styles')) return;
    const style = document.createElement('style');
    style.id = 'arc-styles';
    style.textContent = `
        /* Panel del filesystem virtual */
        .arc-fs-panel {
            background: #1a1d2a;
            border: 1px solid #3d4160;
            border-radius: 8px;
            padding: 8px 10px;
            margin-bottom: 8px;
        }
        .arc-fs-header {
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
        .arc-fs-header .n {
            background: #2d3050;
            color: #a0a8d4;
            border-radius: 10px;
            padding: 0 6px;
            font-size: 0.75em;
        }
        .arc-file {
            background: #0f1018;
            border: 1px solid #2d3050;
            border-radius: 6px;
            padding: 6px 8px;
            margin-bottom: 4px;
            transition: border-color 0.2s, background 0.2s;
        }
        .arc-file-changed {
            border-color: #04AA6D;
            background: #071a10;
            animation: arc-flash 0.5s ease;
        }
        @keyframes arc-flash {
            0%   { background: #0d3320; }
            100% { background: #071a10; }
        }
        .arc-file-name {
            font-size: 0.78rem;
            font-weight: 700;
            color: #04AA6D;
            font-family: 'Consolas', monospace;
            margin-bottom: 4px;
        }
        .arc-file-content {
            font-family: 'Consolas', monospace;
            font-size: 0.76rem;
            color: #c5cae9;
            background: #15161e;
            border-radius: 4px;
            padding: 4px 6px;
            line-height: 1.5;
            max-height: 120px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .arc-more {
            color: #7c85c2;
            font-size: 0.72rem;
            font-style: italic;
        }
        /* Inputs editables (reutiliza .arr-var-field / .arr-var-input) */
        #arc-vars-editable {
            display: flex;
            flex-wrap: wrap;
            gap: 14px;
            padding: 10px 14px;
            margin-bottom: 8px;
            background: #1e2130;
            border: 1px solid #3a3d4a;
            border-radius: 8px;
        }
        #arc-vars-editable:empty { display: none; }
    `;
    document.head.appendChild(style);
})();

// ── Inicialización (conectada a GET /api/subtemas/slug/:slug) ─

async function initArchivosSimulador(tema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    let items;
    try {
        const subtema = await arcObtenerDatosTema(tema);
        items = arcGetItemsDesdeSubtema(subtema);
        if (subtema._apiError) {
            arcMostrarErrorApi('No se pudo conectar con la API (' + subtema._apiError + '). Mostrando aviso de error.');
        } else {
            arcMostrarErrorApi(null);
        }
    } catch (e) {
        console.error('Error inicializando el simulador de archivos para "' + tema + '":', e);
        arcMostrarErrorApi('Error cargando el simulador: ' + e.message);
        items = [{ label: 'Ejemplo 1', codigo: '// Error cargando el simulador: ' + e.message, enunciado: null, esEjercicio: false }];
    }

    arcCurrentCode = items[0].codigo;

    // Pestañas
    let tabsEl = document.getElementById('sim-ejemplos-tabs');
    if (!tabsEl && items.length > 1) {
        tabsEl = document.createElement('div');
        tabsEl.id = 'sim-ejemplos-tabs';
        editorBody.parentNode.insertBefore(tabsEl, editorBody);
    }

    // Inputs de variables editables
    if (!document.getElementById('arc-vars-editable')) {
        const varsHost = document.createElement('div');
        varsHost.id = 'arc-vars-editable';
        editorBody.parentNode.insertBefore(varsHost, editorBody);
    }

    // Muestra (o esconde) el recuadro de enunciado propio del item activo;
    // el concepto general del tema vive aparte, en #tema-descripcion, y no
    // se toca aquí — sigue visible siempre.
    function mostrarDescripcionItem(it) {
        if (it.esEjercicio && it.enunciado) arcSetDescripcion(it.enunciado, 'ejercicio', it.titulo);
        else if (it.enunciado) arcSetDescripcion(it.enunciado, 'ejemplo', it.titulo);
        else arcSetDescripcion(null, null);
    }

    if (tabsEl) {
        tabsEl.innerHTML = items.map((it, i) =>
            '<button class="sim-tab' + (i === 0 ? ' activo' : '') +
            (it.esEjercicio ? ' ejercicio' : '') +
            '" data-idx="' + i + '">' + it.label + '</button>'
        ).join('');
        tabsEl.querySelectorAll('.sim-tab').forEach(btn => {
            btn.onclick = () => {
                arcStopPlay(_arcBtns());
                const idx = parseInt(btn.dataset.idx);
                const it = items[idx];
                tabsEl.querySelectorAll('.sim-tab').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');
                mostrarDescripcionItem(it);
                arcCurrentCode = it.codigo;
                if (arcMonacoEditor) arcMonacoEditor.setValue(it.codigo);
                arcCargarYEjecutar(it.codigo);
            };
        });
    }

    function crearEditorArc() {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            arcMonacoEditor = monaco.editor.create(editorBody, {
                value: arcCurrentCode,
                language: 'csharp',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                readOnly: true
            });
            arcConectarBotones();
            mostrarDescripcionItem(items[0]);
            arcCargarYEjecutar(arcCurrentCode);
        });
    }

    if (window.monaco) crearEditorArc();
    else if (window.require) crearEditorArc();
    else {
        const loader = document.createElement('script');
        loader.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.js';
        loader.onload = crearEditorArc;
        document.head.appendChild(loader);
    }
}

// ── Hook en cargarTema ────────────────────────────────────────

(function wrapCargarTemaArchivos() {
    const _prev = window.cargarTema;

    window.cargarTema = function (nombreTema) {
        // Limpiar estado propio al salir
        arcStopPlay(_arcBtns());
        if (arcMonacoEditor) {
            arcMonacoEditor.dispose();
            arcMonacoEditor = null;
            arcDecorations = [];
        }
        arcSim.clear();
        _arcPrevState = null;

        if (typeof _prev === 'function') _prev(nombreTema);

        if (nombreTema !== 'Archivos') return;

        arcTemaActual = nombreTema;
        arcPlaying = false;

        initArchivosSimulador(nombreTema); // ya es async, no necesita setTimeout
    };
})();
