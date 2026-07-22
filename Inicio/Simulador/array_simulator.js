// ============================================================
//  Simulador/array_simulator.js
//  Simulador paso a paso para "Arreglos unidimensionales" y
//  "Arreglos bidimensionales" (matrices).
//
//  Lee ejemplos/ejercicio desde la API (igual que simulator.js).
//  Mantiene ARR_EXAMPLES y ARR_EJERCICIOS como RESPALDO local: si la
//  API falla o no devuelve datos, el simulador sigue funcionando.
//
//  Panel del ciclo "for" mejorado: sustituye el nombre de la
//  variable por su valor actual (ej. "3 < numeros.Length", "3++").
//  Requiere el engine.js NUEVO (genera forCtx y read).
// ============================================================

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

// ── Iconos del botón reproducir/pausar ───────────────────────
const _ARR_ICON_PLAY  = '<img src="../img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
const _ARR_ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

// ── Botones por ID (compatibles con consolas.js) ─────────────
function _arrBtns() {
    return [
        document.getElementById('btn-reiniciar'),
        document.getElementById('btn-paso-anterior'),
        document.getElementById('btn-paso-siguiente'),
        document.getElementById('btn-reproducir')
    ];
}

// ── SnapshotManager ──────────────────────────────────────────

class ArrSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset()  { this.snaps = []; this.idx = -1; }
    load(snapshots) { this.snaps = snapshots || []; this.idx = this.snaps.length ? 0 : -1; }
    current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next()  { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev()  { if (this.idx > 0) this.idx--; return this.current(); }
    total() { return this.snaps.length; }
}

// ── Simulador (usa CSharpEngine como motor) ──────────────────

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
    next()  { return this.snap.next(); }
    prev()  { return this.snap.prev(); }
    clear() { this.snap.reset(); this.lastAst = null; }
    info()  { return { index: this.snap.idx, total: this.snap.total() }; }
}

// ════════════════════════════════════════════════════════════
//  EJEMPLOS Y EJERCICIOS — RESPALDO local (usado si la API falla)
// ════════════════════════════════════════════════════════════

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

const ARR_EJERCICIOS = {
    Array_unidimensional: {
        enunciado: `Una maestra registró las calificaciones de 5 alumnos. Crea un arreglo <code>int[]</code> de tamaño 5, llénalo con las calificaciones <strong>7, 8, 6, 9, 10</strong> y calcula el promedio del grupo usando un ciclo <code>for</code>.`,
        codigo:
`int[] calificaciones = new int[5];
calificaciones[0] = 7;
calificaciones[1] = 8;
calificaciones[2] = 6;
calificaciones[3] = 9;
calificaciones[4] = 10;

int suma = 0;
for (int i = 0; i < calificaciones.Length; i++) {
  suma += calificaciones[i];
}

double promedio = suma / calificaciones.Length;
Console.WriteLine("Suma total = " + suma);
Console.WriteLine("Promedio = " + promedio);`
    },
    Array_bidimensional: {
        enunciado: `Una tienda registra las ventas de 2 vendedores durante 3 días en una matriz <code>int[,]</code> de 2 filas por 3 columnas. Llena la matriz con valores de ejemplo y calcula el total de ventas de cada vendedor (cada fila) usando ciclos <code>for</code> anidados.`,
        codigo:
`int[,] ventas = new int[2,3];
ventas[0,0] = 100; ventas[0,1] = 150; ventas[0,2] = 120;
ventas[1,0] = 80;  ventas[1,1] = 200; ventas[1,2] = 90;

for (int f = 0; f < ventas.GetLength(0); f++) {
  int totalFila = 0;
  for (int c = 0; c < ventas.GetLength(1); c++) {
    totalFila += ventas[f,c];
  }
  Console.WriteLine("Vendedor " + (f + 1) + " vendio en total: " + totalFila);
}`
    }
};

// ════════════════════════════════════════════════════════════
//  CONEXIÓN CON LA API (con caché y respaldo local)
// ════════════════════════════════════════════════════════════

const arrCacheSubtemas = {};

function arrNormalizarEjemplos(codigo_ejemplo) {
    if (typeof codigo_ejemplo === 'string') return [codigo_ejemplo];
    if (Array.isArray(codigo_ejemplo)) return codigo_ejemplo;
    if (codigo_ejemplo && typeof codigo_ejemplo === 'object' && Array.isArray(codigo_ejemplo.ejemplos)) {
        return codigo_ejemplo.ejemplos;
    }
    return [];
}

