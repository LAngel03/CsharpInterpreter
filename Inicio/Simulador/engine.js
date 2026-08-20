// Motor de interpretación de C#: lexer, parser e intérprete que recorre el AST para un subconjunto educativo de C#.
// Flujo: texto fuente -> lex() -> parse() -> AST -> Interpreter -> snapshots paso a paso.
// compileAndRun(src, {maxSteps}) devuelve { tokens, ast, snapshots, output, error }.
(function (root) {
    "use strict";

    // Lexer: convierte el texto fuente en C# en una lista plana de tokens.
    const KEYWORDS = new Set([
        "int", "double", "float", "string", "bool", "char",
        "if", "else", "switch", "case", "default",
        "for", "while", "do", "new", "true", "false",
        "break", "continue", "return", "void", "static"
    ]);

    const TYPE_KEYWORDS = new Set(["int", "double", "float", "string", "bool", "char"]);

    // Recorre el texto fuente y genera la secuencia de tokens que consume el parser.
    function lex(src) {
        const tokens = [];
        let i = 0, line = 1, col = 1;
        const N = src.length;

        function push(type, value, ln, cl) { tokens.push({ type, value, line: ln, col: cl }); }
        function isDigit(c) { return c >= "0" && c <= "9"; }
        function isIdStart(c) { return /[A-Za-z_]/.test(c); }
        function isIdPart(c) { return /[A-Za-z0-9_]/.test(c); }

        while (i < N) {
            let c = src[i];

            if (c === "\n") { line++; col = 1; i++; continue; }
            if (c === " " || c === "\t" || c === "\r") { i++; col++; continue; }

            // Omite los comentarios de C# en el código interpretado: "//" hasta fin de línea, "/* */" en varias líneas.
            if (c === "/" && src[i + 1] === "/") { while (i < N && src[i] !== "\n") i++; continue; }
            if (c === "/" && src[i + 1] === "*") {
                i += 2; col += 2;
                while (i < N && !(src[i] === "*" && src[i + 1] === "/")) {
                    if (src[i] === "\n") { line++; col = 1; } else col++;
                    i++;
                }
                i += 2; col += 2; continue;
            }

            const startLine = line, startCol = col;

            if (isDigit(c)) {
                let num = "", isFloat = false;
                while (i < N && (isDigit(src[i]) || src[i] === ".")) {
                    if (src[i] === ".") {
                        if (isFloat) break;
                        if (!isDigit(src[i + 1])) break;
                        isFloat = true;
                    }
                    num += src[i]; i++; col++;
                }
                if (src[i] === "f" || src[i] === "F") { isFloat = true; i++; col++; }
                else if (src[i] === "d" || src[i] === "D") { isFloat = true; i++; col++; }
                push("NUMBER", isFloat ? parseFloat(num) : parseInt(num, 10), startLine, startCol);
                continue;
            }

            if (c === '"') {
                i++; col++;
                let s = "";
                while (i < N && src[i] !== '"') {
                    if (src[i] === "\\") {
                        const nx = src[i + 1];
                        if (nx === "n") s += "\n"; else if (nx === "t") s += "\t";
                        else if (nx === '"') s += '"'; else if (nx === "\\") s += "\\"; else s += nx;
                        i += 2; col += 2;
                    } else {
                        if (src[i] === "\n") { line++; col = 1; } else col++;
                        s += src[i]; i++;
                    }
                }
                i++; col++;
                push("STRING", s, startLine, startCol);
                continue;
            }

            if (c === "'") {
                i++; col++;
                let ch = "";
                if (src[i] === "\\") {
                    const nx = src[i + 1];
                    if (nx === "n") ch = "\n"; else if (nx === "t") ch = "\t";
                    else if (nx === "'") ch = "'"; else if (nx === "\\") ch = "\\";
                    else if (nx === "0") ch = "\0"; else ch = nx;
                    i += 2; col += 2;
                } else { ch = src[i]; i++; col++; }
                if (src[i] === "'") { i++; col++; }
                push("CHAR", ch, startLine, startCol);
                continue;
            }

            if (isIdStart(c)) {
                let id = "";
                while (i < N && isIdPart(src[i])) { id += src[i]; i++; col++; }
                push(KEYWORDS.has(id) ? "KEYWORD" : "IDENT", id, startLine, startCol);
                continue;
            }

            const two = src.substr(i, 2);
            const multi2 = ["==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%="];
            if (multi2.includes(two)) { push("OP", two, startLine, startCol); i += 2; col += 2; continue; }

            const singles = "+-*/%=<>!(){}[],;.&|:?";
            if (singles.includes(c)) {
                const punct = "(){}[],;.:";
                push(punct.includes(c) ? "PUNCT" : "OP", c, startLine, startCol);
                i++; col++; continue;
            }

            throw new CompileError("Carácter no reconocido: '" + c + "'", startLine);
        }
        push("EOF", null, line, col);
        return tokens;
    }

    // Error para fallos de lexer/parser (tiempo de compilación); incluye la línea de origen.
    function CompileError(message, line) {
        this.name = "CompileError"; this.message = message; this.line = line || 0;
    }
    CompileError.prototype = Object.create(Error.prototype);

    // Error para fallos de ejecución (tiempo de ejecución); incluye la línea de origen.
    function RuntimeError(message, line) {
        this.name = "RuntimeError"; this.message = message; this.line = line || 0;
    }
    RuntimeError.prototype = Object.create(Error.prototype);

    // Parser de descenso recursivo: convierte la lista de tokens en un AST respetando la precedencia de operadores.
    function parse(tokens) {
        let pos = 0;
        function peek(o) { return tokens[pos + (o || 0)]; }
        function next() { return tokens[pos++]; }
        function atEnd() { return peek().type === "EOF"; }
        function check(type, value) {
            const t = peek();
            if (t.type !== type) return false;
            if (value !== undefined && t.value !== value) return false;
            return true;
        }
        function match(type, value) { if (check(type, value)) return next(); return null; }
        function expect(type, value, msg) {
            if (check(type, value)) return next();
            const t = peek();
            throw new CompileError(
                msg || ("Se esperaba '" + (value || type) + "' pero se encontró '" +
                    (t.value === null ? "fin de archivo" : t.value) + "'"), t.line);
        }

        // Punto de entrada: parsea las funciones y sentencias de nivel superior hacia la raíz del AST.
        function parseProgram() {
            const functions = [], body = [];
            while (!atEnd()) {
                if (check("KEYWORD", "static")) functions.push(parseFunctionDecl());
                else body.push(parseStatement());
            }
            return { type: "Program", functions, body };
        }

        // Parsea una declaración de función "static <tipoRetorno> nombre(params) { ... }".
        function parseFunctionDecl() {
            const line = next().line;
            const retTypeTok = next();
            const nameTok = expect("IDENT", undefined, "Se esperaba el nombre de la función");
            expect("PUNCT", "(");
            const params = [];
            if (!check("PUNCT", ")")) {
                do {
                    const paramTypeTok = next();
                    const paramName = expect("IDENT", undefined, "Se esperaba el nombre del parámetro").value;
                    params.push({ dataType: paramTypeTok.value, name: paramName });
                } while (match("PUNCT", ","));
            }
            expect("PUNCT", ")");
            const funcBody = parseBlock();
            return { type: "FunctionDecl", returnType: retTypeTok.value, name: nameTok.value, params, funcBody, line };
        }

        // Parsea un bloque de sentencias "{ ... }".
        function parseBlock() {
            expect("PUNCT", "{");
            const body = [];
            while (!check("PUNCT", "}") && !atEnd()) body.push(parseStatement());
            expect("PUNCT", "}");
            return { type: "Block", body };
        }

        // Deriva hacia la función de parseo correcta según el siguiente token (bloque, palabra clave o expresión).
        function parseStatement() {
            const t = peek();
            if (t.type === "PUNCT" && t.value === "{") return parseBlock();
            if (t.type === "PUNCT" && t.value === ";") { next(); return { type: "Empty" }; }

            if (t.type === "KEYWORD") {
                if (TYPE_KEYWORDS.has(t.value)) return parseDeclaration();
                switch (t.value) {
                    case "if": return parseIf();
                    case "switch": return parseSwitch();
                    case "for": return parseFor();
                    case "while": return parseWhile();
                    case "do": return parseDoWhile();
                    case "break": { const ln = next().line; expect("PUNCT", ";"); return { type: "Break", line: ln }; }
                    case "continue": { const ln = next().line; expect("PUNCT", ";"); return { type: "Continue", line: ln }; }
                    case "return": {
                        const ln = next().line;
                        let value = null;
                        if (!check("PUNCT", ";")) value = parseExpression();
                        expect("PUNCT", ";");
                        return { type: "Return", value, line: ln };
                    }
                }
            }
            const ln = t.line;
            const expr = parseExpression();
            expect("PUNCT", ";");
            return { type: "ExpressionStatement", expression: expr, line: ln };
        }

        // Parsea una declaración de variable, arreglo o matriz (se distingue por "[" / "[,]" después del tipo).
        function parseDeclaration() {
            const typeTok = next();
            const baseType = typeTok.value;
            const line = typeTok.line;

            if (check("PUNCT", "[")) {
                next();
                let dims = 1;
                if (check("PUNCT", ",")) { next(); dims = 2; }
                expect("PUNCT", "]");
                const nameTok = expect("IDENT", undefined, "Se esperaba el nombre del arreglo");
                let init = null;
                if (match("OP", "=")) init = parseExpression();
                expect("PUNCT", ";");
                return dims === 1
                    ? { type: "ArrayDeclaration", dataType: baseType, name: nameTok.value, init, line }
                    : { type: "MatrixDeclaration", dataType: baseType, name: nameTok.value, init, line };
            }

            const nameTok = expect("IDENT", undefined, "Se esperaba el nombre de la variable");
            let init = null;
            if (match("OP", "=")) init = parseExpression();
            expect("PUNCT", ";");
            return { type: "VariableDeclaration", dataType: baseType, name: nameTok.value, init, line };
        }

        // Parsea "if (condición) rama [else otraRama]".
        function parseIf() {
            const line = next().line;
            expect("PUNCT", "(");
            const test = parseExpression();
            expect("PUNCT", ")");
            const consequent = parseStatement();
            let alternate = null;
            if (check("KEYWORD", "else")) { next(); alternate = parseStatement(); }
            return { type: "If", test, consequent, alternate, line };
        }

        // Parsea un bloque "switch (discriminante) { case ...: ... default: ... }".
        function parseSwitch() {
            const line = next().line;
            expect("PUNCT", "(");
            const discriminant = parseExpression();
            expect("PUNCT", ")");
            expect("PUNCT", "{");
            const cases = [];
            while (!check("PUNCT", "}") && !atEnd()) {
                if (check("KEYWORD", "case")) {
                    const cl = next().line;
                    const test = parseExpression();
                    expect("PUNCT", ":");
                    const body = [];
                    while (!check("KEYWORD", "case") && !check("KEYWORD", "default") &&
                        !check("PUNCT", "}") && !atEnd()) body.push(parseStatement());
                    cases.push({ test, body, line: cl });
                } else if (check("KEYWORD", "default")) {
                    const cl = next().line;
                    expect("PUNCT", ":");
                    const body = [];
                    while (!check("KEYWORD", "case") && !check("KEYWORD", "default") &&
                        !check("PUNCT", "}") && !atEnd()) body.push(parseStatement());
                    cases.push({ test: null, body, line: cl });
                } else throw new CompileError("Se esperaba 'case' o 'default' dentro de switch", peek().line);
            }
            expect("PUNCT", "}");
            return { type: "Switch", discriminant, cases, line };
        }

        // Parsea un ciclo "for (init; condición; actualización) cuerpo" al estilo C.
        function parseFor() {
            const line = next().line;
            expect("PUNCT", "(");
            let init = null;
            if (!check("PUNCT", ";")) {
                if (peek().type === "KEYWORD" && TYPE_KEYWORDS.has(peek().value)) {
                    const typeTok = next();
                    const nameTok = expect("IDENT");
                    let vinit = null;
                    if (match("OP", "=")) vinit = parseExpression();
                    init = { type: "VariableDeclaration", dataType: typeTok.value, name: nameTok.value, init: vinit, line: typeTok.line };
                } else {
                    init = { type: "ExpressionStatement", expression: parseExpression(), line };
                }
            }
            expect("PUNCT", ";");
            let test = null;
            if (!check("PUNCT", ";")) test = parseExpression();
            expect("PUNCT", ";");
            let update = null;
            if (!check("PUNCT", ")")) update = parseExpression();
            expect("PUNCT", ")");
            const body = parseStatement();
            return { type: "For", init, test, update, body, line };
        }

        // Parsea un ciclo "while (condición) cuerpo".
        function parseWhile() {
            const line = next().line;
            expect("PUNCT", "(");
            const test = parseExpression();
            expect("PUNCT", ")");
            const body = parseStatement();
            return { type: "While", test, body, line };
        }

        // Parsea un ciclo "do cuerpo while (condición);".
        function parseDoWhile() {
            const line = next().line;
            const body = parseStatement();
            expect("KEYWORD", "while");
            expect("PUNCT", "(");
            const test = parseExpression();
            expect("PUNCT", ")");
            expect("PUNCT", ";");
            return { type: "DoWhile", test, body, line };
        }

        const ASSIGN_OPS = new Set(["=", "+=", "-=", "*=", "/=", "%="]);
        // Punto de entrada del parseo de expresiones: nivel de precedencia más bajo (asignación).
        function parseExpression() { return parseAssignment(); }

        // Parsea una asignación ("=", "+=", ...); el lado izquierdo debe ser una variable o un elemento de arreglo/matriz.
        function parseAssignment() {
            const left = parseTernary();
            if (peek().type === "OP" && ASSIGN_OPS.has(peek().value)) {
                const opTok = next();
                const right = parseAssignment();
                if (!["Variable", "ArrayAccess", "MatrixAccess"].includes(left.type))
                    throw new CompileError("El lado izquierdo de '=' no es asignable", opTok.line);
                return { type: "Assignment", operator: opTok.value, target: left, value: right, line: opTok.line };
            }
            return left;
        }

        // Parsea "condición ? valorSiVerdadero : valorSiFalso"; recursivo a la derecha para anidar ternarios encadenados.
        function parseTernary() {
            const test = parseLogicalOr();
            if (peek().type === "OP" && peek().value === "?") {
                const qTok = next();
                const consequent = parseTernary();
                expect("PUNCT", ":", "Se esperaba ':' en el operador ternario");
                const alternate = parseTernary();
                return { type: "Conditional", test, consequent, alternate, line: qTok.line };
            }
            return test;
        }

        // Construye un parser de operador binario asociativo a la izquierda para un nivel de precedencia.
        function binaryLevel(sub, ops) {
            return function () {
                let left = sub();
                while (peek().type === "OP" && ops.includes(peek().value)) {
                    const opTok = next();
                    const right = sub();
                    left = { type: "Binary", operator: opTok.value, left, right, line: opTok.line };
                }
                return left;
            };
        }
        // Cadena de niveles de precedencia, del más fuerte (multiplicativo) al más débil (or lógico).
        const parseMultiplicative = binaryLevel(() => parseUnary(), ["*", "/", "%"]);
        const parseAdditive = binaryLevel(() => parseMultiplicative(), ["+", "-"]);
        const parseRelational = binaryLevel(() => parseAdditive(), ["<", "<=", ">", ">="]);
        const parseEquality = binaryLevel(() => parseRelational(), ["==", "!="]);
        const parseLogicalAnd = binaryLevel(() => parseEquality(), ["&&"]);
        const parseLogicalOr = binaryLevel(() => parseLogicalAnd(), ["||"]);

        // Parsea operadores unarios prefijos (!, -, +, ++, --).
        function parseUnary() {
            const t = peek();
            if (t.type === "OP" && (t.value === "!" || t.value === "-" || t.value === "+")) {
                next();
                return { type: "Unary", operator: t.value, argument: parseUnary(), prefix: true, line: t.line };
            }
            if (t.type === "OP" && (t.value === "++" || t.value === "--")) {
                next();
                return { type: "Update", operator: t.value, argument: parseUnary(), prefix: true, line: t.line };
            }
            return parsePostfix();
        }

        // Parsea cadenas postfijas sobre una expresión primaria: indexado, acceso a miembro/método, y ++/--.
        function parsePostfix() {
            let node = parsePrimary();
            while (true) {
                const t = peek();
                if (t.type === "PUNCT" && t.value === "[") {
                    next();
                    const idx = [parseExpression()];
                    while (check("PUNCT", ",")) { next(); idx.push(parseExpression()); }
                    expect("PUNCT", "]");
                    node = idx.length === 1
                        ? { type: "ArrayAccess", object: node, index: idx[0], line: t.line }
                        : { type: "MatrixAccess", object: node, indices: idx, line: t.line };
                } else if (t.type === "PUNCT" && t.value === ".") {
                    next();
                    const nameTok = expect("IDENT", undefined, "Se esperaba un nombre de miembro");
                    if (check("PUNCT", "(")) {
                        next();
                        const args = [];
                        if (!check("PUNCT", ")")) {
                            args.push(parseExpression());
                            while (check("PUNCT", ",")) { next(); args.push(parseExpression()); }
                        }
                        expect("PUNCT", ")");
                        node = { type: "Call", object: node, name: nameTok.value, arguments: args, line: t.line };
                    } else node = { type: "Member", object: node, name: nameTok.value, line: t.line };
                } else if (t.type === "OP" && (t.value === "++" || t.value === "--")) {
                    next();
                    node = { type: "Update", operator: t.value, argument: node, prefix: false, line: t.line };
                } else break;
            }
            return node;
        }

        // Parsea las unidades de expresión más pequeñas: literales, identificadores/llamadas, "new", paréntesis y literales de arreglo.
        function parsePrimary() {
            const t = peek();
            if (t.type === "NUMBER") { next(); return { type: "Literal", value: t.value, raw: "number", line: t.line }; }
            if (t.type === "STRING") { next(); return { type: "Literal", value: t.value, raw: "string", line: t.line }; }
            if (t.type === "CHAR") { next(); return { type: "Literal", value: t.value, raw: "char", line: t.line }; }
            if (t.type === "KEYWORD" && (t.value === "true" || t.value === "false")) {
                next(); return { type: "Literal", value: t.value === "true", raw: "bool", line: t.line };
            }
            if (t.type === "KEYWORD" && t.value === "new") return parseNew();
            if (t.type === "IDENT") {
                next();
                if (check("PUNCT", "(")) {
                    next();
                    const args = [];
                    if (!check("PUNCT", ")")) {
                        args.push(parseExpression());
                        while (check("PUNCT", ",")) { next(); args.push(parseExpression()); }
                    }
                    expect("PUNCT", ")");
                    return { type: "FunctionCall", name: t.value, arguments: args, line: t.line };
                }
                return { type: "Variable", name: t.value, line: t.line };
            }
            if (t.type === "PUNCT" && t.value === "(") {
                next(); const e = parseExpression(); expect("PUNCT", ")"); return e;
            }
            if (t.type === "PUNCT" && t.value === "{") return parseArrayInitializer();
            throw new CompileError("Expresión no válida cerca de '" +
                (t.value === null ? "fin de archivo" : t.value) + "'", t.line);
        }

        // Parsea un literal de arreglo/fila "{ elem, elem, ... }".
        function parseArrayInitializer() {
            const line = peek().line;
            expect("PUNCT", "{");
            const elements = [];
            if (!check("PUNCT", "}")) {
                elements.push(parseExpression());
                while (check("PUNCT", ",")) { next(); if (check("PUNCT", "}")) break; elements.push(parseExpression()); }
            }
            expect("PUNCT", "}");
            return { type: "ArrayInitializer", elements, line };
        }

        // Parsea expresiones de creación "new tipo[tamaño]" o "new tipo[,]{...}" para arreglos/matrices.
        function parseNew() {
            const line = next().line;
            const typeTok = expect("KEYWORD", undefined);
            if (!TYPE_KEYWORDS.has(typeTok.value))
                throw new CompileError("Tipo no válido después de 'new'", typeTok.line);
            expect("PUNCT", "[");
            if (check("PUNCT", "]")) {
                next();
                const initz = parseArrayInitializer();
                return { type: "ArrayCreation", dataType: typeTok.value, size: null, initializer: initz, line };
            }
            const first = parseExpression();
            if (check("PUNCT", ",")) {
                next();
                const second = parseExpression();
                expect("PUNCT", "]");
                return { type: "MatrixCreation", dataType: typeTok.value, rows: first, cols: second, line };
            }
            expect("PUNCT", "]");
            return { type: "ArrayCreation", dataType: typeTok.value, size: first, initializer: null, line };
        }

        return parseProgram();
    }

    // Intérprete que recorre el AST: ejecuta el árbol y registra un snapshot después de cada paso.
    const BREAK = { signal: "break" };
    const CONTINUE = { signal: "continue" };
    // Señal interna que se lanza para desenrollar la pila de llamadas cuando se ejecuta un "return".
    function ReturnValue(val) { this.value = val; }

    // Un ámbito léxico: mapa de nombre de variable -> celda, encadenado a su ámbito padre.
    function Environment(parent) { this.vars = new Map(); this.parent = parent || null; }
    Environment.prototype.define = function (name, cell) { this.vars.set(name, cell); };
    // Recorre la cadena de ámbitos hacia arriba para buscar la celda de una variable; null si no existe.
    Environment.prototype.lookup = function (name) {
        let e = this; while (e) { if (e.vars.has(name)) return e.vars.get(name); e = e.parent; } return null;
    };

    // Devuelve el valor por defecto de una variable sin inicializar del tipo C# dado.
    function defaultValue(type) {
        switch (type) {
            case "int": case "double": case "float": return 0;
            case "bool": return false;
            case "char": return "\0";
            case "string": return null;
            default: return null;
        }
    }

    // Convierte un valor de JS al tipo C# declarado (trunca enteros, convierte a texto, etc.).
    function coerce(type, v) {
        if (v === null || v === undefined) return v;
        if (type === "int") return Math.trunc(Number(v));
        if (type === "double" || type === "float") return Number(v);
        if (type === "bool") return Boolean(v);
        if (type === "char") return typeof v === "string" ? v[0] : String.fromCharCode(v);
        if (type === "string") return String(v);
        return v;
    }

    // Contiene el AST y todo el estado de ejecución (ámbitos, salida, snapshots, pila de llamadas) de una corrida.
    function Interpreter(ast, options) {
        options = options || {};
        this.ast = ast;
        this.maxSteps = options.maxSteps || 20000;
        this.global = new Environment(null);
        this.output = [];
        this.snapshots = [];
        this.steps = 0;
        this._scopeStack = [this.global];
        this._reads = new Set();
        this._activeFor = null;
        this._lastCondResult = null;
        this._lastAssignCtx = null;
        this._functions = {};
        this._callStack = [];
        this._files = {};
    }

    // Ejecuta el programa completo: registra las funciones, corre las sentencias de nivel superior y captura errores/return/fugas de break-continue.
    Interpreter.prototype.run = function () {
        for (const fn of (this.ast.functions || [])) this._functions[fn.name] = fn;
        this.snapshot(0, "Inicio del programa", new Set());
        try {
            this.execBlockBody(this.ast.body, this.global);
            this.snapshot(0, "Fin del programa", new Set());
        } catch (e) {
            if (e instanceof RuntimeError) {
                this.snapshot(e.line || 0, "⚠ Error: " + e.message, new Set(), true);
                return { snapshots: this.snapshots, output: this.output, error: e };
            }
            if (e instanceof ReturnValue) {
                this.snapshot(0, "Fin del programa", new Set());
                return { snapshots: this.snapshots, output: this.output, error: null };
            }
            if (e === BREAK || e === CONTINUE) {
                const re = new RuntimeError("'break'/'continue' fuera de un ciclo o switch", 0);
                this.snapshot(0, "⚠ Error: " + re.message, new Set(), true);
                return { snapshots: this.snapshots, output: this.output, error: re };
            }
            throw e;
        }
        return { snapshots: this.snapshots, output: this.output, error: null };
    };

    // Cuenta un paso de ejecución y aborta con error si se supera maxSteps (protección contra ciclos infinitos).
    Interpreter.prototype.tick = function () {
        this.steps++;
        if (this.steps > this.maxSteps)
            throw new RuntimeError("Se superó el límite de pasos (" + this.maxSteps +
                "). ¿Hay un ciclo infinito?", 0);
    };

    // Captura el estado actual del programa (variables, salida, pila de llamadas, etc.) como un paso para que la UI lo reproduzca.
    Interpreter.prototype.snapshot = function (line, description, changed, isError) {
        const variables = [], arrays = [], matrices = [];
        const seen = new Set();
        // Recolecta variables escalares/arreglo/matriz de un ámbito, sin repetir nombres ya cubiertos por un ámbito más interno.
        const collect = (env) => {
            env.vars.forEach((cell, name) => {
                if (seen.has(name)) return;
                seen.add(name);
                if (cell.kind === "scalar") variables.push({ name, type: cell.type, value: cell.value });
                else if (cell.kind === "array")
                    arrays.push({ name, type: cell.type, length: cell.length, values: cell.values.slice() });
                else if (cell.kind === "matrix")
                    matrices.push({ name, type: cell.type, rows: cell.rows, cols: cell.cols, values: cell.values.map(r => r.slice()) });
            });
        };
        for (let k = this._scopeStack.length - 1; k >= 0; k--) collect(this._scopeStack[k]);

        let forCtx = null;
        if (this._activeFor) {
                let varValue = null;
                for (let k = this._scopeStack.length - 1; k >= 0; k--) {
                        const cell = this._scopeStack[k].vars.get(this._activeFor.varName);
                        if (cell !== undefined) { varValue = cell.value; break; }
                }
                forCtx = {
                        varName:    this._activeFor.varName,
                        varValue,
                        condText:   this._activeFor.condText,
                        condResult: this._lastCondResult,
                        updateText: this._activeFor.updateText
                };
        }

        this.snapshots.push({
            step: this.snapshots.length,
            currentLine: line,
            description: description,
            variables, arrays, matrices,
            output: this.output.slice(),
            changed: Array.from(changed || []),
            read: Array.from(this._reads),
            forCtx,
            assignCtx: this._lastAssignCtx,
            callStack: this._callStack.map(f => ({ name: f.name, args: Object.assign({}, f.args) })),
            files: Object.assign({}, this._files),
            isError: !!isError
        });
        this._reads = new Set();
        this._lastAssignCtx = null;
    };

    // Apila un ámbito mientras dura fn(), y lo desapila al final aunque fn() lance un error.
    Interpreter.prototype.withScope = function (env, fn) {
        this._scopeStack.push(env);
        try { return fn(); } finally { this._scopeStack.pop(); }
    };

    // Ejecuta cada sentencia de un bloque en orden.
    Interpreter.prototype.execBlockBody = function (body, env) {
        for (const stmt of body) this.execStatement(stmt, env);
    };

    // Deriva un nodo de sentencia hacia su manejador exec*/eval* correspondiente.
    Interpreter.prototype.execStatement = function (stmt, env) {
        this.tick();
        switch (stmt.type) {
            case "Block": {
                const inner = new Environment(env);
                return this.withScope(inner, () => this.execBlockBody(stmt.body, inner));
            }
            case "Empty": return;
            case "VariableDeclaration": return this.execVarDecl(stmt, env);
            case "ArrayDeclaration": return this.execArrayDecl(stmt, env);
            case "MatrixDeclaration": return this.execMatrixDecl(stmt, env);
            case "ExpressionStatement": {
                const changed = new Set();
                const r = this.evalExpr(stmt.expression, env, changed);
                if (stmt.expression.type === "Call" && this.isWriteLine(stmt.expression)) return;
                if (stmt.expression.type === "Call" && this.isFileVoidCall(stmt.expression)) return;
                if (stmt.expression.type === "FunctionCall") return;
                this.snapshot(stmt.line, this.describeExprStmt(stmt.expression, r), changed);
                return;
            }
            case "Return": {
                const changed = new Set();
                const val = stmt.value ? this.evalExpr(stmt.value, env, changed) : null;
                this.snapshot(stmt.line, "return " + fmt(val), changed);
                throw new ReturnValue(val);
            }
            case "FunctionDecl": return;
            case "If": return this.execIf(stmt, env);
            case "Switch": return this.execSwitch(stmt, env);
            case "For": return this.execFor(stmt, env);
            case "While": return this.execWhile(stmt, env);
            case "DoWhile": return this.execDoWhile(stmt, env);
            case "Break": throw BREAK;
            case "Continue": throw CONTINUE;
            default: throw new RuntimeError("Sentencia no soportada: " + stmt.type, stmt.line);
        }
    };

    // Ejecuta la declaración de una variable escalar, evaluando su inicializador si existe.
    Interpreter.prototype.execVarDecl = function (stmt, env) {
        const changed = new Set();
        let value = defaultValue(stmt.dataType);
        if (stmt.init) value = coerce(stmt.dataType, this.evalExpr(stmt.init, env, changed));
        env.define(stmt.name, { kind: "scalar", type: stmt.dataType, value });
        changed.add(stmt.name);
        this.snapshot(stmt.line, "Declarar " + stmt.dataType + " " + stmt.name + " = " + fmt(value), changed);
    };

    // Ejecuta la declaración de un arreglo unidimensional ("new tipo[tamaño]" o un literal "{...}").
    Interpreter.prototype.execArrayDecl = function (stmt, env) {
        const changed = new Set();
        let length = 0, values = [];
        if (stmt.init) {
            const r = this.evalArrayInit(stmt.init, stmt.dataType, env, changed);
            length = r.length; values = r.values;
        }
        env.define(stmt.name, { kind: "array", type: stmt.dataType, length, values });
        changed.add(stmt.name);
        this.snapshot(stmt.line, "Declarar arreglo " + stmt.dataType + "[] " + stmt.name + " (tamaño " + length + ")", changed);
    };

    // Evalúa el inicializador de un arreglo y devuelve su longitud y valores resueltos (con tamaño pero vacío, o desde un literal).
    Interpreter.prototype.evalArrayInit = function (node, dataType, env, changed) {
        if (node.type === "ArrayCreation") {
            if (node.initializer) {
                const vals = node.initializer.elements.map(e => coerce(dataType, this.evalExpr(e, env, changed)));
                return { length: vals.length, values: vals };
            }
            const size = Math.trunc(this.evalExpr(node.size, env, changed));
            if (size < 0) throw new RuntimeError("Tamaño de arreglo negativo", node.line);
            return { length: size, values: new Array(size).fill(null) };
        }
        if (node.type === "ArrayInitializer") {
            const vals = node.elements.map(e => coerce(dataType, this.evalExpr(e, env, changed)));
            return { length: vals.length, values: vals };
        }
        throw new RuntimeError("Inicializador de arreglo no válido", node.line);
    };

    // Ejecuta la declaración de una matriz bidimensional ("new tipo[filas,columnas]" o un literal "{{...},{...}}").
    Interpreter.prototype.execMatrixDecl = function (stmt, env) {
        const changed = new Set();
        let rows = 0, cols = 0, values = [];
        if (stmt.init) {
            if (stmt.init.type === "MatrixCreation") {
                rows = Math.trunc(this.evalExpr(stmt.init.rows, env, changed));
                cols = Math.trunc(this.evalExpr(stmt.init.cols, env, changed));
                for (let r = 0; r < rows; r++) values.push(new Array(cols).fill(null));
            } else if (stmt.init.type === "ArrayInitializer") {
                // Literal directo sin "new": cada elemento externo debe ser a su vez una fila "{...}",
                // y todas las filas deben tener la misma cantidad de columnas.
                const filas = stmt.init.elements;
                rows = filas.length;
                cols = null;
                values = filas.map(fila => {
                    if (fila.type !== "ArrayInitializer")
                        throw new RuntimeError("Cada fila de la matriz debe ser una lista entre llaves { }", stmt.line);
                    const vals = fila.elements.map(e => coerce(stmt.dataType, this.evalExpr(e, env, changed)));
                    if (cols === null) cols = vals.length;
                    else if (vals.length !== cols)
                        throw new RuntimeError("Todas las filas deben tener la misma cantidad de columnas", stmt.line);
                    return vals;
                });
                if (cols === null) cols = 0;
            } else {
                throw new RuntimeError("Inicializador de matriz no válido", stmt.line);
            }
        }
        env.define(stmt.name, { kind: "matrix", type: stmt.dataType, rows, cols, values });
        changed.add(stmt.name);
        this.snapshot(stmt.line, "Declarar matriz " + stmt.dataType + "[,] " + stmt.name + " (" + rows + "x" + cols + ")", changed);
    };

    // Ejecuta una sentencia "if": evalúa la condición y corre la rama que corresponda.
    Interpreter.prototype.execIf = function (stmt, env) {
        const changed = new Set();
        const cond = truthy(this.evalExpr(stmt.test, env, changed));
        this.snapshot(stmt.line, "if (" + this.src(stmt.test) + ") → " + (cond ? "verdadero" : "falso"), changed);
        if (cond) this.execStatement(stmt.consequent, env);
        else if (stmt.alternate) this.execStatement(stmt.alternate, env);
    };

    // Ejecuta un "switch": busca el case (o default) que coincide y continúa hasta un "break".
    Interpreter.prototype.execSwitch = function (stmt, env) {
        const changed = new Set();
        const disc = this.evalExpr(stmt.discriminant, env, changed);
        this.snapshot(stmt.line, "switch (" + this.src(stmt.discriminant) + ") = " + fmt(disc), changed);
        let matchedIndex = -1;
        for (let i = 0; i < stmt.cases.length; i++) {
            const c = stmt.cases[i];
            if (c.test === null) continue;
            const cv = this.evalExpr(c.test, env, new Set());
            if (looseEq(disc, cv)) { matchedIndex = i; break; }
        }
        if (matchedIndex === -1) matchedIndex = stmt.cases.findIndex(c => c.test === null);
        if (matchedIndex === -1) return;
        try {
            for (let i = matchedIndex; i < stmt.cases.length; i++)
                this.execBlockBody(stmt.cases[i].body, env);
        } catch (e) { if (e === BREAK) return; throw e; }
    };

    // Ejecuta un ciclo "for": su propio ámbito, y repite condición/cuerpo/actualización hasta que la condición falle o haya "break".
    Interpreter.prototype.execFor = function (stmt, env) {
        const loopEnv = new Environment(env);
        this.withScope(loopEnv, () => {
            if (stmt.init) this.execStatement(stmt.init, loopEnv);

            // Registra la variable/condición/actualización de este ciclo para que la UI muestre el panel del "for" en vivo.
            const savedFor  = this._activeFor;
            const savedCond = this._lastCondResult;
            const varName = stmt.init && stmt.init.name ? stmt.init.name : null;
            this._activeFor = varName ? {
                    varName,
                    condText:   stmt.test   ? this.src(stmt.test)   : '',
                    updateText: stmt.update ? this.src(stmt.update) : ''
            } : null;
            this._lastCondResult = null;

            try {
                while (true) {
                    this.tick();
                    let cond = true;
                    const changed = new Set();
                    if (stmt.test) {
                        cond = truthy(this.evalExpr(stmt.test, loopEnv, changed));
                        this._lastCondResult = cond;
                        this.snapshot(stmt.line, "for: " + this.src(stmt.test) + " → " + (cond ? "verdadero" : "falso"), changed);
                    }
                    if (!cond) break;
                    try { this.execStatement(stmt.body, loopEnv); }
                    catch (e) { if (e === BREAK) break; if (e !== CONTINUE) throw e; }
                    if (stmt.update) {
                        const ch2 = new Set();
                        const r = this.evalExpr(stmt.update, loopEnv, ch2);
                        this.snapshot(stmt.line, this.describeExprStmt(stmt.update, r), ch2);
                    }
                }
            } finally {
                // Restaura el contexto del ciclo contenedor (soporta ciclos "for" anidados).
                this._activeFor      = savedFor;
                this._lastCondResult = savedCond;
            }
        });
    };

    // Ejecuta un ciclo "while": repite condición/cuerpo hasta que la condición falle o haya "break".
    Interpreter.prototype.execWhile = function (stmt, env) {
        while (true) {
            this.tick();
            const changed = new Set();
            const cond = truthy(this.evalExpr(stmt.test, env, changed));
            this.snapshot(stmt.line, "while (" + this.src(stmt.test) + ") → " + (cond ? "verdadero" : "falso"), changed);
            if (!cond) break;
            try { this.execStatement(stmt.body, env); }
            catch (e) { if (e === BREAK) break; if (e !== CONTINUE) throw e; }
        }
    };

    // Ejecuta un ciclo "do-while": corre el cuerpo al menos una vez y repite mientras la condición sea verdadera.
    Interpreter.prototype.execDoWhile = function (stmt, env) {
        while (true) {
            this.tick();
            try { this.execStatement(stmt.body, env); }
            catch (e) { if (e === BREAK) break; if (e !== CONTINUE) throw e; }
            const changed = new Set();
            const cond = truthy(this.evalExpr(stmt.test, env, changed));
            this.snapshot(stmt.line, "do-while (" + this.src(stmt.test) + ") → " + (cond ? "verdadero" : "falso"), changed);
            if (!cond) break;
        }
    };

    // True si el nodo es una llamada a "Console.WriteLine(...)".
    Interpreter.prototype.isWriteLine = function (node) {
        return node.type === "Call" && node.name === "WriteLine" &&
            node.object && node.object.type === "Variable" && node.object.name === "Console";
    };

    // True si el nodo es una llamada "File.*" cuyo tipo de retorno en C# es void (su resultado no se usa).
    Interpreter.prototype.isFileVoidCall = function (node) {
        return node.type === "Call" &&
            node.object && node.object.type === "Variable" && node.object.name === "File" &&
            ["WriteAllText", "AppendAllText", "Delete"].includes(node.name);
    };

    // Evalúa cualquier nodo de expresión a su valor en tiempo de ejecución; despacho central del AST de expresiones.
    Interpreter.prototype.evalExpr = function (node, env, changed) {
        changed = changed || new Set();
        switch (node.type) {
            case "Literal": return node.value;
            case "Variable": {
                const cell = env.lookup(node.name);
                if (!cell) throw new RuntimeError("Variable no declarada: '" + node.name + "'", node.line);
                if (cell.kind !== "scalar")
                    throw new RuntimeError("'" + node.name + "' es un arreglo/matriz, no un valor simple", node.line);
                if (cell.value === null && cell.type !== "string")
                    throw new RuntimeError("Variable usada sin inicializar: '" + node.name + "'", node.line);
                return cell.value;
            }
            case "Assignment": return this.evalAssignment(node, env, changed);
            case "Binary": return this.evalBinary(node, env, changed);
            case "Unary": {
                const v = this.evalExpr(node.argument, env, changed);
                if (node.operator === "!") return !truthy(v);
                if (node.operator === "-") return -v;
                return +v;
            }
            case "Update": return this.evalUpdate(node, env, changed);
            case "ArrayAccess": {
                const arr = this.resolveArray(node.object, env);
                const idx = Math.trunc(this.evalExpr(node.index, env, changed));
                if (idx < 0 || idx >= arr.length)
                    throw new RuntimeError("Índice fuera de rango: [" + idx + "] (tamaño " + arr.length + ")", node.line);
                const v = arr.values[idx];
                if (v === null) throw new RuntimeError("Posición de arreglo sin inicializar: [" + idx + "]", node.line);
                this._reads.add(node.object.name + '[' + idx + ']');
                return v;
            }
            case "MatrixAccess": {
                const m = this.resolveMatrix(node.object, env);
                const r = Math.trunc(this.evalExpr(node.indices[0], env, changed));
                const c = Math.trunc(this.evalExpr(node.indices[1], env, changed));
                if (r < 0 || r >= m.rows || c < 0 || c >= m.cols)
                    throw new RuntimeError("Índice de matriz fuera de rango: [" + r + "," + c + "]", node.line);
                const v = m.values[r][c];
                if (v === null) throw new RuntimeError("Posición de matriz sin inicializar: [" + r + "," + c + "]", node.line);
                this._reads.add(node.object.name + '[' + r + ',' + c + ']');
                return v;
            }
            case "Member": {
                if (node.name === "Length") return this.resolveArray(node.object, env).length;
                throw new RuntimeError("Miembro no soportado: ." + node.name, node.line);
            }
            case "Call": return this.evalCall(node, env, changed);
            case "FunctionCall": return this.evalFunctionCall(node, env, changed);
            case "Conditional":
                return truthy(this.evalExpr(node.test, env, changed))
                    ? this.evalExpr(node.consequent, env, changed)
                    : this.evalExpr(node.alternate, env, changed);
            default: throw new RuntimeError("Expresión no soportada: " + node.type, node.line);
        }
    };

    // Evalúa llamadas a métodos integrados: Console.WriteLine, array.GetLength y la API File.*.
    Interpreter.prototype.evalCall = function (node, env, changed) {
        if (this.isWriteLine(node)) {
            const parts = node.arguments.map(a => fmtPrint(this.evalExpr(a, env, changed)));
            const text = parts.join("");
            this.output.push(text);
            this.snapshot(node.line, "Imprimir: " + (text === "" ? "(línea vacía)" : text), changed);
            return undefined;
        }
        if (node.name === "GetLength") {
            const m = this.resolveMatrix(node.object, env);
            const d = Math.trunc(this.evalExpr(node.arguments[0], env, changed));
            if (d === 0) return m.rows;
            if (d === 1) return m.cols;
            throw new RuntimeError("GetLength solo admite dimensión 0 o 1", node.line);
        }
        if (node.object && node.object.type === "Variable" && node.object.name === "File") {
            const path = fmtPrint(this.evalExpr(node.arguments[0], env, changed));
            switch (node.name) {
                case "WriteAllText": {
                    const content = fmtPrint(this.evalExpr(node.arguments[1], env, changed));
                    this._files[path] = content;
                    this.snapshot(node.line, "File.WriteAllText: crear \"" + path + "\" con " + fmt(content), changed);
                    return undefined;
                }
                case "AppendAllText": {
                    const content = fmtPrint(this.evalExpr(node.arguments[1], env, changed));
                    this._files[path] = (this._files[path] || "") + content;
                    this.snapshot(node.line, "File.AppendAllText: agregar a \"" + path + "\"", changed);
                    return undefined;
                }
                case "ReadAllText": {
                    if (!(path in this._files))
                        throw new RuntimeError("Archivo no encontrado: \"" + path + "\"", node.line);
                    return this._files[path];
                }
                case "Exists": {
                    return path in this._files;
                }
                case "Delete": {
                    const existia = path in this._files;
                    delete this._files[path];
                    this.snapshot(node.line, "File.Delete: eliminar \"" + path + "\" (" + (existia ? "eliminado" : "no existía") + ")", changed);
                    return undefined;
                }
                case "Copy": {
                    const dest = fmtPrint(this.evalExpr(node.arguments[1], env, changed));
                    if (!(path in this._files))
                        throw new RuntimeError("Archivo origen no encontrado: \"" + path + "\"", node.line);
                    this._files[dest] = this._files[path];
                    this.snapshot(node.line, "File.Copy: \"" + path + "\" → \"" + dest + "\"", changed);
                    return undefined;
                }
            }
        }
        throw new RuntimeError("Función no soportada: " + node.name, node.line);
    };

    // Llama a una función definida por el usuario: liga los argumentos en un ámbito nuevo, corre su cuerpo y captura el valor de retorno.
    Interpreter.prototype.evalFunctionCall = function (node, env, changed) {
        const fn = this._functions[node.name];
        if (!fn) throw new RuntimeError("Función no definida: '" + node.name + "'", node.line);
        if (this._callStack.length >= 50)
            throw new RuntimeError("Demasiadas llamadas recursivas (desbordamiento de pila)", node.line);

        const argVals = node.arguments.map(a => this.evalExpr(a, env, changed));

        const fnEnv = new Environment(this.global);
        fn.params.forEach((p, i) => {
            const v = argVals[i] !== undefined ? argVals[i] : defaultValue(p.dataType);
            fnEnv.define(p.name, { kind: "scalar", type: p.dataType, value: coerce(p.dataType, v) });
        });

        const frame = { name: fn.name, args: {} };
        fn.params.forEach((p, i) => { frame.args[p.name] = argVals[i]; });
        this._callStack.push(frame);

        const argsStr = fn.params.map((p, i) => p.name + " = " + fmt(argVals[i])).join(", ");
        this.snapshot(node.line, "Llamar " + fn.name + "(" + argsStr + ")", new Set());

        let returnVal = fn.returnType === "void" ? null : defaultValue(fn.returnType);
        try {
            this.withScope(fnEnv, () => this.execBlockBody(fn.funcBody.body, fnEnv));
        } catch (e) {
            if (e instanceof ReturnValue) {
                returnVal = e.value;
            } else {
                this._callStack.pop();
                throw e;
            }
        }

        this._callStack.pop();
        this.snapshot(node.line, fn.name + " devuelve " + fmt(returnVal), new Set());
        return returnVal;
    };

    // Busca una variable y confirma que contiene un arreglo unidimensional, o lanza un error en tiempo de ejecución.
    Interpreter.prototype.resolveArray = function (objNode, env) {
        if (objNode.type !== "Variable") throw new RuntimeError("Acceso a arreglo no válido", objNode.line);
        const cell = env.lookup(objNode.name);
        if (!cell) throw new RuntimeError("Arreglo no declarado: '" + objNode.name + "'", objNode.line);
        if (cell.kind !== "array") throw new RuntimeError("'" + objNode.name + "' no es un arreglo unidimensional", objNode.line);
        return cell;
    };

    // Busca una variable y confirma que contiene una matriz, o lanza un error en tiempo de ejecución.
    Interpreter.prototype.resolveMatrix = function (objNode, env) {
        if (objNode.type !== "Variable") throw new RuntimeError("Acceso a matriz no válido", objNode.line);
        const cell = env.lookup(objNode.name);
        if (!cell) throw new RuntimeError("Matriz no declarada: '" + objNode.name + "'", objNode.line);
        if (cell.kind !== "matrix") throw new RuntimeError("'" + objNode.name + "' no es una matriz", objNode.line);
        return cell;
    };

    // Evalúa la combinación destino/operador de una asignación (=, +=, -=, ...) y escribe el valor resultante.
    Interpreter.prototype.evalAssignment = function (node, env, changed) {
        const t = node.target;
        let current, setter, name, label, cellType;

        if (t.type === "Variable") {
            const cell = env.lookup(t.name);
            if (!cell) throw new RuntimeError("Variable no declarada: '" + t.name + "'", node.line);
            cellType = cell.type; current = cell.value; name = t.name; label = t.name;
            setter = (v) => { cell.value = v; };
        } else if (t.type === "ArrayAccess") {
            const arr = this.resolveArray(t.object, env);
            const idx = Math.trunc(this.evalExpr(t.index, env, changed));
            if (idx < 0 || idx >= arr.length) throw new RuntimeError("Índice fuera de rango: [" + idx + "]", node.line);
            cellType = arr.type; current = arr.values[idx]; name = t.object.name; label = t.object.name + "[" + idx + "]";
            setter = (v) => { arr.values[idx] = v; };
        } else if (t.type === "MatrixAccess") {
            const m = this.resolveMatrix(t.object, env);
            const r = Math.trunc(this.evalExpr(t.indices[0], env, changed));
            const c = Math.trunc(this.evalExpr(t.indices[1], env, changed));
            if (r < 0 || r >= m.rows || c < 0 || c >= m.cols)
                throw new RuntimeError("Índice de matriz fuera de rango: [" + r + "," + c + "]", node.line);
            cellType = m.type; current = m.values[r][c]; name = t.object.name; label = t.object.name + "[" + r + "," + c + "]";
            setter = (v) => { m.values[r][c] = v; };
        } else throw new RuntimeError("Destino de asignación no válido", node.line);

        let rhs = this.evalExpr(node.value, env, changed);
        let result;
        if (node.operator === "=") result = rhs;
        else {
            const base = current === null ? 0 : current;
            switch (node.operator) {
                case "+=": result = (typeof base === "string" || typeof rhs === "string") ? fmtPrint(base) + fmtPrint(rhs) : base + rhs; break;
                case "-=": result = base - rhs; break;
                case "*=": result = base * rhs; break;
                case "/=": result = cellType === "int" ? Math.trunc(base / rhs) : base / rhs; break;
                case "%=": result = base % rhs; break;
            }
        }
        result = coerce(cellType, result);

        // Para asignaciones a celdas de arreglo/matriz con una expresión real de por medio (no un literal/variable suelto),
        // registra cómo se resuelve la expresión con los valores actuales, para el panel de "paso actual" de la UI.
        if (node.operator === "=" && (t.type === "ArrayAccess" || t.type === "MatrixAccess") &&
                (node.value.type === "Binary" || node.value.type === "Unary")) {
            const exprText = this.src(node.value);
            const resolvedText = this.srcResolved(node.value, env);
            this._lastAssignCtx = {
                label, exprText, resolvedText,
                showResolved: exprText !== resolvedText,
                result
            };
        } else {
            this._lastAssignCtx = null;
        }

        setter(result);
        changed.add(name);
        if (t.type !== "Variable") changed.add(label);
        node.__label = label; node.__result = result;
        return result;
    };

    // Igual que src(), pero sustituye variables y lecturas de arreglo/matriz por su valor actual.
    Interpreter.prototype.srcResolved = function (n, env) {
        if (!n) return "";
        switch (n.type) {
            case "Literal":
                if (n.raw === "string") return '"' + n.value + '"';
                if (n.raw === "char") return "'" + n.value + "'";
                return String(n.value);
            case "Variable": {
                const cell = env.lookup(n.name);
                return (cell && cell.kind === "scalar" && cell.value !== null) ? String(cell.value) : n.name;
            }
            case "Binary":
                return this.binOperandText(n.left, n.operator, false, (c) => this.srcResolved(c, env)) + " " + n.operator + " " +
                    this.binOperandText(n.right, n.operator, true, (c) => this.srcResolved(c, env));
            case "Unary":
                return n.operator + this.srcResolved(n.argument, env);
            case "ArrayAccess":
            case "MatrixAccess":
                try { return String(this.evalExpr(n, env, new Set())); } catch (e) { return this.src(n); }
            default:
                return this.src(n);
        }
    };

    // Evalúa ++/-- sobre una variable o celda de arreglo/matriz, devolviendo el valor previo o posterior a la actualización.
    Interpreter.prototype.evalUpdate = function (node, env, changed) {
        const t = node.argument;
        let ref;
        if (t.type === "Variable") {
            const cell = env.lookup(t.name);
            if (!cell) throw new RuntimeError("Variable no declarada: '" + t.name + "'", node.line);
            ref = { get: () => cell.value, set: (v) => { cell.value = coerce(cell.type, v); }, name: t.name, label: t.name };
        } else if (t.type === "ArrayAccess") {
            const arr = this.resolveArray(t.object, env);
            const idx = Math.trunc(this.evalExpr(t.index, env, changed));
            ref = { get: () => arr.values[idx], set: (v) => { arr.values[idx] = coerce(arr.type, v); }, name: t.object.name, label: t.object.name + "[" + idx + "]" };
        } else if (t.type === "MatrixAccess") {
            const m = this.resolveMatrix(t.object, env);
            const r = Math.trunc(this.evalExpr(t.indices[0], env, changed));
            const c = Math.trunc(this.evalExpr(t.indices[1], env, changed));
            ref = { get: () => m.values[r][c], set: (v) => { m.values[r][c] = coerce(m.type, v); }, name: t.object.name, label: t.object.name + "[" + r + "," + c + "]" };
        } else throw new RuntimeError("Operando de ++/-- no válido", node.line);

        const old = ref.get() === null ? 0 : ref.get();
        const nv = node.operator === "++" ? old + 1 : old - 1;
        ref.set(nv);
        changed.add(ref.name);
        node.__label = ref.label; node.__result = nv;
        return node.prefix ? nv : old;
    };

    // Evalúa un operador binario, con cortocircuito en && y ||, aplicando reglas aritméticas/de comparación al estilo C#.
    Interpreter.prototype.evalBinary = function (node, env, changed) {
        if (node.operator === "&&") {
            if (!truthy(this.evalExpr(node.left, env, changed))) return false;
            return truthy(this.evalExpr(node.right, env, changed));
        }
        if (node.operator === "||") {
            if (truthy(this.evalExpr(node.left, env, changed))) return true;
            return truthy(this.evalExpr(node.right, env, changed));
        }
        const a = this.evalExpr(node.left, env, changed);
        const b = this.evalExpr(node.right, env, changed);
        switch (node.operator) {
            case "+":
                if (typeof a === "string" || typeof b === "string") return fmtPrint(a) + fmtPrint(b);
                return a + b;
            case "-": return a - b;
            case "*": return a * b;
            case "/":
                if (b === 0) throw new RuntimeError("División entre cero", node.line);
                return (Number.isInteger(a) && Number.isInteger(b)) ? Math.trunc(a / b) : a / b;
            case "%":
                if (b === 0) throw new RuntimeError("Módulo entre cero", node.line);
                return a % b;
            case "==": return looseEq(a, b);
            case "!=": return !looseEq(a, b);
            case "<": return a < b;
            case "<=": return a <= b;
            case ">": return a > b;
            case ">=": return a >= b;
            default: throw new RuntimeError("Operador no soportado: " + node.operator, node.line);
        }
    };

    // Tabla de precedencia de operadores binarios, usada para reinsertar paréntesis al mostrar una expresión
    // como texto (el AST no recuerda los paréntesis originales, así que sin esto "(i + 1) * 10" se vería como "i + 1 * 10").
    const BIN_PREC = {
        "*": 5, "/": 5, "%": 5,
        "+": 4, "-": 4,
        "<": 3, "<=": 3, ">": 3, ">=": 3,
        "==": 2, "!=": 2,
        "&&": 1, "||": 0
    };

    // Renderiza un operando de una expresión binaria como texto, agregando paréntesis cuando la precedencia lo exige.
    Interpreter.prototype.binOperandText = function (child, parentOp, isRight, renderFn) {
        const text = renderFn(child);
        if (child.type !== "Binary") return text;
        const childPrec = BIN_PREC[child.operator];
        const parentPrec = BIN_PREC[parentOp];
        const needsParens = isRight ? (childPrec <= parentPrec) : (childPrec < parentPrec);
        return needsParens ? "(" + text + ")" : text;
    };

    // Construye el texto legible de "qué acaba de pasar" para el snapshot de una sentencia de expresión.
    Interpreter.prototype.describeExprStmt = function (expr, result) {
        if (expr.type === "Assignment") return (expr.__label || this.src(expr.target)) + " = " + fmt(expr.__result);
        if (expr.type === "Update")
            return (expr.prefix ? expr.operator : "") + (expr.__label || this.src(expr.argument)) +
                (expr.prefix ? "" : expr.operator) + "  → " + fmt(expr.__result);
        return this.src(expr);
    };

    // Convierte un nodo de expresión del AST de vuelta a texto tipo C#, para mostrarlo en la UI.
    Interpreter.prototype.src = function (n) {
        if (!n) return "";
        switch (n.type) {
            case "Literal":
                if (n.raw === "string") return '"' + n.value + '"';
                if (n.raw === "char") return "'" + n.value + "'";
                return String(n.value);
            case "Variable": return n.name;
            case "Binary":
                return this.binOperandText(n.left, n.operator, false, (c) => this.src(c)) + " " + n.operator + " " +
                    this.binOperandText(n.right, n.operator, true, (c) => this.src(c));
            case "Unary": return n.operator + this.src(n.argument);
            case "Update": return n.prefix ? n.operator + this.src(n.argument) : this.src(n.argument) + n.operator;
            case "Assignment": return this.src(n.target) + " " + n.operator + " " + this.src(n.value);
            case "ArrayAccess": return this.src(n.object) + "[" + this.src(n.index) + "]";
            case "MatrixAccess": return this.src(n.object) + "[" + this.src(n.indices[0]) + "," + this.src(n.indices[1]) + "]";
            case "Member": return this.src(n.object) + "." + n.name;
            case "Call": return this.src(n.object) + "." + n.name + "(" + n.arguments.map(a => this.src(a)).join(", ") + ")";
            case "FunctionCall": return n.name + "(" + n.arguments.map(a => this.src(a)).join(", ") + ")";
            case "Conditional": return this.src(n.test) + " ? " + this.src(n.consequent) + " : " + this.src(n.alternate);
            default: return "";
        }
    };

    // Convierte cualquier valor a un booleano de JS, siguiendo la semántica de condiciones de C#.
    function truthy(v) { return !!v; }
    // Compara dos valores por igualdad; las cadenas deben coincidir exactamente, los demás tipos usan comparación laxa (==).
    function looseEq(a, b) {
        if (typeof a === "string" || typeof b === "string") return a === b;
        return a == b;
    }
    // Formatea un valor para la vista tipo "debug" (cadenas entre comillas, booleanos en minúscula).
    function fmt(v) {
        if (v === null || v === undefined) return "null";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "string") return '"' + v + '"';
        return String(v);
    }
    // Formatea un valor como lo haría Console.WriteLine (sin comillas, booleanos al estilo C#).
    function fmtPrint(v) {
        if (v === null || v === undefined) return "";
        if (typeof v === "boolean") return v ? "True" : "False";
        return String(v);
    }

    // Punto de entrada público: lexea, parsea e interpreta código C#, devolviendo tokens/ast/snapshots/salida/error.
    function compileAndRun(src, options) {
        const tokens = lex(src);
        const ast = parse(tokens);
        const interp = new Interpreter(ast, options);
        const result = interp.run();
        return { tokens, ast, snapshots: result.snapshots, output: result.output, error: result.error };
    }

    const api = { lex, parse, Interpreter, compileAndRun, CompileError, RuntimeError };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.CSharpEngine = api;

})(typeof window !== "undefined" ? window : globalThis);
