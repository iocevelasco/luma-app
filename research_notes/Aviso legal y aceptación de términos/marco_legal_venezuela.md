# Marco legal venezolano para una app SaaS: datos personales, confidencialidad, seguridad y aceptación electrónica de términos

Fecha de las notas: 2026-10-24. No es asesoría legal. Las citas textuales de artículos que figuran abajo se extrajeron de textos oficiales reproducidos en línea (OEA, Gaceta Oficial en PDF, Justia); lo que no pude verificar en una fuente está marcado como tal en "Gaps". Distinción usada: **[LEY VIGENTE]** = norma citada con artículo; **[JURISPRUDENCIA]** = criterio del TSJ; **[BUENA PRÁCTICA]** = referencia comparada o recomendación, no obligatoria en Venezuela.

## 1. Constitución (arts. 28, 48, 60): datos personales y privacidad

### Takeaway
La CRBV 1999 reconoce habeas data (art. 28), secreto de comunicaciones (art. 48) y protección de honor, vida privada, intimidad, imagen, confidencialidad y reputación (art. 60). Como no hay ley que los desarrolle, la Sala Constitucional del TSJ llenó el vacío con principios (sent. 1318 del 4/8/2011) que son el estándar más cercano a una "ley de datos" y sirven de base para un aviso de privacidad.