// enunciados_ejemplo viaja aparte de codigo_ejemplo pero acepta la misma
// forma (string | array | {ejemplos:[...]}); se empareja por índice.
function arrNormalizarEnunciadosEjemplo(enunciados_ejemplo) {
    if (typeof enunciados_ejemplo === 'string') return [enunciados_ejemplo];
    if (Array.isArray(enunciados_ejemplo)) return enunciados_ejemplo;
    if (enunciados_ejemplo && typeof enunciados_ejemplo === 'object' && Array.isArray(enunciados_ejemplo.ejemplos)) {
        return enunciados_ejemplo.ejemplos;
    }
    return [];
}

async function arrObtenerDatosTema(slug) {
    if (arrCacheSubtemas[slug]) return arrCacheSubtemas[slug];
    try {
        if (!window.ApiClient || typeof window.ApiClient.obtenerSubtemaPorSlug !== 'function') {
            throw new Error('ApiClient.obtenerSubtemaPorSlug no está disponible');
        }
        const subtema = await window.ApiClient.obtenerSubtemaPorSlug(slug);
        if (!subtema) throw new Error('La API devolvió una respuesta vacía para "' + slug + '"');
        arrCacheSubtemas[slug] = subtema;
        return subtema;
    } catch (e) {
        console.warn(`Arreglos "${slug}" no encontrado en la API, usando respaldo local`, e);
        return {
            definicion: (window.temas && window.temas[slug]) ? window.temas[slug].definicion : '',
            codigo_ejemplo: null,
            _apiError: e.message
        };
    }
}

function arrGetItemsDesdeSubtema(subtema, slug) {
    if (!subtema || subtema.codigo_ejemplo === null || subtema.codigo_ejemplo === undefined) {
        return arrGetItemsLocal(slug);
    }

    const ejemplos = arrNormalizarEjemplos(subtema.codigo_ejemplo);
    if (!ejemplos.length) return arrGetItemsLocal(slug);

    const enunciadosEjemplo = arrNormalizarEnunciadosEjemplo(subtema.enunciados_ejemplo);
    const items = ejemplos.map((code, i) => ({
        label: ejemplos.length > 1 ? 'Ejemplo ' + (i + 1) : 'Ejemplo',
        codigo: code,
        enunciado: enunciadosEjemplo[i] || null,
        esEjercicio: false
    }));

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
    return items;
}

function arrGetItemsLocal(tema) {
    const ex = ARR_EXAMPLES[tema];
    const ejemplos = Array.isArray(ex) ? ex.slice() : (typeof ex === 'string' ? [ex] : ['']);
    const items = ejemplos.map((code, i) => ({
        label: 'Ejemplo ' + (i + 1),
        codigo: code,
        enunciado: null,
        esEjercicio: false
    }));
    const ej = ARR_EJERCICIOS[tema];
    if (ej) items.push({ label: 'Ejercicio', codigo: ej.codigo, enunciado: ej.enunciado, esEjercicio: true });
    return items;
}

