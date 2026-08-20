// Simulador paso a paso del subtema "Recursividad": usa CSharpEngine, que soporta funciones y return.

// Escapa caracteres especiales de HTML para mostrar texto sin romper el marcado.
function recEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Formatea un valor tal como se vería escrito en código C# (comillas, true/false).
function recFmtVal(v, type) {
    if (v === null || v === undefined) return 'null';
    if (type === 'bool' || typeof v === 'boolean') return v ? 'true' : 'false';
    if (type === 'char') return "'" + v + "'";
    if (type === 'string' || typeof v === 'string') return '"' + v + '"';
    return String(v);
}

// Iconos del botón reproducir/pausar.
const _REC_ICON_PLAY  = '<img src="../img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
const _REC_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

// Devuelve los cuatro botones de control de pasos por su id.
function _recBtns() {
    return [
        document.getElementById('btn-reiniciar'),
        document.getElementById('btn-paso-anterior'),
        document.getElementById('btn-paso-siguiente'),
        document.getElementById('btn-reproducir')
    ];
}

// Controla el índice actual dentro de la lista de snapshots (pasos) de ejecución.
class RecSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset()  { this.snaps = []; this.idx = -1; }
    load(snapshots) { this.snaps = snapshots || []; this.idx = this.snaps.length ? 0 : -1; }
    current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next()  { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev()  { if (this.idx > 0) this.idx--; return this.current(); }
    total() { return this.snaps.length; }
}

