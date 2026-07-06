/* Simulator.js */

function simFmt(v) {
    if (typeof v === 'string') return '"' + v + '"';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v === undefined || v === null) return 'null';
    if (Array.isArray(v)) return '[' + v.map(x => simFmt(x)).join(', ') + ']';
    return String(v);
}

function simEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

class SimVariables {
    constructor() { this.map = {}; }
    has(n) { return Object.prototype.hasOwnProperty.call(this.map, n); }
    set(n, v) { this.map[n] = v; }
    get(n) { return this.map[n]; }
    snapshot() { return { ...this.map }; }
}

class SimScope {
    constructor(parent = null) { this.parent = parent; this.frame = new SimVariables(); }
    declare(name, value) { this.frame.set(name, value); }
    set(name, value) {
        let s = this;
        while (s) { if (s.frame.has(name)) { s.frame.set(name, value); return; } s = s.parent; }
        this.frame.set(name, value);
    }
    get(name) {
        let s = this;
        while (s) { if (s.frame.has(name)) return s.frame.get(name); s = s.parent; }
        return undefined;
    }
    snapshot() {
        const chain = []; let s = this;
        while (s) { chain.unshift(s); s = s.parent; }
        const out = {};
        for (const sc of chain) Object.assign(out, sc.frame.snapshot());
        return out;
    }
}

class SimSnapMgr {
    constructor() { this.snaps = []; this.idx = -1; }
    reset() { this.snaps = []; this.idx = -1; }
    capture(state) { this.snaps.push(state); }
    begin() { this.idx = this.snaps.length ? 0 : -1; }
    current() { return this.idx >= 0 ? this.snaps[this.idx] : null; }
    next() { if (this.idx < this.snaps.length - 1) this.idx++; return this.current(); }
    prev() { if (this.idx > 0) this.idx--; return this.current(); }
    total() { return this.snaps.length; }
}

function simTokenize(code) {
    const tokens = []; let i = 0, line = 1;
    const KW = new Set(['int', 'string', 'bool', 'double', 'float', 'char', 'long', 'var',
        'if', 'else', 'switch', 'case', 'default', 'break', 'for', 'while', 'do', 'return', 'new', 'true', 'false']);
    const TWO = ['==', '!=', '<=', '>=', '&&', '||'];
    const isDigit = c => c >= '0' && c <= '9';
    const isIdStart = c => /[A-Za-z_]/.test(c);
    const isId = c => /[A-Za-z0-9_]/.test(c);

    while (i < code.length) {
        const c = code[i];
        if (c === '\n') { line++; i++; continue; }
        if (/\s/.test(c)) { i++; continue; }
        if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }

        if (c === '"') {
            let j = i + 1, s = '';
            while (j < code.length && code[j] !== '"') {
                if (code[j] === '\\' && code[j + 1]) {
                    s += ({ n: '\n', t: '\t', '"': '"', '\\': '\\' })[code[j + 1]] || code[j + 1];
                    j += 2; continue;
                }
                s += code[j++];
            }
            tokens.push({ type: 'string', value: s, line }); i = j + 1; continue;
        }
        if (isDigit(c)) {
            let n = '';
            while (i < code.length && (isDigit(code[i]) || code[i] === '.')) n += code[i++];
            tokens.push({ type: 'number', value: parseFloat(n), isInt: !n.includes('.'), line }); continue;
        }
        if (isIdStart(c)) {
            let id = '';
            while (i < code.length && isId(code[i])) id += code[i++];
            tokens.push({ type: KW.has(id) ? 'keyword' : 'ident', value: id, line }); continue;
        }
        const two = code.substr(i, 2);
        if (TWO.includes(two)) { tokens.push({ type: 'op', value: two, line }); i += 2; continue; }
        if ('(){};,.:?'.includes(c)) { tokens.push({ type: 'punct', value: c, line }); i++; continue; }
        if ('[]'.includes(c)) { tokens.push({ type: 'punct', value: c, line }); i++; continue; }
        if ('+-*/%=<>!'.includes(c)) { tokens.push({ type: 'op', value: c, line }); i++; continue; }
        i++;
    }
    tokens.push({ type: 'eof', value: null, line });
    return tokens;
}

const SIM_PREC = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };
const SIM_TYPES = ['int', 'string', 'bool', 'double', 'float', 'char', 'long', 'var'];

function simExprStr(n) {
    if (!n) return '';
    switch (n.type) {
        case 'Literal': return typeof n.value === 'string' ? '"' + n.value + '"' : String(n.value);
        case 'Ident': return n.name;
        case 'Binary': return simExprStr(n.left) + ' ' + n.op + ' ' + simExprStr(n.right);
        case 'Ternary': return simExprStr(n.cond) + ' ? ' + simExprStr(n.whenTrue) + ' : ' + simExprStr(n.whenFalse);
        default: return '';
    }
}

class SimParser {
    constructor(tokens) { this.tokens = tokens; this.pos = 0; }
    peek(n = 0) { return this.tokens[this.pos + n]; }
    next() { return this.tokens[this.pos++]; }
    check(t, v) { const tok = this.peek(); return tok.type === t && (v === undefined || tok.value === v); }
    match(t, v) { return this.check(t, v) ? this.next() : null; }
    expect(t, v) {
        if (this.check(t, v)) return this.next();
        const tok = this.peek();
        throw new Error('Sintaxis: se esperaba "' + (v ?? t) + '" en línea ' + tok.line);
    }

    parseProgram() {
        const body = [];
        while (!this.check('eof')) body.push(this.parseStmt());
        return { type: 'Program', body };
    }

