/* js/temas/operadores.js
   Registra los temas de Operadores en window.temas para que
   cargarTema() (en script.js) no se salga por el guard inicial
   `if (!window.temas || !window.temas[nombreTema]) return;`
   y así inserte las consolas del workspace.

   El contenido real (definición, ejemplos, ejercicio) viene de la API;
   estos objetos solo necesitan existir con su título/definición de
   respaldo. El simulador (simulator.js) sobreescribe la definición
   con la que trae la base de datos.
*/
window.temas = window.temas || {};

window.temas.operadores_logicos = {
    titulo: "Operadores lógicos",
    definicion: "Combinan condiciones de verdadero/falso: && (Y) pide que ambas se cumplan, || (O) pide al menos una, y ! (NO) invierte el valor."
};

window.temas.operadores_aritmeticos = {
    titulo: "Operadores aritméticos",
    definicion: "Hacen operaciones matemáticas: + (suma), - (resta), * (multiplicación), / (división) y % (residuo o módulo)."
};

window.temas.operadores_relacionales = {
    titulo: "Operadores relacionales",
    definicion: "Comparan dos valores y dan verdadero o falso: >, <, >=, <=, == (igual) y != (diferente)."
};