// Ejecuta código C# con CSharpEngine y expone la navegación paso a paso.
class RecursividadSimulator {
    constructor() { this.snap = new RecSnapMgr(); this.lastAst = null; }
    // Compila y ejecuta el código, arma la lista de snapshots (o un único snapshot de error) y devuelve el primero.
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

// Caché de subtemas ya obtenidos desde la API, por slug.
const recCacheSubtemas = {};

// Obtiene los datos del subtema "Recursividad" desde la API, usando caché.
async function recObtenerDatosTema(slug) {
    if (recCacheSubtemas[slug]) return recCacheSubtemas[slug];
    try {
        if (!window.ApiClient || typeof window.ApiClient.obtenerSubtemaPorSlug !== 'function') {
            throw new Error('window.ApiClient.obtenerSubtemaPorSlug no está disponible');
        }
        const subtema = await window.ApiClient.obtenerSubtemaPorSlug(slug);
        if (!subtema) throw new Error('La API devolvió una respuesta vacía para "' + slug + '"');
        recCacheSubtemas[slug] = subtema;
        return subtema;
    } catch (e) {
        console.warn(`Subtema "${slug}" no encontrado en la API`, e);
        return { codigo_ejemplo: null, _apiError: e.message };
    }
}

// Arma la lista de pestañas de ejemplo/caso a partir de los datos del subtema.
function recGetItemsDesdeSubtema(subtema) {
    if (subtema.codigo_ejemplo === null) {
        return [{ label: 'Ejemplo 1', codigo: '// No se pudo cargar el ejemplo desde la API.', enunciado: null }];
    }

    // Los ejemplos vienen de su propia tabla, ya ordenados por el backend.
    const ejemplosDb = Array.isArray(subtema.ejemplos) ? subtema.ejemplos : [];
    const items = ejemplosDb.map((ej, i) => ({
        label: ejemplosDb.length > 1 ? 'Ejemplo ' + (i + 1) : 'Ejemplo',
        codigo: ej.codigo || '',
        enunciado: ej.enunciado || null,
        titulo: ej.titulo || null,
        esEjercicio: false
    }));

    // Toma solo los ejercicios modo='demostracion'; los de "Ponte a prueba" (modo='practica')
    // no se muestran aquí porque su codigo_csharp es la solución que el alumno debe encontrar.
    const ejercicios = (Array.isArray(subtema.ejercicios) ? subtema.ejercicios : [])
        .filter(ej => (ej.modo || 'demostracion') === 'demostracion');
    ejercicios.forEach((ej, i) => {
        items.push({
            label: ejercicios.length > 1 ? 'Caso ' + (i + 1) : 'Caso',
            codigo: ej.codigo_csharp,
            enunciado: ej.descripcion,
            titulo: ej.titulo || null,
            esEjercicio: true
        });
    });

    if (!items.length) {
        items.push({ label: 'Ejemplo 1', codigo: '// La API no devolvió ejemplos para este tema.', enunciado: null });
    }
    return items;
}

// Muestra u oculta el recuadro de enunciado del ejemplo/caso activo, debajo del concepto general del tema.
function recSetDescripcion(html, tipo, titulo) {
    const elDesc = document.getElementById('tema-enunciado');
    if (!elDesc) return;
    if (html && tipo) {
        let prefijo = '';
        if (tipo === 'Caso') prefijo = '<span class="sim-ejercicio-badge">Caso: </span>' + (titulo ? '<strong>' + titulo + '</strong><br>' : '');
        else if (tipo === 'ejemplo') prefijo = '<span class="sim-ejemplo-badge">Ejemplo: </span>' + (titulo ? '<strong>' + titulo + '</strong><br>' : '');
        elDesc.innerHTML = prefijo + html;
        elDesc.style.display = 'block';
        elDesc.classList.toggle('modo-ejercicio', tipo === 'ejercicio');
        elDesc.classList.toggle('modo-ejemplo', tipo === 'ejemplo');
    } else {
        elDesc.innerHTML = '';
        elDesc.style.display = 'none';
        elDesc.classList.remove('modo-ejercicio', 'modo-ejemplo');
    }
}

// Instancia del simulador y estado del editor/reproducción del módulo.
const recSim = new RecursividadSimulator();
let recMonacoEditor = null;
let recDecorations  = [];
let recPlayTimer    = null;
let recPlaying      = false;
let recCurrentCode  = '';
let recTemaActual   = '';

// Encuentra declaraciones de variables con valor literal en el cuerpo principal, editables por el usuario.
function recExtraerVariablesEditables(ast) {
    if (!ast || !ast.body) return [];
    return ast.body
        .filter(n => n.type === 'VariableDeclaration' && n.init && n.init.type === 'Literal' && n.init.value !== null)
        .map(n => ({ name: n.name, dataType: n.dataType, raw: n.init.raw, value: n.init.value, line: n.line }));
}

// Reescribe en el código fuente la línea de cada variable editada con su nuevo valor.
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

// Dibuja un input por cada variable editable y reejecuta el código cuando cambia su valor.
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

// Reejecuta el código y renderiza el primer paso, sin reconstruir los inputs de variables.
function recEjecutarSinTocarInputs(codigo) {
    const first = recSim.load(codigo);
    recRender(first, recSim.info());
    const btns = _recBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { recPlaying = false; btns[3].innerHTML = _REC_ICON_PLAY; }
}

// Carga el código, reconstruye los inputs de variables editables y renderiza el primer paso.
function recCargarYEjecutar(codigo) {
    const first = recSim.load(codigo);
    const variables = recExtraerVariablesEditables(recSim.lastAst);
    recRenderInputsVariables(variables, codigo);
    recRender(first, recSim.info());
    const btns = _recBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { recPlaying = false; btns[3].innerHTML = _REC_ICON_PLAY; }
}

// Renderiza la pila de llamadas de mayor a menor profundidad: la llamada externa arriba sin
// sangría y cada llamada anidada debajo con más sangría; si resaltarActual es true, ilumina la
// última (la llamada activa) porque el paso actual usa su resultado en un desglose de suma/multiplicación.
function recBuildCallStackHtml(callStack, resaltarActual) {
    if (!callStack || !callStack.length) return '';
    let html = '<div class="rec-stack-panel"><div class="rec-stack-header">Pila de llamadas<span class="n">' + callStack.length + '</span></div>';
    for (let i = 0; i < callStack.length; i++) {
        const frame = callStack[i];
        const argsStr = Object.entries(frame.args).map(([k, v]) => k + ' = ' + recEscape(String(v))).join(', ');
        const depth = i;
        const esActual = i === callStack.length - 1 && resaltarActual;
        html += '<div class="rec-frame' + (esActual ? ' rec-frame-activo' : '') + '" style="margin-left:' + (depth * 12) + 'px">' +
            '<span class="rec-frame-name">' + recEscape(frame.name) + '</span>' +
            '<span class="rec-frame-args">(' + recEscape(argsStr) + ')</span>' +
            '</div>';
    }
    html += '</div>';
    return html;
}

// Reconoce una asignación de la forma "x = a + b" o "x = a * b" (ej. "resultado = n * anterior"),
// para poder mostrar el desglose "n × anterior = 120" en vez de solo el resultado "120".
const REC_BINOP_LINE_RE = /^(?:int|double|float|string|bool|char)?\s*([A-Za-z_]\w*)\s*=\s*(\w+)\s*([+*])\s*(\w+)\s*;?$/;

// Arma el texto "operando1 op operando2 = resultado" para una asignación reconocida por REC_BINOP_LINE_RE.
function recDesglosarBinop(match, val) {
    if (!match) return null;
    const simbolo = match[3] === '*' ? '×' : match[3];
    return recEscape(match[2]) + ' ' + simbolo + ' ' + recEscape(match[4]) + ' = ' + recEscape(val);
}

// Renderiza la pila de llamadas y el panel de variables (con desglose de la operación si aplica).
function recBuildMemoriaHtml(state) {
    const ch = new Set(state.changed || []);

    const lineaActual = (recMonacoEditor && state.currentLine)
        ? recMonacoEditor.getModel().getLineContent(state.currentLine).trim()
        : '';
    const binopMatch = lineaActual.match(REC_BINOP_LINE_RE);
    const seMuestraDesglose = !!(binopMatch && ch.has(binopMatch[1]));

    let html = recBuildCallStackHtml(state.callStack, seMuestraDesglose);

    if (state.variables && state.variables.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
        state.variables.forEach(v => {
            const val = recFmtVal(v.value, v.type);
            const changed = ch.has(v.name);
            const desglose = (changed && binopMatch && binopMatch[1] === v.name) ? recDesglosarBinop(binopMatch, val) : null;
            html += '<div class="cs-var-row' + (changed ? ' cs-flash' : '') + '">' +
                recEscape(v.type) + ' <b>' + recEscape(v.name) + '</b> = ' + (desglose || recEscape(val)) + '</div>';
        });
        html += '</div>';
    }

    return html;
}

// Resalta la línea actual en el editor Monaco.
function recHighlight(line, isError) {
    if (!recMonacoEditor) return;
    const cls = isError ? 'lineFalse' : 'lineHighlight';
    recDecorations = recMonacoEditor.deltaDecorations(recDecorations, [{
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: cls }
    }]);
    recMonacoEditor.revealLineInCenter(line);
}