    parseStmt() {
        const t = this.peek();
        if (t.type === 'keyword') {
            if (t.value === 'if') return this.parseIf();
            if (t.value === 'switch') return this.parseSwitch();
            if (t.value === 'for') return this.parseFor();
            if (t.value === 'while') return this.parseWhile();
            if (t.value === 'do') return this.parseDoWhile();
            if (t.value === 'break') { this.next(); this.match('punct', ';'); return { type: 'Break', line: t.line }; }
            if (SIM_TYPES.includes(t.value)) return this.parseVarDecl();
        }
        if (t.type === 'ident') {
            if (t.value === 'Console') return this.parsePrint();
            const after = this.peek(1);
            if (after && after.type === 'op' && after.value === '=') return this.parseAssign();
        }
        const line = t.line;
        const expr = this.parseExpr();
        this.match('punct', ';');
        return { type: 'ExprStmt', expr, line };
    }

    parseVarDecl() {
        const line = this.peek().line;
        const varType = this.next().value;
        const name = this.expect('ident').value;
        if (this.match('op', '=')) {
            const expr = this.parseExpr();
            this.match('punct', ';');
            return { type: 'VarDecl', varType, name, expr, line };
        }
        this.match('punct', ';');
        return { type: 'VarDecl', varType, name, expr: { type: 'Literal', value: null }, line };
    }

    parseAssign() {
        const line = this.peek().line;
        const name = this.expect('ident').value;
        this.expect('op', '=');
        const expr = this.parseExpr();
        this.match('punct', ';');
        return { type: 'Assign', name, expr, line };
    }

    parsePrint() {
        const line = this.peek().line;
        this.expect('ident', 'Console');
        this.expect('punct', '.');
        this.expect('ident');
        this.expect('punct', '(');
        const expr = this.check('punct', ')') ? { type: 'Literal', value: '' } : this.parseExpr();
        this.expect('punct', ')');
        this.match('punct', ';');
        return { type: 'Print', expr, line };
    }

    parseIf() {
        const tok = this.expect('keyword', 'if');
        this.expect('punct', '(');
        const cond = this.parseExpr();
        this.expect('punct', ')');
        const clauses = [{ cond, body: this.parseBlock(), line: tok.line }];
        while (this.check('keyword', 'else')) {
            const etok = this.next();
            if (this.check('keyword', 'if')) {
                this.next();
                this.expect('punct', '(');
                const c = this.parseExpr();
                this.expect('punct', ')');
                clauses.push({ cond: c, body: this.parseBlock(), line: etok.line });
            } else {
                clauses.push({ cond: null, body: this.parseBlock(), line: etok.line });
                break;
            }
        }
        return { type: 'If', clauses, line: tok.line };
    }

    parseSwitch() {
        const tok = this.expect('keyword', 'switch');
        this.expect('punct', '(');
        const expr = this.parseExpr();
        this.expect('punct', ')');
        this.expect('punct', '{');
        const cases = [];
        while (!this.check('punct', '}')) {
            if (this.check('keyword', 'case')) {
                const ctok = this.next();
                const value = this.parseExpr();
                this.expect('punct', ':');
                const body = this.parseCaseBody();
                cases.push({ type: 'case', value, body, line: ctok.line });
            } else if (this.check('keyword', 'default')) {
                const dtok = this.next();
                this.expect('punct', ':');
                const body = this.parseCaseBody();
                cases.push({ type: 'default', body, line: dtok.line });
            } else {
                throw new Error('Sintaxis: se esperaba "case" o "default" en línea ' + this.peek().line);
            }
        }
        this.expect('punct', '}');
        return { type: 'Switch', expr, cases, line: tok.line };
    }

    parseCaseBody() {
        const body = [];
        while (!this.check('keyword', 'case') && !this.check('keyword', 'default') && !this.check('punct', '}')) {
            body.push(this.parseStmt());
        }
        return body;
    }

    parseFor() {
        const tok = this.expect('keyword', 'for');
        this.expect('punct', '(');

        // init: "int i = 0"  o  "i = 0"
        let init = null;
        if (SIM_TYPES.includes(this.peek().value) && this.peek().type === 'keyword') {
            const line = this.peek().line;
            const varType = this.next().value;
            const name = this.expect('ident').value;
            this.expect('op', '=');
            const val = this.parseExpr();
            this.expect('punct', ';');
            init = { type: 'VarDecl', varType, name, expr: val, line };
        } else if (this.check('ident')) {
            const line = this.peek().line;
            const name = this.expect('ident').value;
            this.expect('op', '=');
            const val = this.parseExpr();
            this.expect('punct', ';');
            init = { type: 'Assign', name, expr: val, line };
        } else {
            this.expect('punct', ';');
        }

        // condición
        const cond = this.parseExpr();
        this.expect('punct', ';');

        // update: "i = i + 1"
        const updLine = this.peek().line;
        const updName = this.expect('ident').value;
        this.expect('op', '=');
        const updExpr = this.parseExpr();
        const update = { type: 'Assign', name: updName, expr: updExpr, line: updLine };

        this.expect('punct', ')');
        const body = this.parseBlock();
        return { type: 'For', init, cond, update, body, line: tok.line };
    }

    parseWhile() {
        const tok = this.expect('keyword', 'while');
        this.expect('punct', '(');
        const cond = this.parseExpr();
        this.expect('punct', ')');
        const body = this.parseBlock();
        return { type: 'While', cond, body, line: tok.line, isDoWhile: false };
    }

    parseDoWhile() {
        const tok = this.expect('keyword', 'do');
        const body = this.parseBlock();
        this.expect('keyword', 'while');
        this.expect('punct', '(');
        const cond = this.parseExpr();
        this.expect('punct', ')');
        this.match('punct', ';');
        return { type: 'While', cond, body, line: tok.line, isDoWhile: true };
    }

    parseBlock() {
        if (this.match('punct', '{')) {
            const body = [];
            while (!this.check('punct', '}') && !this.check('eof')) body.push(this.parseStmt());
            this.expect('punct', '}');
            return body;
        }
        return [this.parseStmt()];
    }