### Cited Findings
- **[LEY VIGENTE] Art. 60 CRBV**: "Toda persona tiene derecho a la protección de su honor, vida privada, intimidad, propia imagen, confidencialidad y reputación." — [texto constitucional reproducido (CEJA)](https://biblioteca.cejamericas.org/bitstreams/ae594f9e-5e8f-45f2-aeaa-0654012de698/download); descrito igual en [DLA Piper](https://www.dlapiperdataprotection.com/index.html?c=VE&t=law)
- **[LEY VIGENTE] Art. 48 CRBV**: "Se garantiza el secreto e inviolabilidad de las comunicaciones privadas en todas sus formas. No podrán ser interferidas sino por orden de un tribunal competente..." — [CEJA](https://biblioteca.cejamericas.org/bitstreams/ae594f9e-5e8f-45f2-aeaa-0654012de698/download)
- **[LEY VIGENTE] Art. 28 CRBV (habeas data)**: acceso a la información sobre uno mismo en registros públicos o privados, conocer su uso y finalidad, y pedir actualización, rectificación o destrucción — paráfrasis en [DLA Piper](https://www.dlapiperdataprotection.com/index.html?c=VE&t=law) e [IAPP](https://iapp.org/news/a/venezuela-data-breach-highlights-scattered-privacy-regulation). Texto literal no verificado (ver Gaps).
- La Sala Constitucional ha dicho que ante lesión concreta de derechos del art. 28 la vía es el amparo (sent. 1050, 23/8/2000, "Ruth Capriles") — resumen en búsqueda de [vLex/TSJ](https://vlexvenezuela.com/vid/yanuario-roberto-sousa-guerrero-283386263) (fuente secundaria).
- **[JURISPRUDENCIA] Sent. Sala Constitucional del 4/8/2011** (n.º 1318 según DLA Piper e IAPP; caso sobre art. 192 de la Ley General de Bancos y SICRI) fija principios: consentimiento previo, libre, informado, inequívoco y revocable; legalidad; finalidad y calidad (no excesivo); seguridad y confidencialidad (protección contra alteración, pérdida, acceso no autorizado; restricción a transferencias a países sin protección adecuada); conservación limitada; exactitud; tutela (acceso, rectificación, supresión, vía judicial); responsabilidad civil, penal y administrativa; datos sensibles solo con consentimiento — [Espacio Público](https://espaciopublico.ong/proteccion-de-datos-en-venezuela-segun-la-sala-constitucional/); [DLA Piper](https://www.dlapiperdataprotection.com/index.html?c=VE&t=law)
- **[JURISPRUDENCIA]** Sent. 1335 (8/8/2011): datos médicos sensibles, confidencialidad estricta. Sent. 855 (8/5/2012): dato personal = información sobre persona identificada o identificable — [DLA Piper](https://www.dlapiperdataprotection.com/index.html?c=VE&t=law)
- Estado práctico: sin autoridad de protección de datos, sin registro de bases, sin DPO obligatorio, sin deber legal de notificar brechas (DLA Piper, revisado por última vez en 2022) — [DLA Piper](https://www.dlapiperdataprotection.com/index.html?c=VE&t=law); IAPP coincide en que no hay requisito claro de notificar brechas — [IAPP](https://iapp.org/news/a/venezuela-data-breach-highlights-scattered-privacy-regulation)
- **[LEY VIGENTE] Ley sobre Protección a la Privacidad de las Comunicaciones (G.O. 34.863, 16/12/1991)**, art. 2: pena de 3 a 5 años a quien "arbitraria, clandestina o fraudulentamente" registre o se inmiscuya en una comunicación ajena, y a quien difunda su contenido — [texto](https://www.knobbe.com/sites/default/files/2021-04/ley-sobre-proteccion-a-la-privacidad-de-las-comunicaciones.pdf) (resumido vía búsqueda; art. 3 sanciona instalar aparatos de grabación sin autorización)

### Inferences
- Un aviso de privacidad "a la venezolana" se apoya legítimamente en art. 28/60 CRBV + los principios de la sent. 2011. Redactarlo con esos principios (finalidad, consentimiento revocable, acceso/rectificación/supresión, seguridad, conservación) es defendible como cumplimiento del estándar judicial, aunque no haya ley.
- Los comprobantes y finanzas de obra de terceros (clientes, proveedores, cuadrillas) son datos personales cuando identifican personas; conviene que la app trate al cliente como responsable de lo que carga y a Luma como encargado/operador (distinción de origen GDPR/LGPD, no venezolana).

### Gaps
- Texto literal del art. 28 CRBV no verificado en esta sesión: el PDF de la CEJA que se pudo extraer no corresponde de forma fiable a ese artículo (mostraba un texto distinto), por lo que no lo cito literalmente. Verificar en Gaceta Oficial 5.453 Extraordinario (24/3/2000) o en la web del TSJ/Asamblea.
- No pude verificar el número exacto "1318" en la fuente primaria (TSJ); Espacio Público solo da la fecha.

## 2. ¿Hay ley integral de protección de datos en 2026?

### Takeaway
No encontré evidencia de una ley integral vigente ni de un proyecto activo en la Asamblea Nacional a octubre de 2026. La regulación sigue fragmentada.

### Cited Findings
- Venezuela carece de ley integral; la protección deriva de normas dispersas y de la jurisprudencia — [IAPP](https://iapp.org/news/a/venezuela-data-breach-highlights-scattered-privacy-regulation); [DLA Piper](https://www.dlapiperdataprotection.com/index.html?c=VE&t=law); [Espacio Público](https://espaciopublico.ong/en-venezuela-se-regula-la-proteccion-de-datos-personales/)
- El artículo de IAPP no menciona ningún proyecto pendiente; creó en agosto de 2024 el Consejo Nacional de Ciberseguridad, sin claridad sobre su rol en datos personales; cita una filtración de Movistar en 2025 (más de 3,2 millones de clientes) sin notificación — [IAPP](https://iapp.org/news/a/venezuela-data-breach-highlights-scattered-privacy-regulation); [CyberPeace](https://cyberpeace.org/resources/blogs/venezuela-data-breaches-expose-fragmented-privacy-regulation)
- La Ley de Infogobierno (art. 25) remite a una ley futura sobre datos personales para limitar el uso de TI en el sector público — según resumen de búsqueda sobre el [texto de la ley](https://siteal.iiep.unesco.org/sites/default/files/sit_accion_files/10211.pdf)
- La única ley de 2026 hallada en la búsqueda fue la Ley de Amnistía (feb. 2026), sin relación — [Asamblea Nacional](https://www.asambleanacional.gob.ve/storage/documentos/botones/ley-de-amnistia-2026-20260223000136.pdf)

### Inferences
- Que no apareciera en búsquedas no prueba que no exista un anteproyecto; se debe tratar como "sin ley vigente conocida" y revisar antes de publicar.

### Gaps
- No pude consultar el sitio de la Asamblea Nacional (agenda legislativa) ni Gaceta Oficial 2025-2026. Verificar manualmente.

## 3. Ley sobre Mensajes de Datos y Firmas Electrónicas (2001): aceptación por clic y prueba

### Takeaway
La ley **[LEY VIGENTE]** (Decreto-Ley 1.204, G.O. 37.148 del 28/2/2001) da a los mensajes de datos la misma eficacia probatoria que los documentos escritos y permite formar contratos por medios electrónicos. Un clic, por sí solo, no es "firma electrónica" con valor de firma autógrafa (art. 16) salvo que cumpla requisitos o esté certificada (art. 18), pero el registro de aceptación vale como mensaje de datos y como "elemento de convicción" por sana crítica (art. 17). Por eso conviene un registro robusto.

### Cited Findings
- **Art. 4**: los mensajes de datos tendrán la misma eficacia probatoria que la ley otorga a los documentos escritos; su promoción, control, contradicción y evacuación se rigen por las pruebas libres del Código de Procedimiento Civil; impresos tienen la eficacia de copias fotostáticas — [texto de la Ley](https://database.cyberpolicyportal.org/api/files/1658413532355lx49vvqr1h.pdf)
- **Art. 2**: "Mensajes de datos" = toda información inteligible en formato electrónico que pueda almacenarse o intercambiarse por cualquier medio — mismo texto.
- **Art. 6**: formalidades legales pueden cumplirse con estos mecanismos; la firma autógrafa se satisface con un mensaje de datos con firma electrónica asociada.
- **Art. 7**: el requisito de "original" se cumple si se conserva la integridad (inalterable desde que se generó, salvo cambios de forma) y está disponible. **Art. 8**: el requisito de escrito se cumple si la información es accesible para consulta posterior; para conservación exige condiciones (archivado en formato generado/recibido, que permita determinar origen, destino, fecha y hora de envío/recepción).
- **Art. 15**: "En la formación de los contratos, las partes podrán acordar que la oferta y aceptación se realicen por medio de Mensajes de Datos." — mismo texto de la Ley. Es el fundamento directo del contrato por clic (nota: dice "podrán acordar"; en una app el acuerdo se manifiesta al usar el medio).
- **Art. 16**: la firma electrónica que permita vincular al signatario con el mensaje y atribuir autoría tiene el mismo valor que la firma autógrafa, si cumple requisitos (datos de generación únicos y confidenciales, no falsificable razonablemente, no alterable, etc.). **Art. 17**: la que no cumple "no tendrá los efectos jurídicos" del capítulo, pero puede constituir "un elemento de convicción valorable conforme a las reglas de la sana crítica". **Art. 18**: la firma certificada por un Proveedor de Servicios de Certificación acreditado se presume que cumple el art. 16.
- **Arts. 20-22**: crea la Superintendencia de Servicios de Certificación Electrónica (SUSCERTE), que acredita y supervisa a los proveedores de certificación.
- **Arts. 9-12** (atribución, recepción, lugar): por defecto el mensaje se tiene por emitido en el domicilio del emisor y por recibido en el del destinatario (art. 12); las partes pueden pactar procedimientos de verificación (art. 9).
- Jurisprudencia: la Sala de Casación Civil del TSJ (2011) consideró fidedignas impresiones de correos no impugnados; en 2007 los trató como medio de prueba atípico. Reseña crítica en [Cuestiones Jurídicas](https://revistas.fondoeditorial.uru.edu/index.php/cj/article/download/297/pdfruan2012/964) (vía resumen de búsqueda; verificar).

### Inferences
- Un registro de aceptación (usuario, fecha/hora, IP, user-agent, versión y hash del texto aceptado) encaja como mensaje de datos (art. 4) y, si es impugnado, sirve como elemento de convicción por sana crítica (art. 17); su fuerza depende de integridad (art. 7-8): conviene que sea inmutable, con sello de tiempo y conservado.
- Para máxima solidez en un contrato B2B de alto valor: aceptación afirmativa (casilla no premarcada + botón), reenvío de copia por correo (prueba de recepción, art. 11), y opcionalmente firma certificada SUSCERTE. Esto es buena práctica, no exigencia.
- La Ley no regula expresamente la "aceptación clic" ni su valor probatorio específico (IP, versión); es una aplicación por analogía de arts. 4, 15, 17.

### Gaps
- No hallé jurisprudencia venezolana específica sobre contratos "clickwrap" ni sobre registros de IP como prueba de aceptación.
- No verifiqué si hubo reformas posteriores a la Ley (2001) ni el reglamento parcial de 2004 (Decreto 3.335).

## 4. Delitos Informáticos, Infogobierno, SUSCERTE

### Takeaway
La Ley Especial contra los Delitos Informáticos **[LEY VIGENTE]** (G.O. 37.313, 30/10/2001) es lo más cercano a una ley penal de datos personales y obliga indirectamente a una app a no tratar datos sin consentimiento ni exponerlos. La Ley de Infogobierno y SUSCERTE regulan sobre todo al sector público y a certificadores; no imponen deberes directos de seguridad a un SaaS privado, hasta donde pude verificar.

### Cited Findings
- **Art. 6** acceso indebido: prisión 1 a 5 años y multa 10-50 U.T. a quien sin autorización o excediéndola acceda, intercepte, interfiera o use un sistema — [texto OEA](https://iin.oea.org/badaj/wp-content/uploads/2014/07/Ley_Especial_contra_Delitos_Inform%c3%a1ticos.pdf)
- **Art. 11** espionaje informático: obtener, revelar o difundir indebidamente data de un sistema: 4 a 8 años y 400-800 U.T., con agravantes — mismo texto.
- **Art. 20** violación de la privacidad de la data o información personal: "se apodere, utilice, modifique o elimine, sin el consentimiento de su dueño, la data o información personales de otro", incorporada en un sistema de TI: 2 a 6 años y 200-600 U.T.; agravante si hay perjuicio — mismo texto.
- **Art. 21** violación de la privacidad de las comunicaciones: 2 a 6 años y 200-600 U.T. **Art. 22** revelación indebida de data personal: 2 a 6 años; aumenta si hay lucro o perjuicio — mismo texto.
- Infogobierno (2013) aplica a órganos del Poder Público y entes públicos; los particulares no figuran en su ámbito según la fuente consultada — [Rebelión/Aporrea sobre la ley](https://www.aporrea.org/tecno/a277305.html) (fuente secundaria); texto en [SITEAL](https://siteal.iiep.unesco.org/sites/default/files/sit_accion_files/10211.pdf).
- Agosto 2024: creación del Consejo Nacional de Ciberseguridad — [IAPP](https://iapp.org/news/a/venezuela-data-breach-highlights-scattered-privacy-regulation)
- SUSCERTE: ver sección 3 (arts. 20-22 de la Ley de Mensajes de Datos).

### Inferences
- El consentimiento del titular es el eje penal (art. 20): documentar el consentimiento en los términos y en el aviso es una protección legal real, no solo formal.
- Para un privado, SUSCERTE solo importa si se quiere firma certificada; no hay obligación de registro de la app.

### Gaps
- No verifiqué si existen normas de SUSCERTE de seguridad de la información vinculantes para privados (hay normas técnicas para el sector público). Tampoco normas sectoriales de SUDEBAN/CONATEL aplicables si la app tocara pagos o telecom.
- No hallé confirmación de si la reforma anunciada de Infogobierno (2019) se aprobó.

## 5. Protección al consumidor y contratos de adhesión online

### Takeaway
No pude verificar el texto vigente de la normativa venezolana de consumo sobre contratos de adhesión. Hay que tratarlo como incertidumbre y, además, el cliente de Luma es principalmente un profesional/empresa (gerente de obra, constructora), lo que reduce la aplicabilidad de normas de consumidor.

### Cited Findings
- El Código de Comercio de 1955 no regula expresamente los contratos de adhesión, lo que permite cláusulas leoninas — [UNELLEZ (2025)](https://revistas.unellez.edu.ve/index.php/rcv/article/download/3347/3040/9399) (resumen de búsqueda).
- La regulación de consumo venezolana vigente es la Ley Orgánica de Precios Justos (Decreto 2.092; SUNDDE sucesor de Indepabis) y la Ley para la Defensa de las Personas en el Acceso a los Bienes y Servicios — [vLex](https://vlexvenezuela.com/vid/decreto-n-2-092-586963730). No verifiqué qué artículo regula contratos de adhesión ni cláusulas abusivas.

### Inferences
- Buena práctica comparada (Chile art. 16 LPC, Ecuador art. 43, Argentina art. 38 Ley 24.240): lenguaje claro, no cláusulas que eximan por completo de responsabilidad, que impongan renuncia a derechos o cambios unilaterales sin aviso; nulidad parcial. Aplicar estos criterios reduce riesgo ante un tribunal venezolano, que además puede aplicar el principio civil de interpretación contra quien redactó (no verificado) y orden público.

### Gaps
- Texto y numeración de las normas venezolanas sobre contratos de adhesión: no verificados. Pedir revisión a un abogado local (Hoet Peláez, D'Empaire, Travieso Evans, Torres Plaz, u otro).

## 6. Jurisdicción, ley aplicable y resolución de disputas

### Takeaway
La Ley de Derecho Internacional Privado (G.O. 36.511, 1998) permite elegir ley aplicable y foro por escrito, con límites de orden público; para una app que opera en Venezuela lo más seguro es elegir ley venezolana y tribunales/arbitraje venezolano o neutro razonable.

### Cited Findings
- **Art. 29**: "Las obligaciones convencionales se rigen por el Derecho indicado por las partes." — [Justia](http://venezuela.justia.com/estatales/miranda/leyes/ley-de-derecho-internacional-privado-1998/gdoc/)
- **Art. 8**: se excluye el derecho extranjero solo si produce resultados "manifiestamente incompatibles" con el orden público — mismo texto.
- **Art. 40**: tribunales venezolanos son competentes en materia patrimonial cuando las partes se someten expresa o tácitamente. **Art. 44**: "La sumisión expresa deberá constar por escrito." **Art. 45**: sumisión tácita (demandante al demandar; demandado al actuar sin declinar). **Art. 46**: límites en inmuebles — mismo texto.
- Foro general: domicilio del demandado (art. 11) — [Carmona Urdaneta](https://revistas.fondoeditorial.uru.edu/index.php/cj/article/download/vol2-num1-2008-c-111-116/pdfcarmona2008/1736) (resumen de búsqueda).
- Ley de Arbitraje Comercial en vigor desde 7/4/1998 (G.O. 36.430) — [Cambridge](https://cambridge.org/core/journals/netherlands-international-law-review/article/venezuelan-1998-act-on-private-international-law/784B9059C3B170C917060AFD20E2A344)

### Inferences
- Cláusula razonable: ley de Venezuela; tribunales del domicilio de Luma o del cliente; mediación previa opcional; arbitraje solo si se desea (contenido de la Ley de Arbitraje no verificado). Evitar foro extranjero lejano para clientes locales (riesgo de abusividad y de ejecutabilidad).
- Un contrato con aceptación electrónica cumple "constar por escrito" (art. 44 LDIP) vía art. 8 de la Ley de Mensajes de Datos (inferencia propia).

### Gaps
- No se verificó la jurisprudencia sobre cláusulas de foro en contratos de adhesión.

## 7. Referencias regionales y cuál tomar como estándar

### Takeaway
Todo lo regional es **[BUENA PRÁCTICA]**, no ley en Venezuela (salvo que se traten datos de residentes de esos países). Recomendación inferida: usar como esqueleto los principios de la sent. 1318/2011 (que ya son derecho vivo en Venezuela) y completarlos con LGPD/GDPR, que son más completos y operativos.

### Cited Findings
- Los principios de la sent. 2011 coinciden en lo sustancial con los de GDPR/LGPD (finalidad, minimización, consentimiento, conservación, exactitud, seguridad, derechos ARCO, responsabilidad) — [Espacio Público](https://espaciopublico.ong/proteccion-de-datos-en-venezuela-segun-la-sala-constitucional/).
- Referencias regionales (Ley 25.326 Argentina, LGPD Brasil, GDPR): no las consulté en fuente primaria en esta sesión.

### Inferences
- Estándar sugerido: (1) base: principios del TSJ 2011; (2) estructura de aviso y derechos: LGPD (idioma cercano, bases legales, DPO opcional, notificación de incidentes) o Ley 25.326 (más simple, pocas obligaciones); (3) GDPR solo para clientes en la UE/España (hay versión `es-ES` en la app: si hay usuarios en España, GDPR aplica por su art. 3 — afirmación de conocimiento general, no verificada aquí).
- Elementos prácticos recomendados: identidad del responsable, datos recogidos, finalidad, encargados/subencargados (hosting, Stripe, correo), transferencias internacionales, plazo de conservación, derechos y canal de ejercicio, seguridad, brechas, menores, cambios del aviso con versión y fecha.

### Gaps
- Falta fuente primaria para LGPD, Ley 25.326 y GDPR (comparación). Sugeridas: Derechos Digitales, IAPP, textos oficiales.

## Resumen de incertidumbres para el redactor
- Confirmar con abogado local: (a) vigencia 2026 de leyes citadas y ausencia de proyecto de datos; (b) normativa de consumo sobre adhesión; (c) cláusula de foro/arbitraje; (d) texto literal art. 28 CRBV.
- Las unidades tributarias (U.T.) cambiaron de valor en años recientes; no se calculó el monto en moneda actual.