// Deja todos los paneles del paso en su estado vacío inicial.
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

// Renderiza un paso completo: resalta la línea, actualiza paneles y la barra de progreso.
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

// Calcula el retardo entre pasos de auto-reproducción a partir del slider de velocidad.
function recGetDelay() {
    const slider = document.getElementById('sim-speed-slider');
    const val = slider ? parseInt(slider.value) : 40;
    return Math.round(2000 - (val / 100) * 1800);
}

// Detiene la auto-reproducción y restaura el ícono del botón reproducir.
function recStopPlay(btns) {
    clearTimeout(recPlayTimer);
    recPlayTimer = null;
    recPlaying = false;
    const btnR = (btns && btns[3]) ? btns[3] : _recBtns()[3];
    if (btnR) btnR.innerHTML = _REC_ICON_PLAY;
}

// Conecta los botones de control de pasos y crea el slider de velocidad si no existe.
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

    const controls = document.querySelector('.editor-controls');
    if (controls && !document.getElementById('sim-speed-slider')) {
        const row = document.createElement('div');
        row.className = 'sim-speed-row';
        row.innerHTML =
            '<label>Velocidad</label>' +
            '<input type="range" id="sim-speed-slider" min="1" max="100" value="40">' +
            '<span class="sim-speed-val" id="sim-speed-val">1×</span>';
        controls.appendChild(row);
    }

    const slider = document.getElementById('sim-speed-slider');
    const speedVal = document.querySelector('.sim-speed-val');
    if (slider && speedVal) {
        slider.oninput = () => { speedVal.textContent = (parseFloat(slider.value) / 40).toFixed(1) + '×'; };
    }
}