    parseExpr() { return this.parseTernary(); }

    parseTernary() {
        const cond = this.parseBinary(0);
        if (this.check('punct', '?')) {
            this.next();
            const whenTrue = this.parseExpr();
            this.expect('punct', ':');
            const whenFalse = this.parseExpr();
            return { type: 'Ternary', cond, whenTrue, whenFalse };
        }
        return cond;
    }

    parseBinary(minP) {
        let left = this.parseUnary();
        while (true) {
            const t = this.peek(); if (t.type !== 'op') break;
            const p = SIM_PREC[t.value]; if (p === undefined || p < minP) break;
            this.next();
            left = { type: 'Binary', op: t.value, left, right: this.parseBinary(p + 1) };
        }
        return left;
    }

    parseUnary() {
        const t = this.peek();
        if (t.type === 'op' && (t.value === '-' || t.value === '!')) {
            this.next();
            return { type: 'Binary', op: t.value === '!' ? '==' : '-', left: { type: 'Literal', value: 0 }, right: this.parseUnary() };
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        const t = this.next();
        if (t.type === 'number') return { type: 'Literal', value: t.value };
        if (t.type === 'string') return { type: 'Literal', value: t.value };
        if (t.type === 'keyword' && t.value === 'true') return { type: 'Literal', value: true };
        if (t.type === 'keyword' && t.value === 'false') return { type: 'Literal', value: false };
        if (t.type === 'ident') return { type: 'Ident', name: t.value };
        if (t.type === 'punct' && t.value === '(') {
            const e = this.parseExpr();
            this.expect('punct', ')');
            return e;
        }
        throw new Error('Sintaxis: expresión inesperada "' + t.value + '" en línea ' + t.line);
    }
}

// Traduce un nodo de condición a lenguaje natural en español
function simCondToSpanish(node) {
    if (!node) return '';

    // Comparación binaria simple: "edad >= 18" → "edad es mayor o igual a 18"
    if (node.type === 'Binary') {
        const left = simExprStr(node.left);
        const right = simExprStr(node.right);
        const ops = {
            '==': 'es igual a',
            '!=': 'es diferente de',
            '>': 'es mayor que',
            '<': 'es menor que',
            '>=': 'es mayor o igual a',
            '<=': 'es menor o igual a',
            '&&': 'y además',
            '||': 'o bien',
        };
        const verbo = ops[node.op];
        if (verbo) return left + ' ' + verbo + ' ' + right;
    }

    // Fallback: muestra la expresión tal cual
    return simExprStr(node);
}

class SimInterp {
    constructor(snap, scope) { this.snap = snap; this.scope = scope; this.out = []; this.switchBroken = false; }
    run(prog) { this.execBlock(prog.body); }
    execBlock(stmts) { for (const s of stmts) { if (this.switchBroken) break; this.execNode(s); } }

    // Ejecuta un ternario en 3 pasos didácticos y devuelve el valor final.
    execTernarioDidactico(ternNode, line) {
        const condVal = this.eval(ternNode.cond);

        // Paso 1: condición en lenguaje natural
        this.capture(line,
            '¿Se cumple que ' + simCondToSpanish(ternNode.cond) + '? ' + (condVal ? ': SÍ' : ': NO'),
            condVal ? 'true' : 'false'
        );

        // Paso 2: rama elegida
        const elegida = condVal ? ternNode.whenTrue : ternNode.whenFalse;
        const elegidaVal = this.eval(elegida);
        this.capture(line,
            (condVal
                ? 'Como SÍ se cumple, el resultado es: '
                : 'Como NO se cumple, el resultado es: ')
            + simFmt(elegidaVal),
            condVal ? 'true' : 'false'
        );

        return elegidaVal;
    }

    execNode(node) {
        switch (node.type) {
            case 'VarDecl': {
                let v;
                if (node.expr && node.expr.type === 'Ternary') {
                    v = this.execTernarioDidactico(node.expr, node.line);
                } else {
                    v = this.eval(node.expr);
                }
                this.scope.declare(node.name, v);
                this.capture(node.line, node.name + ' = ' + simFmt(v), null);
                break;
            }
            case 'Assign': {
                let v;
                if (node.expr && node.expr.type === 'Ternary') {
                    v = this.execTernarioDidactico(node.expr, node.line);
                } else {
                    v = this.eval(node.expr);
                }
                this.scope.set(node.name, v);
                this.capture(node.line, node.name + ' = ' + simFmt(v), null);
                break;
            }
            case 'Print': {
                const v = this.eval(node.expr);
                this.out.push(String(v));
                this.capture(node.line, 'imprime: ' + simFmt(v), null);
                break;
            }
            case 'If': this.execIf(node); break;
            case 'Switch': this.execSwitch(node); break;
            case 'For': this.execFor(node); break;
            case 'While': this.execWhile(node); break;
            case 'Break': this.switchBroken = true; this.capture(node.line, 'break: termina el switch', 'true'); break;
            case 'ExprStmt': this.eval(node.expr); this.capture(node.line, '', null); break;
        }
    }

    execIf(node) {
        for (let i = 0; i < node.clauses.length; i++) {
            const cl = node.clauses[i];

            // Cláusula else (sin condición)
            if (cl.cond === null) {
                this.capture(cl.line,
                    'Como ninguna condición anterior se cumplió, se ejecuta el bloque "else"',
                    'true');
                this.execBlock(cl.body);
                return;
            }

            const res = this.eval(cl.cond);
            // "if" para la primera cláusula, "else if" para las siguientes
            const etiqueta = i === 0 ? 'if' : 'else if';
            this.capture(cl.line,
                '¿Se cumple que ' + simCondToSpanish(cl.cond) + '? ' + (res ? ': SÍ' : ': NO'),
                res ? 'true' : 'false');

            if (res) {
                this.capture(cl.line,
                    'Como SÍ se cumple, se ejecuta este bloque',
                    'true');
                this.execBlock(cl.body);
                return;
            }
        }
    }

