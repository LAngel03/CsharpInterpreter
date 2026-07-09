/* ============================================================
   MOTOR DEL SIMULADOR C#  (lexer + parser + intérprete)
   Subconjunto controlado de C# para fines educativos.
   Diseñado para correr tanto en navegador como en Node.

   Flujo:  Código → Lexer → Parser → AST → Intérprete → Snapshots

   ÍNDICE DE SECCIONES
     1. LEXER        — convierte el texto fuente en una lista de
                       tokens (números, identificadores, símbolos…).
     2. ERRORES      — CompileError (fase léxica/sintáctica) y
                       RuntimeError (fase de ejecución), ambos con línea.
     3. PARSER       — descenso recursivo que construye el AST
                       respetando la precedencia de operadores.
     4. ENTORNO      — Environment: cadena de ámbitos (scopes) para
                       resolver variables.
     5. INTÉRPRETE   — recorre el AST ("tree-walking") y, en cada
                       instrucción, registra un SNAPSHOT del estado
                       (variables, arreglos, matrices, salida, línea
                       actual y qué cambió).
     6. API PÚBLICA  — CSharpEngine.compileAndRun(src, {maxSteps}).

   SALIDA DE compileAndRun:
     { tokens, ast, snapshots, output, error }
     Cada snapshot = { step, currentLine, description,
                       variables[], arrays[], matrices[],
                       output[], changed[], isError }
   ============================================================ */