// Inyecta el CSS de la pila de llamadas y del panel de este simulador una sola vez.
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

// Muestra o limpia un mensaje de error visible arriba del editor.
function recMostrarErrorApi(mensaje) {
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

// Punto de entrada: carga datos desde la API, arma pestañas/editor e inicia Monaco.
async function initRecursividadSimulador(tema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    let items;
    try {
        const subtema = await recObtenerDatosTema(tema);
        items = recGetItemsDesdeSubtema(subtema);

        // Título y definición del tema vienen de la base de datos.
        mostrarDescripcion(subtema.titulo || '', subtema.definicion || '');

        if (subtema._apiError) {
            recMostrarErrorApi('No se pudo conectar con la API (' + subtema._apiError + '). Mostrando aviso de error.');
        } else {
            recMostrarErrorApi(null);
        }
    } catch (e) {
        console.error('Error inicializando el simulador de recursividad para "' + tema + '":', e);
        recMostrarErrorApi('Error cargando el simulador: ' + e.message);
        items = [{ label: 'Ejemplo 1', codigo: '// Error cargando el simulador: ' + e.message, enunciado: null }];
    }

    recCurrentCode = items[0].codigo;

    // Contenedor de pestañas de ejemplo/caso (va encima de los inputs).
    let tabsEl = document.getElementById('sim-ejemplos-tabs');
    if (!tabsEl && items.length > 1) {
        tabsEl = document.createElement('div');
        tabsEl.id = 'sim-ejemplos-tabs';
        editorBody.parentNode.insertBefore(tabsEl, editorBody);
    }

    // Contenedor de los inputs de variables editables (debajo de las pestañas).
    if (!document.getElementById('rec-vars-editable')) {
        const varsHost = document.createElement('div');
        varsHost.id = 'rec-vars-editable';
        editorBody.parentNode.insertBefore(varsHost, editorBody);
    }

    // Muestra u oculta el enunciado propio del item activo (el concepto general del tema no se toca aquí).
    function mostrarDescripcionItem(it) {
        if (it.esEjercicio && it.enunciado) recSetDescripcion(it.enunciado, 'Caso', it.titulo);
        else if (it.enunciado) recSetDescripcion(it.enunciado, 'ejemplo', it.titulo);
        else recSetDescripcion(null, null);
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
                mostrarDescripcionItem(it);
                recCurrentCode = it.codigo;
                if (recMonacoEditor) recMonacoEditor.setValue(it.codigo);
                recCargarYEjecutar(it.codigo);
            };
        });
    }

    // Crea la instancia del editor Monaco y ejecuta el código inicial.
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
            mostrarDescripcionItem(items[0]);
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
}

// Envuelve cargarTema para inicializar/limpiar este simulador cuando corresponde.
(function wrapCargarTemaRecursividad() {
    const _prevCargarTema = window.cargarTema;

    window.cargarTema = function (nombreTema) {
        // Limpia el estado propio de este simulador al salir del tema.
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

        initRecursividadSimulador(nombreTema);
    };
})();