    execSwitch(node) {
        const switchValue = this.eval(node.expr);
        const txt = simExprStr(node.expr);

        // Paso inicial: qué valor estamos evaluando
        this.capture(node.line,
            'Se evalúa el valor de "' + txt + '", que es ' + simFmt(switchValue) + '. Se busca el case que coincida.',
            null);

        this.switchBroken = false;
        let matched = false;

        for (const c of node.cases) {
            if (this.switchBroken) break;

            if (c.type === 'default') {
                if (!matched) {
                    this.capture(c.line,
                        'Ningún case coincidió, así que se ejecuta el bloque "default"',
                        'true');
                    this.execBlock(c.body);
                }
                break;
            }

            const caseValue = this.eval(c.value);
            const match = switchValue === caseValue;
            this.capture(c.line,
                '¿' + simFmt(switchValue) + ' es igual a ' + simFmt(caseValue) + '? ' + (match ? ': SÍ, coincide' : ': NO, se prueba el siguiente'),
                match ? 'true' : 'false');

            if (match && !matched) {
                matched = true;
                this.execBlock(c.body);
            }
        }
        this.switchBroken = false;
    }

    // ── FOR didáctico: muestra inicialización, condición, cuerpo e incremento ──
    execFor(node) {
        // 1) Inicialización
        if (node.init) {
            const v = this.eval(node.init.expr);
            if (node.init.type === 'VarDecl') this.scope.declare(node.init.name, v);
            else this.scope.set(node.init.name, v);
            this.capture(node.init.line,
                'Inicio del for: ' + node.init.name + ' empieza en ' + simFmt(v),
                null);
        }

        let iterations = 0;
        const LIMITE = 1000;

        // 2) Primera evaluación de la condición
        let cond = this.eval(node.cond);
        this.capture(node.line,
            '¿Se cumple que ' + simCondToSpanish(node.cond) + '? ' + (cond ? ': SÍ, entra al ciclo' : ': NO, no entra'),
            cond ? 'true' : 'false');

        while (cond && iterations < LIMITE) {
            // 3) Cuerpo del ciclo
            this.execBlock(node.body);
            iterations++;

            // 4) Incremento (update)
            const nuevoVal = this.eval(node.update.expr);
            this.scope.set(node.update.name, nuevoVal);
            this.capture(node.update.line,
                'Se incrementa: ' + node.update.name + ' ahora vale ' + simFmt(nuevoVal),
                null);

            // 5) Vuelve a evaluar la condición
            cond = this.eval(node.cond);
            this.capture(node.line,
                '¿Se cumple que ' + simCondToSpanish(node.cond) + '? ' + (cond ? ': SÍ, repite' : ': NO, termina el ciclo'),
                cond ? 'true' : 'false');
        }

        if (iterations >= LIMITE) {
            this.capture(node.line, 'Se alcanzó el límite de repeticiones (posible ciclo infinito)', 'err');
        } else {
            this.capture(node.line,
                'El ciclo for terminó después de ' + iterations + (iterations === 1 ? ' repetición' : ' repeticiones'),
                'true');
        }
    }

    // ── WHILE y DO-WHILE didácticos ──
    execWhile(node) {
        let iterations = 0;
        const LIMITE = 1000;

        if (node.isDoWhile) {
            // do-while: el cuerpo se ejecuta SIEMPRE al menos una vez
            this.capture(node.line,
                'do-while: el cuerpo se ejecuta al menos una vez, antes de revisar la condición',
                null);
            this.execBlock(node.body);
            iterations++;

            let cond = this.eval(node.cond);
            this.capture(node.line,
                '¿Se cumple que ' + simCondToSpanish(node.cond) + '? ' + (cond ? ': SÍ, repite' : ': NO, termina'),
                cond ? 'true' : 'false');

            while (cond && iterations < LIMITE) {
                this.execBlock(node.body);
                iterations++;
                cond = this.eval(node.cond);
                this.capture(node.line,
                    '¿Se cumple que ' + simCondToSpanish(node.cond) + '? ' + (cond ? ': SÍ, repite' : ': NO, termina'),
                    cond ? 'true' : 'false');
            }
        } else {
            // while normal: revisa la condición ANTES de cada repetición
            let cond = this.eval(node.cond);
            this.capture(node.line,
                '¿Se cumple que ' + simCondToSpanish(node.cond) + '? ' + (cond ? ': SÍ, entra al ciclo' : ': NO, no entra'),
                cond ? 'true' : 'false');

            while (cond && iterations < LIMITE) {
                this.execBlock(node.body);
                iterations++;
                cond = this.eval(node.cond);
                this.capture(node.line,
                    '¿Se cumple que ' + simCondToSpanish(node.cond) + '? ' + (cond ? ': SÍ, repite' : ': NO, termina el ciclo'),
                    cond ? 'true' : 'false');
            }
        }

        if (iterations >= LIMITE) {
            this.capture(node.line, 'Se alcanzó el límite de repeticiones (posible ciclo infinito)', 'err');
        } else {
            this.capture(node.line,
                'El ciclo terminó después de ' + iterations + (iterations === 1 ? ' repetición' : ' repeticiones'),
                'true');
        }
    }

    eval(node) {
        switch (node.type) {
            case 'Literal': return node.value;
            case 'Ident': return this.scope.get(node.name);
            case 'Binary': return this.binop(node.op, this.eval(node.left), this.eval(node.right));
            case 'Ternary': return this.eval(node.cond) ? this.eval(node.whenTrue) : this.eval(node.whenFalse);
        }
    }

