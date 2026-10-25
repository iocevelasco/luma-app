# Redacción de compromisos de seguridad y no uso comercial (seguridad y privacidad)

Nota de alcance: ~12 llamadas. No pude leer: Notion (404), Procore (solo menús), Basecamp/37signals sí, Mercado Pago (texto de "no vendemos" no confirmado), Reserve/Zinli/Airtm/Yummy/Binance P2P (no encontré sus políticas). Nada de esto es asesoría legal; el texto final debe revisarlo un abogado venezolano.

## 1. Cómo formulan esto apps reales

### Takeaway
Las apps serias prometen conductas concretas y verificables ("nunca vendemos", "no hay publicidad dirigida", "cifrado en tránsito") y casi todas acompañan con la salvedad de que ningún sistema es 100% seguro. Las que prometen "nunca" lo limitan a un verbo preciso (vender, monetizar) y no a "uso comercial" en general.

### Cited Findings
- 37signals (Basecamp): "We never sell your data." Pero declara que a veces corre anuncios en plataformas de terceros y puede compartir un hash del email para excluir a usuarios de sus anuncios. Usa subprocesadores ("some third-party subprocessors"). Borra contenido en 60 días tras cancelar, papelera ~25 días, purga total de logs/trash en 90 días. Cifra en tránsito (TLS) y respaldos; admite que en la mayoría de productos los datos en reposo no están cifrados campo a campo. La política no trata notificación de brechas. — [37signals Privacy](https://37signals.com/policies/privacy)
- Signal: "does not sell, rent or monetize your personal data or content in any way – ever." Guarda el mínimo en servidor; no puede descifrar contenido. Aun así reserva cumplir "applicable law, regulation, legal process or enforceable governmental request" y hacer valer sus términos. — [Signal Legal](https://signal.org/legal/)
- Proton: política base de recolectar "as little user information" como sea posible; "we do not do any targeted advertising or any profiling" (en datos de soporte); divulga solo ante pedido vinculante de autoridad suiza competente, dice que suele impugnar pedidos dudosos y publica informes de transparencia; el usuario puede acceder, editar, borrar o exportar desde su cuenta. No hay frase explícita "no vendemos". — [Proton Privacy](https://proton.me/legal/privacy)
- Stripe: "We do not transfer your Personal Data to third parties in exchange for payment", pero admite compartir con socios publicitarios/analytics (puede ser "venta/sharing" en EE. UU.) con opt-out. Seguridad: "reasonable efforts … appropriate to the risk" y "no data transmission or storage system can be guaranteed to be 100% secure". Retención mientras dure el servicio más obligaciones legales/fiscales; divulga ante solicitudes de tribunales y autoridades. — [Stripe Privacy](https://stripe.com/privacy)
- Linear: admite que ciertas divulgaciones "may constitute a 'sale'" según leyes estatales; "Service Providers" (hosting, seguridad, analytics, soporte, pagos con Stripe); retención mientras la cuenta esté abierta y más si hay deberes legales; puede conservar datos anonimizados/agregados; "no method of transmitting data over the internet or storing data is completely secure". Derechos detallados para UE/UK y California. — [Linear Privacy](https://linear.app/privacy)
- Slack: no vende información personal; actúa como procesador de datos del cliente (el cliente es controlador); subprocesadores en documento aparte; retención según instrucciones del cliente; reconoce que no puede garantizar que la información esté "absolutely safe from intrusion"; divulga ante proceso legal. Aun así comparte identificadores con anunciantes para sitios no-Slack (tráfico del sitio web, no contenido del workspace). — [Slack Privacy](https://slack.com/trust/privacy/privacy-policy)
- WhatsApp: ofrece cifrado extremo a extremo; "We do not retain your messages in the ordinary course"; mensajes no entregados hasta 30 días; pero es parte de Meta y comparte información con empresas Meta, que puede usarse para anuncios; cede ante "legal process, or government requests". Ejemplo de promesa fuerte (E2E) con carve-outs amplios en otra sección. — [WhatsApp Privacy](https://www.whatsapp.com/legal/privacy-policy)
- Mercado Pago/Mercado Libre: la declaración dice que los datos pueden compartirse con terceros y que aplica medidas "técnicas, organizacionales y administrativas" siguiendo estándares de la industria; ofrece versión "Resumen" por país, y para socios menciona derechos de acceso, rectificación, supresión y oposición por correo a un DPO. No confirmé una frase "no vendemos". — [Declaración de Privacidad MP Chile](https://www.mercadopago.cl/privacidad/declaracion-privacidad), [Resumen MP México](https://www.mercadopago.com.mx/privacidad/resumen)
- Procore y Notion: no logré leer su texto (Notion 404; Procore solo menús: enlaces a "Do Not Sell", Data Processing Addendum y "Trust & Security"). Dato útil de estructura: Procore separa privacidad, DPA y página de seguridad. — [Procore Legal](https://www.procore.com/legal/privacy)

Estructura común observada: qué datos se recogen -> para qué -> con quién se comparten (proveedores/subprocesadores) -> divulgación legal -> retención -> seguridad con salvedad -> derechos -> contacto. Las B2B (Slack, Linear) distinguen datos del cliente (procesador) de datos de cuenta/web (controlador).

### Inferences
- Nadie serio promete "nunca, bajo ningún concepto, uso comercial". Incluso Signal ("never") limita el "nunca" a vender/alquilar/monetizar y conserva excepciones legales.
- Para una app de gestión de obras (B2B), el modelo Basecamp/Slack (no vendemos, subprocesadores listados, borrado con plazos) encaja mejor que el de Signal.

### Gaps
- No pude verificar Notion ni Procore. No hay confirmación de frase "no vendemos" en Mercado Pago.

## 2. "100% seguro" vs "medidas razonables"; sanciones por promesas excesivas

### Takeaway
Declarar seguridad absoluta o específica falsa es el patrón clásico de "práctica engañosa" (FTC). El estándar de mercado es "medidas razonables/apropiadas al riesgo" más la admisión de que ningún sistema es infalible.

### Cited Findings
- Zoom (FTC, 2020): se le acusó de afirmar "end-to-end, 256-bit encryption" cuando tenía las claves y podía acceder al contenido, y de decir que las grabaciones en la nube se cifraban de inmediato cuando algunas quedaron sin cifrar hasta 60 días. La orden prohíbe tergiversar privacidad/seguridad, exige programa integral de seguridad, MFA, controles de borrado, evaluaciones independientes cada dos años y avisar a la FTC de brechas. Sin multa ni admisión de culpa. — [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2020/11/ftc-requires-zoom-enhance-its-security-practices-part-settlement)
- Drizly (FTC, orden propuesta octubre 2022): fallas de seguridad con brechas (2018, 2020) que afectaron a más de 2,5 millones de personas; la queja incluyó afirmaciones de su política de privacidad sobre seguridad (128-bit, firewalls, SSL) y la orden alcanzó también al CEO. — [VeraSafe](https://verasafe.com/blog/ftc-enforcement-lessons-security-language-privacy-notices/) (según el buscador; no pude abrir la página, 403; verificar en ftc.gov)
- Compete (FTC): orden de no tergiversar prácticas de privacidad y seguridad. — [IAPP](https://iapp.org/news/a/2012-12-01-the-ftcs-recent-settlement-with-a-web-analytics-company)
- LifeLock: pagó USD 100 millones por violar una orden previa de asegurar información de consumidores. — [GovInfoSecurity](https://www.govinfosecurity.com/lifelock-settles-ftc-case-for-100-million-a-8760)
- LabMD: el 11.º Circuito anuló una orden de la FTC por exigir un estándar de "razonabilidad" indeterminado (caso de unfairness, no de promesas). Muestra que "razonable" es vago, pero sigue siendo el estándar usado por la ley y la industria. — [Crowell](https://www.crowell.com/NewsEvents/AlertsNewsletters/all/Eleventh-Circuit-Reins-in-the-Federal-Trade-Commission)
- Stripe, Linear y Slack incluyen la salvedad explícita de que no garantizan seguridad absoluta (ver sección 1).
- Casos LatAm: no encontré sanciones específicas por promesas excesivas de seguridad. Sí hubo filtración de Cashea (feb. 2026), que la empresa confirmó diciendo que "las cuentas no fueron vulneradas"; datos expuestos: nombre, cédula, teléfono, transacciones y cuentas bancarias de comercios. — [La Patilla](https://lapatilla.com/2026/02/22/cashea-confirmo-filtracion-de-datos-de-sus-clientes-en-venezuela-que-tan-grave-es-el-incidente/)

### Inferences
- El riesgo no es solo "decir 100%": es describir controles concretos (cifrado, borrado, "no accedemos") que no sean ciertos en la práctica. Cada afirmación de la página debe tener un responsable técnico que la verifique (en Luma: p. ej. no afirmar cifrado en reposo si Mongo no lo tiene activado).
- Lo que pidió el usuario ("datos seguros", "bajo ningún concepto") expone a Luma a un reclamo de incumplimiento contractual o publicidad engañosa ante una brecha, aun sin FTC en Venezuela.

### Gaps
- Casos concretos de sanciones LatAm por security claims: no hallados. Detalles de Drizly: solo vía fuente secundaria.

## 3. Qué sí puede prometerse con honestidad

### Takeaway
Prometer conductas bajo control de la empresa y verificables, no resultados.

### Cited Findings
- Modelos de formulaciones: no vender (Signal, 37signals, Slack, Stripe con matiz), sin publicidad dirigida (Proton), cifrado en tránsito y respaldos (37signals), subprocesadores nombrados (37signals, Slack, Linear), plazos de borrado concretos (37signals 60/90 días), acceso/edición/exportación desde la cuenta (Proton), transparencia de pedidos legales (Proton). Fuentes en sección 1.
- Zoom muestra qué exigen los reguladores como mínimo creíble: programa de seguridad, MFA, gestión de vulnerabilidades, borrado, evaluaciones. — [FTC](https://www.ftc.gov/news-events/news/press-releases/2020/11/ftc-requires-zoom-enhance-its-security-practices-part-settlement)

### Inferences
Lista prometible (si es cierta técnicamente): no vendemos ni alquilamos datos; no mostramos publicidad de terceros ni cedemos datos para ello; usamos los datos de la obra solo para prestar el servicio; listamos proveedores (hosting, correo, Stripe, analítica); TLS en tránsito; respaldos; acceso por rol (la grilla de capacidades de Luma); retención y baja lógica con plazo de purga; aviso de incidentes con plazo "sin demora injustificada" o un plazo concreto que Luma pueda cumplir (ej. 72 h desde que lo confirme; el 72 h es práctica GDPR, no verificado aquí). Evitar: "100% seguro", "nadie accede", "nunca bajo ningún concepto".

### Gaps
- Plazos de notificación de incidentes: no verifiqué fuente primaria; es práctica de buena conducta, no obligación en Venezuela.

## 4. Excepciones legítimas y cómo redactarlas sin contradecir el "nunca"

### Takeaway
Declarar las excepciones en la misma sección del compromiso, y definir el "nunca" por verbo (vender, ceder para publicidad) en lugar de "fines comerciales".

### Cited Findings
- Orden judicial/ley: Signal, Slack, Stripe, WhatsApp las reservan expresamente (fuentes en sección 1).
- Procesadores de pago: Linear y Stripe indican que los datos de pago van al procesador (Stripe). — [Linear](https://linear.app/privacy)
- Datos agregados/anonimizados: Linear los conserva. — [Linear](https://linear.app/privacy)
- Proton: dice impugnar solicitudes dudosas y publicar transparencia. — [Proton](https://proton.me/legal/privacy)
- Slack: el cliente es controlador y el usuario debe dirigirse a su empleador para datos bajo su control. — [Slack](https://slack.com/trust/privacy/privacy-policy)

### Inferences
- Obras compartidas: los datos de una obra los ven gerente, supervisor y cliente según su rol; no es "compartir con terceros" sino función del producto. Conviene aclarar que lo que ve cada rol lo decide el gerente/la grilla, y que el contenido subido es responsabilidad de quien lo sube.
- Redacción sugerida: "No vendemos ni alquilamos tus datos y no los usamos para publicidad. Los usamos para prestar Luma. Sólo los compartimos (a) con los proveedores listados, para operar el servicio, (b) con las personas de tu obra según su rol, (c) si una autoridad competente nos obliga por un medio legal válido. Podemos calcular estadísticas agregadas sin identificar a nadie para mejorar el producto."
- Si Luma usa analítica o correos de producto propios, aclararlo para que "no comercial" no sea contradicho.

### Gaps
- No evalué si "estadísticas agregadas" cuenta como "fin comercial" a ojos del usuario venezolano; es decisión de redacción/producto.

## 5. Exoneraciones de responsabilidad y consistencia

### Takeaway
Las exoneraciones típicas ("sin garantías", tope de responsabilidad) son compatibles con compromisos de seguridad si estos se enuncian como obligaciones de medios ("medidas razonables") y no como garantías de resultado.

### Cited Findings
- Stripe, Linear y Slack combinan compromiso de seguridad apropiado con la admisión de que no garantizan seguridad absoluta (sección 1).
- Mercado Libre se desliga del uso que terceros den a datos en sitios enlazados. — [MP Chile](https://www.mercadopago.cl/privacidad/declaracion-privacidad/acceder-sitios-terceros-privacidad-seguridad_31233)

### Inferences
- Límites habituales (no verificados con fuente aquí): una exoneración no suele cubrir dolo o negligencia grave; y contradecirse (prometer "seguro" arriba, "sin garantías" abajo) debilita ambas cláusulas. Redactar un solo mensaje: "Hacemos X, Y, Z. Ningún sistema es infalible; si ocurre un incidente te avisamos y actuamos."
- Responsabilidad del usuario: contraseñas y accesos (Linear y Stripe lo piden).
- Revisar con abogado la validez local de topes de responsabilidad en Venezuela.

### Gaps
- No encontré fuente sobre límites de las cláusulas de exoneración en derecho venezolano.

## 6. Contexto Venezuela

### Takeaway
No hay ley integral de protección de datos; hay base constitucional y jurisprudencia. La confianza es baja por filtraciones recientes, así que la claridad y las promesas verificables pesan más que las absolutas.

### Cited Findings
- Sin ley integral; arts. 28 (habeas data: acceder, corregir, destruir datos) y 60 de la Constitución; sentencia del TSJ de 2011 con principios: consentimiento previo y revocable, finalidad válida, no excesivo, conservar solo el tiempo necesario, datos exactos, confidencialidad. Se prevé un organismo de control aún no creado; Consejo Nacional de Ciberseguridad creado en agosto 2024 con rol poco claro. — [IAPP, 19 ago 2025](https://iapp.org/news/a/venezuela-data-breach-highlights-scattered-privacy-regulation)
- Filtración Movistar Venezuela (abril 2025): más de 3,25 millones de personas, con cédula, nombre, ciudad y teléfono; sin notificación pública. — [IAPP](https://iapp.org/news/a/venezuela-data-breach-highlights-scattered-privacy-regulation)
- Filtración Cashea (feb. 2026), ver sección 2. Apps financieras en Venezuela piden cédula/pasaporte y selfie. — [Crónica Uno vía Diario de los Andes](https://diariodelosandes.com/asi-funcionan-las-principales-apps-financieras-y-billeteras-virtuales-que-operan-en-venezuela)
- DataGuidance: Venezuela no prevé legalmente una protección integral de datos; CyberPeace sostiene que los derechos constitucionales son en gran medida teóricos. — [CyberPeace](https://cyberpeace.org/resources/blogs/venezuela-data-breaches-expose-fragmented-privacy-regulation)

### Inferences
- Los principios del TSJ (consentimiento, finalidad, minimización, retención limitada) sirven como esqueleto de la página y como argumento de buena fe.
- Luma probablemente no tiene datos de cédula/finanzas personales del nivel de Cashea, pero sí datos de plata de obra (presupuestos, cobros, gastos); eso es sensible para el cliente (margen del ejecutante, ver regla de CLAUDE.md) y merece mencionarse.
- Riesgo cambiario/político: no evaluado con fuentes; por prudencia, informar dónde se alojan los datos (país del servidor) y qué pasa ante pedidos de autoridades.

### Gaps
- No encontré las políticas de Reserve, Zinli, Binance P2P, Yummy, Airtm ni de apps de pago móvil; no puedo describir cómo comunican privacidad. Falta fuente sobre riesgo político/cambiario específico.

## 7. Estructura recomendada de la página pública

### Takeaway
Dos capas: resumen en lenguaje llano arriba, texto completo debajo (patrón Mercado Pago con "Resumen" por país; Procore separa DPA y Trust).

### Cited Findings
- Mercado Pago publica un "Resumen Declaración de Privacidad" separado de la declaración completa. — [Resumen MP México](https://www.mercadopago.com.mx/privacidad/resumen)
- Slack/Linear/37signals siguen el orden datos -> uso -> compartir -> retención -> seguridad -> derechos. — fuentes sección 1.
- Slack publica la lista de subprocesadores en un documento aparte. — [Slack](https://slack.com/trust/privacy/privacy-policy)

### Inferences
Estructura propuesta: (1) Lo esencial en 6 líneas (qué guardamos, no vendemos, no publicidad, quién ve tu obra, cómo borrar, cómo avisamos); (2) Qué datos y para qué; (3) Con quién se comparten (tabla de proveedores: hosting, correo, pagos, analítica, con propósito y país); (4) Cuándo debemos divulgar; (5) Seguridad: lista de controles reales + "ningún sistema es infalible"; (6) Incidentes; (7) Retención y baja; (8) Tus derechos y cómo ejercerlos; (9) Cambios a esta página (fecha, aviso previo); (10) Contacto. Cada afirmación revisada por quien conoce el sistema. Versión en es y pt (Luma ya tiene i18n).

### Gaps
- Sin ejemplos de páginas Trust de apps venezolanas.

## 8. Derechos del usuario sin ley local

### Takeaway
Ofrecer acceso, rectificación, eliminación y exportación con un correo/mecanismo visible y plazo fijo; el estándar de referencia es GDPR (un mes, prorrogable a tres si es complejo).

### Cited Findings
- GDPR art. 12(3): respuesta en un mes, prorrogable dos más por complejidad, avisando antes de que venza el primer mes. — [Irish DPC](https://www.dataprotection.ie/en/faqs/access-and-rectification/how-long-does-organisation-have-respond-my-access-request), [Advisera](https://advisera.com/eugdpracademy/gdpr/transparent-information-communication-and-modalities-for-the-exercise-of-the-rights-of-the-data-subject/)
- Proton: acceso, edición, borrado y exportación desde la propia cuenta. — [Proton](https://proton.me/legal/privacy)
- 37signals: borrado inaccesible de inmediato y purga completa en 60 días; derecho a borrado declarado. — [37signals](https://37signals.com/policies/privacy)
- Venezuela: art. 28 constitucional reconoce acceder, corregir o destruir datos (ver sección 6).

### Inferences
- Mecanismo sugerido: botón en la cuenta (exportar/eliminar) + correo de contacto; acuse en pocos días, respuesta en 30 días. Plazos son buena práctica, no obligación local. Aclarar excepciones: datos que debemos conservar por obligación legal, y que los datos de una obra compartida pertenecen a la obra (el gerente decide), no solo a un usuario. Baja lógica (regla de Luma) debe explicarse como "inaccesible ya, purgado en N días" si se hará purga real; hoy el CLAUDE.md dice que nunca se borra el documento, lo que contradice "eliminación": decidirlo antes de prometer.

### Gaps
- Plazo de acuse y tiempos de purga: decisión de Luma, sin fuente.
