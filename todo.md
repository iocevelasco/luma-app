# Seguimiento

Cada ítem se redacta como tarea por hacer. Cuando queda resuelto, se marca.

## Presupuesto

- [x] Aceptar nombres de partida de hasta 500 caracteres. El tope de 160 rechazaba partidas reales (171, 176 y 180 caracteres) al guardar el presupuesto.
- [x] Al importar, si una partida no pasa la validación, decir en pantalla cuáles son y no dejar la confirmación en silencio.
- [x] En el formulario manual, mostrar el mismo aviso cuando el guardado falla por una partida.
- [x] Si el nombre es lo que se pasa de largo, decirlo aparte e indicar el tope y los números de partida.
- [x] Contar las partidas desde 1, aunque la validación las numere desde 0.
- [x] Aceptar el tope de Zod tanto si viene como número como si viene como `bigint`, para que el aviso no rompa la compilación.
- [x] Dejar el texto del aviso en español de Argentina, español de España y portugués.

## Miniaturas de la documentación

- [x] Mostrar una miniatura de las imágenes en el explorador de Documentación, en la lista y en las tarjetas.
- [x] Pedir la imagen ya reducida al servicio de medios: `sm` en la fila y `md` en la tarjeta, sobre la URL firmada.
- [x] Dejar el ícono de archivo en PDF y en cualquier documento que no sea imagen, o que todavía no tenga URL.
- [x] Leer la URL vigente en cada pintado. La librería congela el callback del primer render y la firma vence a la hora.
- [x] Recortar la miniatura para que llene el cuadro de la tarjeta y quepa en la celda del nombre.