    binop(op, a, b) {
        switch (op) {
            case '+': return (typeof a === 'string' || typeof b === 'string') ? String(a) + String(b) : a + b;
            case '-': return a - b;
            case '*': return a * b;
            case '/': return Math.trunc(a / b);
            case '%': return a % b;
            case '==': return a === b;
            case '!=': return a !== b;
            case '<': return a < b;
            case '>': return a > b;
            case '<=': return a <= b;
            case '>=': return a >= b;
            case '&&': return Boolean(a && b);
            case '||': return Boolean(a || b);
            default: return undefined;
        }
    }

    capture(line, note, status) {
        this.snap.capture({ line, note, status, variables: this.scope.snapshot(), output: this.out.slice() });
    }
}

class Simulador {
    constructor() { this.snap = new SimSnapMgr(); this.lastAst = null; }
    load(code) {
        this.snap.reset();
        try {
            const tokens = simTokenize(code);
            const ast = new SimParser(tokens).parseProgram();
            this.lastAst = ast;
            const scope = new SimScope();
            new SimInterp(this.snap, scope).run(ast);
            this.snap.begin();
            return this.snap.current();
        } catch (e) {
            return { line: 1, note: e.message, status: 'err', variables: {}, output: [] };
        }
    }
    next() { return this.snap.next(); }
    prev() { return this.snap.prev(); }
    clear() { this.snap.reset(); }
    info() { return { index: this.snap.idx, total: this.snap.total() }; }
}

const TEMAS_SOPORTADOS = [
    'if', 'switch', 'ternario',
    'Ciclos_for', 'Ciclos_while', 'Ciclos_dowhile',
    'if_simple', 'switch_simple', 'ternario_simple',
    'if_anidada', 'switch_anidada', 'ternario_anidada',
    'if_compuesta', 'switch_compuesta', 'ternario_compuesta',
    'operadores_logicos', 'operadores_aritmeticos', 'operadores_relacionales'
];
const sim = new Simulador();
let simEditor = null;
let simDecorations = [];
let simPlayTimer = null;
let simPlaying = false;
let simTemaActual = null;

// ── Helpers internos para obtener los botones por ID ──────────

function _btnReiniciar() { return document.getElementById('btn-reiniciar'); }
function _btnAnterior() { return document.getElementById('btn-paso-anterior'); }
function _btnSiguiente() { return document.getElementById('btn-paso-siguiente'); }
function _btnReproducir() { return document.getElementById('btn-reproducir'); }

function _getBtns() {
    return [_btnReiniciar(), _btnAnterior(), _btnSiguiente(), _btnReproducir()];
}

function simExtraerVariablesEditables(ast) {
    if (!ast || !ast.body) return [];
    return ast.body
        .filter(n => n.type === 'VarDecl' && n.expr && n.expr.type === 'Literal' && n.expr.value !== null)
        .map(n => ({ name: n.name, varType: n.varType, value: n.expr.value, line: n.line }));
}

function simReconstruirCodigo(baseCode, variables, valoresNuevos) {
    const lineas = baseCode.split('\n');
    for (const v of variables) {
        const idx = v.line - 1;
        if (idx < 0 || idx >= lineas.length) continue;
        const nuevoValor = valoresNuevos[v.name];
        let valorFormateado;
        if (typeof v.value === 'string') {
            valorFormateado = '"' + String(nuevoValor).replace(/"/g, '\\"') + '"';
        } else if (typeof v.value === 'boolean') {
            valorFormateado = (nuevoValor === true || nuevoValor === 'true') ? 'true' : 'false';
        } else {
            const num = parseFloat(nuevoValor);
            valorFormateado = isNaN(num) ? String(v.value) : String(num);
        }
        const regex = new RegExp('^(\\s*' + v.varType + '\\s+' + v.name + '\\s*=\\s*).*?(;.*)$');
        lineas[idx] = lineas[idx].replace(regex, (_, antes, despues) => antes + valorFormateado + despues);
    }
    return lineas.join('\n');
}

function simRenderInputsVariables(variables, codigoBase) {
    const host = document.getElementById('sim-vars-editable');
    if (!host) return;

    if (!variables.length) {
        host.innerHTML = '';
        host.style.display = 'none';
        host.dataset.simVarsSignature = '';
        return;
    }
    host.style.display = 'flex';

    const signature = variables.map(v => v.name + ':' + v.varType).join('|');
    if (host.dataset.simVarsSignature === signature) return;
    host.dataset.simVarsSignature = signature;

    host.innerHTML = variables.map(v => {
        const tipoInput = (v.varType === 'int' || v.varType === 'double' || v.varType === 'float' || v.varType === 'long') ? 'number' : 'text';
        let inputHtml;
        if (v.varType === 'bool') {
            inputHtml =
                '<select class="sim-var-input" data-var="' + v.name + '">' +
                '<option value="true"' + (v.value === true ? ' selected' : '') + '>true</option>' +
                '<option value="false"' + (v.value === false ? ' selected' : '') + '>false</option>' +
                '</select>';
        } else {
            inputHtml =
                '<input class="sim-var-input" type="' + tipoInput + '" data-var="' + v.name + '" value="' + simEscape(String(v.value)) + '"' +
                (tipoInput === 'number' && v.varType !== 'int' && v.varType !== 'long' ? ' step="0.01"' : '') + '>';
        }
        return (
            '<div class="sim-var-field">' +
            '<label>' + simEscape(v.varType) + ' ' + simEscape(v.name) + '</label>' +
            inputHtml +
            '</div>'
        );
    }).join('');

    host.querySelectorAll('.sim-var-input').forEach(input => {
        const evento = input.tagName === 'SELECT' ? 'change' : 'input';
        input.addEventListener(evento, () => {
            const valoresNuevos = {};
            host.querySelectorAll('.sim-var-input').forEach(inp => {
                valoresNuevos[inp.dataset.var] = inp.tagName === 'SELECT' ? (inp.value === 'true') : inp.value;
            });
            const nuevoCodigo = simReconstruirCodigo(codigoBase, variables, valoresNuevos);
            if (simEditor) simEditor.setValue(nuevoCodigo);
            simEjecutarSinTocarInputs(nuevoCodigo);
        });
    });
}

const _ICON_PLAY = '<img src="../img/iconos/play.png" alt="Reproducir"><span class="tooltip-text">Reproducir</span>';
const _ICON_PAUSE = '<img src="../img/iconos/pause.png" alt="Pausar"><span class="tooltip-text">Pausar</span>';

function simEjecutarSinTocarInputs(codigo) {
    const first = sim.load(codigo);
    simRender(first, sim.info());
    const btnA = _btnAnterior();
    const btnR = _btnReproducir();
    if (btnA) btnA.disabled = true;
    if (btnR) { simPlaying = false; btnR.innerHTML = _ICON_PLAY; }
}

function simCargarYEjecutar(codigo) {
    const first = sim.load(codigo);
    const variables = simExtraerVariablesEditables(sim.lastAst);
    simRenderInputsVariables(variables, codigo);
    simRender(first, sim.info());
    const btnA = _btnAnterior();
    const btnR = _btnReproducir();
    if (btnA) btnA.disabled = true;
    if (btnR) { simPlaying = false; btnR.innerHTML = _ICON_PLAY; }
}

(function injectSimStyles() {
    if (document.getElementById('simulador-styles')) return;
    const style = document.createElement('style');
    style.id = 'simulador-styles';
    style.textContent = `
        .lineHighlight { background: rgba(255,255,255,0.08); }
        .lineTrue      { background: rgba(4,170,109,0.20);  }
        .lineFalse     { background: rgba(220,53,69,0.20);  }
        .sim-line-ref  { font-size:0.82em; color:#8a9ab5; }
        .sim-note      { margin-top:6px; font-size:0.9em; color:#c5cae9; word-break:break-word; }
        .sim-note.t    { color:#04AA6D; font-weight:600; }
        .sim-note.f    { color:#e05263; font-weight:600; }
        .sim-note.err  { color:#ff8a65; font-weight:600; }
        .sim-speed-row { display:flex; align-items:center; gap:8px; margin-top:8px; width:100%; }
        .sim-speed-row label { font-size:0.78em; color:#8a9ab5; white-space:nowrap; }
        .sim-speed-row input[type=range] { flex:1; accent-color:#04AA6D; cursor:pointer; height:4px; }
        .sim-speed-val { font-size:0.78em; color:#04AA6D; min-width:30px; text-align:right; }
        #panel-vars .var { padding:2px 0; }
        .sim-api-error {
            padding: 10px 14px;
            margin-bottom: 8px;
            background: rgba(220,53,69,0.12);
            border: 1px solid rgba(220,53,69,0.4);
            border-radius: 8px;
            color: #ff8a8a;
            font-size: 0.9em;
        }

        /* Inputs editables del simulador de ARREGLOS (mismo look que el de selectivas) */
#arr-vars-editable {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    padding: 10px 14px;
    margin-bottom: 8px;
    background: #1e2130;
    border: 1px solid #3a3d4a;
    border-radius: 8px;
}
#arr-vars-editable:empty {
    display: none;
}
.arr-var-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 120px;
}
.arr-var-field label {
    font-size: 0.72em;
    color: #8a9ab5;
    font-family: monospace;
    text-transform: none;
    letter-spacing: 0.02em;
}
.arr-var-input {
    background: #15161e;
    border: 1px solid #3a3d4a;
    color: #fff;
    padding: 6px 10px;
    border-radius: 6px;
    font-family: 'Consolas', monospace;
    font-size: 0.9em;
    outline: none;
    transition: border-color 0.15s;
}
.arr-var-input:focus {
    border-color: #04AA6D;
}
    `;
    document.head.appendChild(style);
})();

function simRender(state, info) {
    if (!state) { simClearPanels(); return; }
    simHighlight(state.line, state.status);

    const panelPaso = document.getElementById('panel-paso');
    if (panelPaso) {
        const src = simEditor
            ? simEscape(simEditor.getModel().getLineContent(state.line).trim())
            : '';
        const noteClass = state.status === 'true' ? ' t' : state.status === 'false' ? ' f' : state.status === 'err' ? ' err' : '';
        panelPaso.innerHTML =
            '<div class="sim-line-ref">Línea ' + state.line + ': ' + src + '</div>' +
            (state.note ? '<div class="sim-note' + noteClass + '">' + simEscape(state.note) + '</div>' : '');
    }

    const panelVars = document.getElementById('panel-vars');
    if (panelVars) {
        const entries = Object.entries(state.variables || {})
            .filter(([k, v]) => typeof v !== 'string'); // oculta strings
        panelVars.innerHTML = entries.length
            ? entries.map(([k, v]) => '<div class="var">' + simEscape(k) + ' = ' + simEscape(simFmt(v)) + '</div>').join('')
            : '<span style="color:#8a9ab5;font-size:0.85em;">Sin variables</span>';
    }

    const panelSalida = document.getElementById('panel-salida');
    if (panelSalida) panelSalida.textContent = (state.output || []).join('\n');

    if (info && info.total > 0) {
        const stepEl = document.querySelector('.ctrl-step');
        if (stepEl) stepEl.textContent = 'Paso ' + (info.index + 1) + ' / ' + info.total;
        const fill = document.querySelector('.pbar i');
        if (fill) fill.style.width = ((info.index + 1) / info.total * 100) + '%';
    }
}

function simHighlight(line, status) {
    if (!simEditor) return;
    const cls = status === 'true' ? 'lineTrue' : status === 'false' ? 'lineFalse' : 'lineHighlight';
    simDecorations = simEditor.deltaDecorations(simDecorations, [{
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: cls }
    }]);
    simEditor.revealLineInCenter(line);
}

function simClearPanels() {
    if (simEditor) simDecorations = simEditor.deltaDecorations(simDecorations, []);
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

// Devuelve la lista de ejemplos (siempre como arreglo)
// FIX: ya no asume que EXAMPLES existe en el ámbito global. Si el proyecto
// migró todo a la API y ya no define EXAMPLES/EJERCICIOS localmente, antes
// esto lanzaba "ReferenceError: EXAMPLES is not defined" y rompía
// initSimulador() a la mitad (por eso el editor y los paneles quedaban
// vacíos sin ningún mensaje visible).
function simGetEjemplos(tema) {
    if (typeof EXAMPLES === 'undefined') return [''];
    const ex = EXAMPLES[tema];
    if (Array.isArray(ex)) return ex.slice();
    if (typeof ex === 'string') return [ex];
    return [''];
}

// Junta ejemplos + ejercicio en una sola lista de "items"
function simGetItems(tema) {
    const items = simGetEjemplos(tema).map((code, i) => ({
        label: 'Ejemplo ' + (i + 1),
        codigo: code,
        enunciado: null
    }));
    const ej = (typeof EJERCICIOS !== 'undefined') ? EJERCICIOS[tema] : null;
    if (ej) items.push({ label: 'Ejercicio', codigo: ej.codigo, enunciado: ej.enunciado, esEjercicio: true });
    return items;
}

// Cambia el texto de arriba: concepto normal o enunciado del ejercicio
function simSetDescripcion(html, esEjercicio) {
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

// Muestra (o limpia) un mensaje de error visible arriba del editor.
// FIX: antes, cualquier fallo de la API o de datos faltantes quedaba
// silencioso (solo un console.warn) y el usuario solo veía paneles vacíos.
function simMostrarErrorApi(mensaje) {
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

// ── Conexión con la API (reemplaza EXAMPLES/EJERCICIOS locales) ──
const simCacheSubtemas = {};

function simNormalizarCodigoEjemplo(codigo_ejemplo) {
    if (typeof codigo_ejemplo === 'string') {
        return { ejemplos: [codigo_ejemplo], ejercicio: null };
    }
    if (Array.isArray(codigo_ejemplo)) {
        return { ejemplos: codigo_ejemplo, ejercicio: null };
    }
    if (codigo_ejemplo && typeof codigo_ejemplo === 'object') {
        return {
            ejemplos: Array.isArray(codigo_ejemplo.ejemplos) ? codigo_ejemplo.ejemplos : [],
            ejercicio: codigo_ejemplo.ejercicio || null
        };
    }
    return { ejemplos: [''], ejercicio: null };
}

async function simObtenerDatosTema(slug) {
    if (simCacheSubtemas[slug]) return simCacheSubtemas[slug];
    try {
        if (!window.ApiClient || typeof window.ApiClient.obtenerSubtemaPorSlug !== 'function') {
            throw new Error('window.ApiClient.obtenerSubtemaPorSlug no está disponible');
        }
        const subtema = await window.ApiClient.obtenerSubtemaPorSlug(slug);
        if (!subtema) throw new Error('La API devolvió una respuesta vacía para "' + slug + '"');
        simCacheSubtemas[slug] = subtema;
        return subtema;
    } catch (e) {
        console.warn(`Subtema "${slug}" no encontrado en la API, usando datos locales de respaldo`, e);
        return {
            definicion: (window.temas && window.temas[slug]) ? window.temas[slug].definicion : '',
            codigo_ejemplo: null, // null => se usa EXAMPLES/EJERCICIOS local como respaldo
            _apiError: e.message
        };
    }
}

function simGetItemsDesdeSubtema(subtema, slugFallback) {
    if (subtema.codigo_ejemplo === null) {
        const items = simGetItems(slugFallback);
        const sinContenidoLocal = typeof EXAMPLES === 'undefined' && typeof EJERCICIOS === 'undefined';
        if (sinContenidoLocal || !items.length || !items[0].codigo) {
            return [{ label: 'Ejemplo 1', codigo: '// No se pudo cargar el ejemplo desde la API\n// y no hay datos locales de respaldo.', enunciado: null }];
        }
        return items;
    }

    // Los ejemplos vienen en codigo_ejemplo (lista o string)
    const { ejemplos } = simNormalizarCodigoEjemplo(subtema.codigo_ejemplo);
    const items = ejemplos.map((code, i) => ({
        label: ejemplos.length > 1 ? 'Ejemplo ' + (i + 1) : 'Ejemplo',
        codigo: code,
        enunciado: null
    }));

    // El ejercicio viene APARTE, en subtema.ejercicios (lista de la BD).
    // Campos reales: descripcion (enunciado) y codigo_csharp (solución).
    const ej = (Array.isArray(subtema.ejercicios) && subtema.ejercicios.length)
        ? subtema.ejercicios[0]
        : null;
    if (ej) {
        items.push({
            label: 'Ejercicio',
            codigo: ej.codigo_csharp,
            enunciado: ej.descripcion,
            esEjercicio: true
        });
    }

    if (!items.length) {
        items.push({ label: 'Ejemplo 1', codigo: '// La API no devolvió ejemplos para este tema.', enunciado: null });
    }
    return items;
}

async function initSimulador(tema) {
    const editorBody = document.getElementById('editor-body');
    if (!editorBody) return;
    simTemaActual = tema;

    let subtema, items, codigo, defOriginal;
    try {
        subtema = await simObtenerDatosTema(tema); // "tema" == slug
        items = simGetItemsDesdeSubtema(subtema, tema);
        codigo = items[0].codigo;
        defOriginal = subtema.definicion || ((window.temas && window.temas[tema]) ? window.temas[tema].definicion : '');

        // FIX: si hubo fallback por error de API, mostramos un aviso visible
        // en vez de dejarlo solo en la consola.
        if (subtema._apiError) {
            simMostrarErrorApi('No se pudo conectar con la API de ejemplos (' + subtema._apiError + '). Mostrando datos de respaldo.');
        } else {
            simMostrarErrorApi(null);
        }
    } catch (e) {
        // FIX: cualquier error inesperado aquí antes rompía initSimulador a
        // la mitad sin dejar rastro visible; ahora se muestra en pantalla.
        console.error('Error inicializando el simulador para "' + tema + '":', e);
        simMostrarErrorApi('Error cargando el simulador: ' + e.message);
        return;
    }

    // Pestañas (solo si hay más de un item)
    if (!document.getElementById('sim-ejemplos-tabs') && items.length > 1) {
        const tabs = document.createElement('div');
        tabs.id = 'sim-ejemplos-tabs';
        tabs.innerHTML = items.map((it, i) =>
            '<button class="sim-tab' + (i === 0 ? ' activo' : '') +
            (it.esEjercicio ? ' ejercicio' : '') +
            '" data-idx="' + i + '">' + it.label + '</button>'
        ).join('');
        editorBody.parentNode.insertBefore(tabs, editorBody);
    }

    if (!document.getElementById('sim-vars-editable')) {
        const varsHost = document.createElement('div');
        varsHost.id = 'sim-vars-editable';
        editorBody.parentNode.insertBefore(varsHost, editorBody);
    }

    function activarTabs() {
        const tabs = document.getElementById('sim-ejemplos-tabs');
        if (!tabs) return;
        tabs.querySelectorAll('.sim-tab').forEach(btn => {
            btn.onclick = () => {
                simStopPlay(_getBtns());
                const idx = parseInt(btn.dataset.idx);
                const it = items[idx];
                tabs.querySelectorAll('.sim-tab').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');

                if (it.enunciado) simSetDescripcion(it.enunciado, true);
                else simSetDescripcion(defOriginal, false);

                if (simEditor) simEditor.setValue(it.codigo);
                simCargarYEjecutar(it.codigo);
            };
        });
    }

    function crearEditor() {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            simEditor = monaco.editor.create(editorBody, {
                value: codigo,
                language: 'csharp',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                readOnly: true
            });
            conectarBotones();
            activarTabs();
            simCargarYEjecutar(codigo);
        });
    }

    if (window.monaco) { crearEditor(); }
    else if (window.require) { crearEditor(); }
    else {
        const loader = document.createElement('script');
        loader.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.js';
        loader.onload = crearEditor;
        document.head.appendChild(loader);
    }
}
function simGetDelay() {
    const slider = document.getElementById('sim-speed-slider');
    const val = slider ? parseInt(slider.value) : 40;
    return Math.round(2000 - (val / 100) * 1800);
}

function simStopPlay(btns) {
    clearTimeout(simPlayTimer);
    simPlayTimer = null;
    simPlaying = false;
    const btnR = (btns && btns[3]) ? btns[3] : _btnReproducir();
    if (btnR) btnR.innerHTML = _ICON_PLAY;
}

function simAutoPlay(btns) {
    const info = sim.info();
    if (info.index >= info.total - 1) { simStopPlay(btns); return; }
    simRender(sim.next(), sim.info());
    if (btns[1]) btns[1].disabled = (sim.info().index <= 0);
    simPlayTimer = setTimeout(() => simAutoPlay(btns), simGetDelay());
}

function conectarBotones() {
    const btns = _getBtns();

    // [0] Volver al inicio → regresa al PRIMER PASO conservando los valores
    //     que el alumno haya puesto en los inputs (NO restaura el ejemplo original).
    if (btns[0]) btns[0].onclick = () => {
        simStopPlay(btns);
        // Reejecuta el código ACTUAL del editor (con los valores actuales) desde el paso 1.
        // No tocamos los inputs ni restauramos EXAMPLES, así no se pierden los cambios.
        const codigoActual = simEditor ? simEditor.getValue() : simGetEjemplos(simTemaActual)[0];
        simEjecutarSinTocarInputs(codigoActual);
    };

    if (btns[1]) {
        btns[1].disabled = true;
        btns[1].onclick = () => {
            simStopPlay(btns);
            simRender(sim.prev(), sim.info());
            btns[1].disabled = (sim.info().index <= 0);
        };
    }

    if (btns[2]) btns[2].onclick = () => {
        simStopPlay(btns);
        if (sim.info().total === 0) {
            const first = sim.load(simEditor.getValue());
            simRender(first, sim.info());
        } else {
            simRender(sim.next(), sim.info());
        }
        if (btns[1]) btns[1].disabled = (sim.info().index <= 0);
    };

    if (btns[3]) btns[3].onclick = () => {
        if (simPlaying) { simStopPlay(btns); return; }
        if (sim.info().total === 0) {
            const first = sim.load(simEditor.getValue());
            if (!first || first.status === 'err') { simRender(first, sim.info()); return; }
            simRender(first, sim.info());
            if (btns[1]) btns[1].disabled = true;
        }
        simPlaying = true;
        btns[3].innerHTML = _ICON_PAUSE;
        simPlayTimer = setTimeout(() => simAutoPlay(btns), simGetDelay());
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
        const slider = document.getElementById('sim-speed-slider');
        const valLbl = document.getElementById('sim-speed-val');
        slider.addEventListener('input', () => {
            valLbl.textContent = (parseFloat(slider.value) / 40).toFixed(1) + '×';
        });
    }
}

(function () {
    const _cargarTema = window.cargarTema;
    window.cargarTema = function (nombreTema) {
        simStopPlay(null);
        if (simEditor) {
            simEditor.dispose();
            simEditor = null;
            simDecorations = [];
        }
        sim.clear();

        if (typeof _cargarTema === 'function') _cargarTema(nombreTema);

        if (TEMAS_SOPORTADOS.includes(nombreTema)) {
            initSimulador(nombreTema); // ya es async, no necesita setTimeout
        }
    };
})();