(function (root) {
  "use strict";

  /* ---------------------------------------------------------
     1. LEXER
     --------------------------------------------------------- */
  const KEYWORDS = new Set([
    "int", "double", "float", "string", "bool", "char",
    "if", "else", "switch", "case", "default",
    "for", "while", "do", "new", "true", "false",
    "break", "continue", "return", "void", "static"
  ]);

  const TYPE_KEYWORDS = new Set(["int", "double", "float", "string", "bool", "char"]);

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

      const singles = "+-*/%=<>!(){}[],;.&|:";
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

  /* ---------------------------------------------------------
     Errores
     --------------------------------------------------------- */
  function CompileError(message, line) {
    this.name = "CompileError"; this.message = message; this.line = line || 0;
  }
  CompileError.prototype = Object.create(Error.prototype);

  function RuntimeError(message, line) {
    this.name = "RuntimeError"; this.message = message; this.line = line || 0;
  }
  RuntimeError.prototype = Object.create(Error.prototype);

  /* ---------------------------------------------------------
     2. PARSER  (descenso recursivo -> AST)
     --------------------------------------------------------- */
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

    function parseProgram() {
      const functions = [], body = [];
      while (!atEnd()) {
        if (check("KEYWORD", "static")) functions.push(parseFunctionDecl());
        else body.push(parseStatement());
      }
      return { type: "Program", functions, body };
    }

    function parseFunctionDecl() {
      const line = next().line;                               // consume 'static'
      const retTypeTok = next();                              // void / int / string …
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

    function parseBlock() {
      expect("PUNCT", "{");
      const body = [];
      while (!check("PUNCT", "}") && !atEnd()) body.push(parseStatement());
      expect("PUNCT", "}");
      return { type: "Block", body };
    }

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

    function parseWhile() {
      const line = next().line;
      expect("PUNCT", "(");
      const test = parseExpression();
      expect("PUNCT", ")");
      const body = parseStatement();
      return { type: "While", test, body, line };
    }

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
    function parseExpression() { return parseAssignment(); }

    function parseAssignment() {
      const left = parseLogicalOr();
      if (peek().type === "OP" && ASSIGN_OPS.has(peek().value)) {
        const opTok = next();
        const right = parseAssignment();
        if (!["Variable", "ArrayAccess", "MatrixAccess"].includes(left.type))
          throw new CompileError("El lado izquierdo de '=' no es asignable", opTok.line);
        return { type: "Assignment", operator: opTok.value, target: left, value: right, line: opTok.line };
      }
      return left;
    }

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
    const parseMultiplicative = binaryLevel(() => parseUnary(), ["*", "/", "%"]);
    const parseAdditive = binaryLevel(() => parseMultiplicative(), ["+", "-"]);
    const parseRelational = binaryLevel(() => parseAdditive(), ["<", "<=", ">", ">="]);
    const parseEquality = binaryLevel(() => parseRelational(), ["==", "!="]);
    const parseLogicalAnd = binaryLevel(() => parseEquality(), ["&&"]);
    const parseLogicalOr = binaryLevel(() => parseLogicalAnd(), ["||"]);

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

  /* ---------------------------------------------------------
     3. INTÉRPRETE  (genera snapshots)
     --------------------------------------------------------- */
  const BREAK = { signal: "break" };
  const CONTINUE = { signal: "continue" };
  function ReturnValue(val) { this.value = val; }

  function Environment(parent) { this.vars = new Map(); this.parent = parent || null; }
  Environment.prototype.define = function (name, cell) { this.vars.set(name, cell); };
  Environment.prototype.lookup = function (name) {
    let e = this; while (e) { if (e.vars.has(name)) return e.vars.get(name); e = e.parent; } return null;
  };

  function defaultValue(type) {
    switch (type) {
      case "int": case "double": case "float": return 0;
      case "bool": return false;
      case "char": return "\0";
      case "string": return null;
      default: return null;
    }
  }

  function coerce(type, v) {
    if (v === null || v === undefined) return v;
    if (type === "int") return Math.trunc(Number(v));
    if (type === "double" || type === "float") return Number(v);
    if (type === "bool") return Boolean(v);
    if (type === "char") return typeof v === "string" ? v[0] : String.fromCharCode(v);
    if (type === "string") return String(v);
    return v;
  }

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
    this._functions = {};
    this._callStack = [];
    this._files = {};
  }

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

  Interpreter.prototype.tick = function () {
    this.steps++;
    if (this.steps > this.maxSteps)
      throw new RuntimeError("Se superó el límite de pasos (" + this.maxSteps +
        "). ¿Hay un ciclo infinito?", 0);
  };

  Interpreter.prototype.snapshot = function (line, description, changed, isError) {
    const variables = [], arrays = [], matrices = [];
    const seen = new Set();
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
      callStack: this._callStack.map(f => ({ name: f.name, args: Object.assign({}, f.args) })),
      files: Object.assign({}, this._files),
      isError: !!isError
    });
    this._reads = new Set();
  };

  Interpreter.prototype.withScope = function (env, fn) {
    this._scopeStack.push(env);
    try { return fn(); } finally { this._scopeStack.pop(); }
  };

  Interpreter.prototype.execBlockBody = function (body, env) {
    for (const stmt of body) this.execStatement(stmt, env);
  };

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

  Interpreter.prototype.execVarDecl = function (stmt, env) {
    const changed = new Set();
    let value = defaultValue(stmt.dataType);
    if (stmt.init) value = coerce(stmt.dataType, this.evalExpr(stmt.init, env, changed));
    env.define(stmt.name, { kind: "scalar", type: stmt.dataType, value });
    changed.add(stmt.name);
    this.snapshot(stmt.line, "Declarar " + stmt.dataType + " " + stmt.name + " = " + fmt(value), changed);
  };

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

  Interpreter.prototype.execMatrixDecl = function (stmt, env) {
    const changed = new Set();
    let rows = 0, cols = 0, values = [];
    if (stmt.init) {
      if (stmt.init.type !== "MatrixCreation")
        throw new RuntimeError("Inicializador de matriz no válido", stmt.line);
      rows = Math.trunc(this.evalExpr(stmt.init.rows, env, changed));
      cols = Math.trunc(this.evalExpr(stmt.init.cols, env, changed));
      for (let r = 0; r < rows; r++) values.push(new Array(cols).fill(null));
    }
    env.define(stmt.name, { kind: "matrix", type: stmt.dataType, rows, cols, values });
    changed.add(stmt.name);
    this.snapshot(stmt.line, "Declarar matriz " + stmt.dataType + "[,] " + stmt.name + " (" + rows + "x" + cols + ")", changed);
  };

  Interpreter.prototype.execIf = function (stmt, env) {
    const changed = new Set();
    const cond = truthy(this.evalExpr(stmt.test, env, changed));
    this.snapshot(stmt.line, "if (" + this.src(stmt.test) + ") → " + (cond ? "verdadero" : "falso"), changed);
    if (cond) this.execStatement(stmt.consequent, env);
    else if (stmt.alternate) this.execStatement(stmt.alternate, env);
  };

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

  Interpreter.prototype.execFor = function (stmt, env) {
    const loopEnv = new Environment(env);
    this.withScope(loopEnv, () => {
      if (stmt.init) this.execStatement(stmt.init, loopEnv);

      // Activar panel del ciclo for
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
        // Restaurar contexto (loops anidados)
        this._activeFor      = savedFor;
        this._lastCondResult = savedCond;
      }
    });
  };

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

  Interpreter.prototype.isWriteLine = function (node) {
    return node.type === "Call" && node.name === "WriteLine" &&
      node.object && node.object.type === "Variable" && node.object.name === "Console";
  };

  Interpreter.prototype.isFileVoidCall = function (node) {
    return node.type === "Call" &&
      node.object && node.object.type === "Variable" && node.object.name === "File" &&
      ["WriteAllText", "AppendAllText", "Delete"].includes(node.name);
  };

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
      default: throw new RuntimeError("Expresión no soportada: " + node.type, node.line);
    }
  };

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

  Interpreter.prototype.resolveArray = function (objNode, env) {
    if (objNode.type !== "Variable") throw new RuntimeError("Acceso a arreglo no válido", objNode.line);
    const cell = env.lookup(objNode.name);
    if (!cell) throw new RuntimeError("Arreglo no declarado: '" + objNode.name + "'", objNode.line);
    if (cell.kind !== "array") throw new RuntimeError("'" + objNode.name + "' no es un arreglo unidimensional", objNode.line);
    return cell;
  };

  Interpreter.prototype.resolveMatrix = function (objNode, env) {
    if (objNode.type !== "Variable") throw new RuntimeError("Acceso a matriz no válido", objNode.line);
    const cell = env.lookup(objNode.name);
    if (!cell) throw new RuntimeError("Matriz no declarada: '" + objNode.name + "'", objNode.line);
    if (cell.kind !== "matrix") throw new RuntimeError("'" + objNode.name + "' no es una matriz", objNode.line);
    return cell;
  };

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
    setter(result);
    changed.add(name);
    if (t.type !== "Variable") changed.add(label);
    node.__label = label; node.__result = result;
    return result;
  };

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

  Interpreter.prototype.describeExprStmt = function (expr, result) {
    if (expr.type === "Assignment") return (expr.__label || this.src(expr.target)) + " = " + fmt(expr.__result);
    if (expr.type === "Update")
      return (expr.prefix ? expr.operator : "") + (expr.__label || this.src(expr.argument)) +
        (expr.prefix ? "" : expr.operator) + "  → " + fmt(expr.__result);
    return this.src(expr);
  };

  Interpreter.prototype.src = function (n) {
    if (!n) return "";
    switch (n.type) {
      case "Literal":
        if (n.raw === "string") return '"' + n.value + '"';
        if (n.raw === "char") return "'" + n.value + "'";
        return String(n.value);
      case "Variable": return n.name;
      case "Binary": return this.src(n.left) + " " + n.operator + " " + this.src(n.right);
      case "Unary": return n.operator + this.src(n.argument);
      case "Update": return n.prefix ? n.operator + this.src(n.argument) : this.src(n.argument) + n.operator;
      case "Assignment": return this.src(n.target) + " " + n.operator + " " + this.src(n.value);
      case "ArrayAccess": return this.src(n.object) + "[" + this.src(n.index) + "]";
      case "MatrixAccess": return this.src(n.object) + "[" + this.src(n.indices[0]) + "," + this.src(n.indices[1]) + "]";
      case "Member": return this.src(n.object) + "." + n.name;
      case "Call": return this.src(n.object) + "." + n.name + "(" + n.arguments.map(a => this.src(a)).join(", ") + ")";
      case "FunctionCall": return n.name + "(" + n.arguments.map(a => this.src(a)).join(", ") + ")";
      default: return "";
    }
  };

  function truthy(v) { return !!v; }
  function looseEq(a, b) {
    if (typeof a === "string" || typeof b === "string") return a === b;
    return a == b; // eslint-disable-line eqeqeq
  }
  function fmt(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "string") return '"' + v + '"';
    return String(v);
  }
  function fmtPrint(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "True" : "False";
    return String(v);
  }

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