// Recuadro del enunciado propio del ejemplo/ejercicio activo — va debajo del
// concepto general del tema (#tema-descripcion, que no se toca aquí).
// tipo: 'ejercicio' | 'ejemplo' | null (oculta el recuadro, no hay enunciado)
function arrSetDescripcion(html, tipo, titulo) {
    const elDesc = document.getElementById('tema-enunciado');
    if (!elDesc) return;
    if (html && tipo) {
        let prefijo = '';
        if (tipo === 'ejercicio') prefijo = '<span class="sim-ejercicio-badge">Ejercicio: </span>' + (titulo ? '<strong>' + titulo + '</strong><br>' : '');
        else if (tipo === 'ejemplo') prefijo = '<span class="sim-ejemplo-badge">Ejemplo: </span>';
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

function arrMostrarErrorApi(mensaje) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;
    let box = document.getElementById('arr-api-error');
    if (!mensaje) { if (box) box.remove(); return; }
    if (!box) {
        box = document.createElement('div');
        box.id = 'arr-api-error';
        box.className = 'sim-api-error';
        editorBody.parentNode.insertBefore(box, editorBody);
    }
    box.textContent = mensaje;
}

// ── Estado global del módulo ──────────────────────────────────

const arrSim = new ArraySimulator();
let arrMonacoEditor = null;
let arrDecorations  = [];
let arrPlayTimer    = null;
let arrPlaying      = false;
let arrCurrentCode  = '';
let arrTemaActual   = '';

// ── Variables escalares editables ────────────────────────────

function arrExtraerVariablesEditables(ast) {
    if (!ast || !ast.body) return [];
    return ast.body
        .filter(n => n.type === 'VariableDeclaration' && n.init && n.init.type === 'Literal' && n.init.value !== null)
        .map(n => ({ name: n.name, dataType: n.dataType, raw: n.init.raw, value: n.init.value, line: n.line }));
}

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
                    '<option value="true"'  + (v.value === true  ? ' selected' : '') + '>true</option>'  +
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

function arrEjecutarSinTocarInputs(codigo) {
    const first = arrSim.load(codigo);
    arrRender(first, arrSim.info());
    const btns = _arrBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { arrPlaying = false; btns[3].innerHTML = _ARR_ICON_PLAY; }
}

function arrCargarYEjecutar(codigo) {
    const first    = arrSim.load(codigo);
    const variables = arrExtraerVariablesEditables(arrSim.lastAst);
    arrRenderInputsVariables(variables, codigo);
    arrRender(first, arrSim.info());
    const btns = _arrBtns();
    if (btns[1]) btns[1].disabled = true;
    if (btns[3]) { arrPlaying = false; btns[3].innerHTML = _ARR_ICON_PLAY; }
}

// ── Render de memoria (variables, arreglos y matrices) ────────

// Panel del ciclo "for": muestra la variable con su VALOR ACTUAL
// sustituido dentro de la condición y del avance (ej. "3 < numeros.Length", "3++").
function arrBuildForBoxHtml(forCtx) {
    if (!forCtx) return '';
    const val    = forCtx.varValue !== null ? forCtx.varValue : '?';
    const valStr = arrEscape(String(val));
    // Sustituye el nombre de la variable por su valor numérico actual
    const varRe         = new RegExp('\\b' + forCtx.varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
    const condWithVal   = arrEscape(forCtx.condText.replace(varRe,   String(val)));
    const updateWithVal = arrEscape(forCtx.updateText.replace(varRe, String(val)));
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
                '<code class="sim-for-code">' + arrEscape(forCtx.varName) + ' = <b class="sim-for-t">' + valStr + '</b></code>' +
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

function arrBuildMemoriaHtml(state) {
    const ch = new Set(state.changed || []);
    const rd = new Set(state.read || []);
    let html = arrBuildForBoxHtml(state.forCtx);

    if (state.variables && state.variables.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Variables<span class="n">' + state.variables.length + '</span></div>';
        state.variables.forEach(v => {
            const f = arrFmtVal(v.value, v.type);
            const changed = ch.has(v.name);
            html += '<div class="cs-var-row' + (changed ? ' cs-flash' : '') + '">' +
                arrEscape(v.type) + ' <b>' + arrEscape(v.name) + '</b> = ' + arrEscape(f.text) + '</div>';
        });
        html += '</div>';
    }

    if (state.arrays && state.arrays.length) {
        html += '<div class="cs-mem-block"><div class="cs-mem-head">Arreglos<span class="n">' + state.arrays.length + '</span></div>';
        state.arrays.forEach(a => {
            html += '<div class="cs-arr"><div class="cs-arr-name">' + arrEscape(a.type) + '[] <b>' + arrEscape(a.name) + '</b><span class="meta">.Length = ' + a.length + '</span></div>';
            html += '<div class="cs-cells">';
            for (let i = 0; i < a.length; i++) {
                const val   = a.values[i];
                const isch  = ch.has(a.name + '[' + i + ']');
                const isrd  = !isch && rd.has(a.name + '[' + i + ']');
                const extra = isch ? ' cs-flash' : (isrd ? ' cs-read' : '');
                html += '<div class="cs-cell-wrap">' +
                    '<div class="cs-cell-idx' + (isrd ? ' cs-read-idx' : '') + '">' + i + '</div>' +
                    '<div class="cs-cell' + (val === null ? ' cs-null' : '') + extra + '">' + arrEscape(arrCellText(val)) + '</div>' +
                    '</div>';
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
                    const val   = m.values[r][c];
                    const key   = m.name + '[' + r + ',' + c + ']';
                    const isch  = ch.has(key);
                    const isrd  = !isch && rd.has(key);
                    const extra = isch ? ' cs-flash' : (isrd ? ' cs-read' : '');
                    html += '<td><div class="cs-mcell' + (val === null ? ' cs-null' : '') + extra + '">' + arrEscape(arrCellText(val)) + '</div></td>';
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
    if (panelPaso)   panelPaso.innerHTML    = '';
    if (panelVars)   panelVars.innerHTML    = '';
    if (panelSalida) panelSalida.textContent = '';
    if (stepEl)      stepEl.textContent     = 'Paso 0 / 0';
    if (fill)        fill.style.width       = '0%';
}

// ── Inicialización del editor con sistema de tabs (async) ─────

async function initArraySimulator(nombreTema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;

    arrTemaActual = nombreTema;

    // 1) Pide los datos a la API (con respaldo local si falla)
    let subtema, items;
    try {
        subtema = await arrObtenerDatosTema(nombreTema);
        items = arrGetItemsDesdeSubtema(subtema, nombreTema);

        if (subtema._apiError) {
            arrMostrarErrorApi('No se pudo conectar con la API de arreglos (' + subtema._apiError + '). Mostrando datos de respaldo.');
        } else {
            arrMostrarErrorApi(null);
        }
    } catch (e) {
        console.error('Error inicializando el simulador de arreglos para "' + nombreTema + '":', e);
        items = arrGetItemsLocal(nombreTema);
        arrMostrarErrorApi('Error cargando datos: ' + e.message + '. Mostrando respaldo local.');
    }

    if (!items || !items.length) {
        items = [{ label: 'Ejemplo 1', codigo: '// No se pudo cargar el ejemplo.', enunciado: null, esEjercicio: false }];
    }

    // Panel de variables editables
    if (!document.getElementById('arr-vars-editable')) {
        const varsHost = document.createElement('div');
        varsHost.id = 'arr-vars-editable';
        editorBody.parentNode.insertBefore(varsHost, editorBody);
    }

    // Tabs (solo si hay más de un item)
    if (!document.getElementById('arr-ejemplos-tabs') && items.length > 1) {
        const tabs = document.createElement('div');
        tabs.id = 'arr-ejemplos-tabs';
        tabs.innerHTML = items.map((it, i) =>
            '<button class="sim-tab' + (i === 0 ? ' activo' : '') +
            (it.esEjercicio ? ' ejercicio' : '') +
            '" data-idx="' + i + '">' + it.label + '</button>'
        ).join('');
        editorBody.parentNode.insertBefore(tabs, editorBody.parentNode.querySelector('#arr-vars-editable'));
    }

    const codigoInicial = items[0].codigo;
    arrCurrentCode = codigoInicial;

    // Muestra (o esconde) el recuadro de enunciado propio del item activo;
    // el concepto general del tema vive aparte, en #tema-descripcion, y no
    // se toca aquí — sigue visible siempre.
    function mostrarDescripcionItem(it) {
        if (it.esEjercicio && it.enunciado) {
            arrSetDescripcion(it.enunciado, 'ejercicio', it.titulo);
        } else if (it.enunciado) {
            arrSetDescripcion(it.enunciado, 'ejemplo');
        } else {
            arrSetDescripcion(null, null);
        }
    }

    function activarTabs() {
        const tabs = document.getElementById('arr-ejemplos-tabs');
        if (!tabs) return;
        tabs.querySelectorAll('.sim-tab').forEach(btn => {
            btn.onclick = () => {
                arrStopPlay(_arrBtns());
                const idx = parseInt(btn.dataset.idx);
                const it  = items[idx];

                tabs.querySelectorAll('.sim-tab').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');

                mostrarDescripcionItem(it);

                arrCurrentCode = it.codigo;
                if (arrMonacoEditor) arrMonacoEditor.setValue(it.codigo);
                arrCargarYEjecutar(it.codigo);
            };
        });
    }

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
            activarTabs();
            mostrarDescripcionItem(items[0]);
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
    if (info.index >= info.total - 1) { arrStopPlay(btns); return; }
    const state = arrSim.next();
    arrRender(state, arrSim.info());
    if (btns[1]) btns[1].disabled = (arrSim.info().index <= 0);
    arrPlayTimer = setTimeout(() => arrAutoPlay(btns), arrGetDelay());
}

// ── Conexión de botones ───────────────────────────────────────

function arrConectarBotones() {
    const btns = _arrBtns();

    if (btns[0]) btns[0].onclick = () => {
        arrStopPlay(btns);
        const codigoActual = arrMonacoEditor ? arrMonacoEditor.getValue() : arrCurrentCode;
        arrEjecutarSinTocarInputs(codigoActual);
    };

    if (btns[1]) {
        btns[1].disabled = true;
        btns[1].onclick = () => {
            arrStopPlay(btns);
            const state = arrSim.prev();
            arrRender(state, arrSim.info());
            btns[1].disabled = (arrSim.info().index <= 0);
        };
    }

    if (btns[2]) btns[2].onclick = () => {
        arrStopPlay(btns);
        const state = arrSim.next();
        arrRender(state, arrSim.info());
        if (btns[1]) btns[1].disabled = (arrSim.info().index <= 0);
    };

    if (btns[3]) btns[3].onclick = () => {
        if (arrPlaying) { arrStopPlay(btns); return; }
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
            valLbl.textContent = (parseFloat(slider.value) / 40).toFixed(1) + '×';
        });
    }
}

// ── Hook a cargarTema ─────────────────────────────────────────

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