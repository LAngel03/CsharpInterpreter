window.temas = window.temas || {};

Object.assign(window.temas, {
    if_simple: {
        titulo: "Condicional simple (if)",
        definicion: "Ejecuta un bloque solo si la condición se cumple. Si no, el programa sigue de largo."
    },
    switch_simple: {
        titulo: "Switch simple",
        definicion: "Evalúa un valor y salta directo al case que coincide. Si ninguno coincide, entra al default."
    },
    ternario_simple: {
        titulo: "Operador ternario simple",
        definicion: "Una decisión en una sola línea: condición ? valor_si_verdadero : valor_si_falso."
    },
    if_anidada: {
        titulo: "Condicional anidada",
        definicion: "Un if dentro de otro if. La segunda decisión solo se evalúa si la primera resultó verdadera."
    },
    switch_anidada: {
        titulo: "Switch con lógica anidada",
        definicion: "Un case que, además de coincidir, contiene su propia decisión (un if interno) para afinar el resultado."
    },
    ternario_anidada: {
        titulo: "Ternario anidado",
        definicion: "Varios ternarios encadenados para elegir entre más de dos opciones, de mayor a menor."
    },
    if_compuesta: {
        titulo: "Condicional compuesta",
        definicion: "Una sola condición que combina varias con && (y) u || (o). Deben cumplirse según el operador."
    },
    switch_compuesta: {
        titulo: "Switch tipo menú",
        definicion: "Un switch que ejecuta operaciones distintas según la opción elegida, como un menú de acciones."
    },
    ternario_compuesta: {
        titulo: "Ternario con condición compuesta",
        definicion: "Un ternario cuya condición combina dos comprobaciones con && u ||."
    }
});