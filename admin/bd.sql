UPDATE ejercicios e
SET
  titulo = 'Acceso a sala de cine',
  descripcion = 'Un cine proyecta una película clasificada para mayores de 18 años, así que el acceso tiene dos filtros que deben cumplirse en orden. Primero se revisa la edad de la persona: si no es mayor de edad, no puede entrar y ahí termina todo. Solo si ya cumplió ese primer requisito, se revisa un segundo detalle: que traiga consigo una identificación para comprobar su edad. Tu tarea es encadenar estas dos comprobaciones, una dentro de la otra, y mostrar el mensaje correcto para cada situación posible.',
  codigo_csharp = E'int edad = 20;\n\nbool tieneIdentificacion = true;\n\nif (edad >= 18) {\n    if (tieneIdentificacion == true) {\n        Console.WriteLine("Puede entrar a la sala");\n    } else {\n        Console.WriteLine("Necesita mostrar identificación");\n    }\n} else {\n    Console.WriteLine("Es menor de edad, no puede entrar");\n}',

codigo_con_errores = E'int edad = 20;\n\nbool tieneIdentificacion = true;\n\nif (edad >= 18) {\n    if (tieneIdentificacion == true) {\n        Console.WriteLine("Puede entrar a la sala");\n    } else {\n        Console.WriteLine("Necesita mostrar identificación");\n    }\n} else {\n    Console.WriteLine("Es menor de edad, no puede entrar");\n}'
FROM
  subtemas s
WHERE
  e.subtema_id = s.id
  AND s.slug = 'if_anidada';