# Patrones de aceptación de Términos y Política de Privacidad (SaaS B2B / fintech) — aplicación a Luma (Venezuela / LatAm)

Nota metodológica: la mayoría de las fuentes de jurisprudencia son secundarias (blogs de abogados, resúmenes). Las citas de casos deben verificarse contra la sentencia antes de usarse en un texto legal. Esto no es asesoría legal.

## 1. Clickwrap vs browsewrap vs sign-in-wrap: exigibilidad (jurisprudencia y práctica LatAm)

### Takeaway
En EE.UU. el clickwrap (casilla o botón explícito de "acepto" con enlaces) es el formato más sólido; el browsewrap puro se rechaza; el sign-in-wrap ("al registrarte aceptas") es zona gris que depende del diseño de la pantalla. En Venezuela no hallé jurisprudencia específica sobre T&C en línea, pero el marco de mensajes de datos respalda la validez de la contratación electrónica y su prueba.

### Cited Findings
- Clickwrap suele considerarse exigible; browsewrap genera escepticismo judicial — [Lexplug](https://www.lexplug.com/outlines/cyberlaw-internet-law/clickwrap-vs-browsewrap-enforceability) (material de estudio, secundaria).
- Berman v. Freedom Financial (9th Cir. 2022): sin conocimiento real, hay contrato solo si el sitio da aviso razonablemente conspicuo y el usuario realiza una acción que manifiesta asentimiento sin ambigüedad. El aviso estaba en letra gris diminuta entre el campo y el botón verde, con enlaces solo subrayados del mismo gris, y el botón ("this is correct, continue!") no decía que obligaba a los términos. Se declaró que no hubo contrato — [Eric Goldman](https://blog.ericgoldman.org/?p=23784).
- Lecciones de diseño de Berman: no hacer el aviso el texto más pequeño; enlaces con color distinto; lenguaje condicional "si haces clic, aceptas"; preferir clickwrap con paso de consentimiento distinto; la concurrencia advierte que elegir sign-in-wrap en vez de clickwrap invita a litigio — [Eric Goldman](https://blog.ericgoldman.org/?p=23784).
- Nguyen v. Barnes & Noble (9th Cir. 2014): enlace al pie de página sin prompt no basta; la mera proximidad no es suficiente — [Lexplug / resumen](https://www.lexplug.com/outlines/cyberlaw-internet-law/clickwrap-vs-browsewrap-enforceability) (cita: 763 F.3d 1171, no verificada contra la sentencia).
- Meyer v. Uber (2d Cir. 2017): se hizo valer porque la pantalla de registro era limpia, el texto "Terms of Service" estaba en azul, subrayado y con mayúsculas, justo debajo de los botones, con aviso de que crear la cuenta implica aceptar; se aplicó el estándar del "usuario de smartphone razonablemente prudente" basado en Specht v. Netscape — [WSGR](https://wsgr.com/en/insights/federal-appellate-court-enforces-terms-of-use-including-arbitration-provision-entered-during-mobile-application-registration-process.html), [Casemine](https://www.casemine.com/commentary/us/reaffirming-arbitration-agreement-validity-in-mobile-applications:-meyer-v.-uber-analysis/view).
- Specht v. Netscape (2d Cir. 2002, 306 F.3d 30): los términos deben presentarse con conspicuidad razonable; es el precedente base de Meyer — [Casemine](https://www.casemine.com/commentary/us/reaffirming-arbitration-agreement-validity-in-mobile-applications:-meyer-v.-uber-analysis/view).
- Sign-in-wrap mixto: Cullinane v. Uber (1st Cir. 2018) lo rechazó por enlace poco visible; Plazza v. Airbnb lo validó; Nicosia v. Amazon lo invalidó — [Kilpatrick Townsend vía búsqueda](https://ktslaw.com/blog/classaction/2022/4/internet-contracts-beyond-clickwrap-and-browsewrap) (no verifiqué las citas de Plazza y Nicosia).
- Tasas de éxito reportadas (2020): clickwrap 70%, sign-in-wrap 64%, browsewrap 14%; cifras sin atribución clara — [Sirion](https://www.sirion.ai/library/contract-management/clickwrap-agreement/?libid=50) (fuente de vendor, baja confiabilidad).
- Venezuela: el Decreto-Ley 1.204 sobre Mensajes de Datos y Firmas Electrónicas (G.O. 37.148, 28-feb-2001) da a los mensajes de datos la misma eficacia probatoria que los documentos escritos (art. 4); se promueven como pruebas libres; su valor puede ser plena prueba o indicio según requisitos; la firma electrónica certificada es supervisada por SUSCERTE — [Justia Venezuela](https://venezuela.justia.com/federales/decretos/decreto-n-1-204/gdoc), [Acceso a la Justicia](https://accesoalajusticia.org/el-correo-electronico-como-prueba/) y artículos académicos (p. ej. [Telematique](https://ojs2.urbe.edu/index.php/telematique/article/download/2614/2400/5474)).
- Doctrina académica venezolana indica que la contratación electrónica es válida con o sin ley que la admita expresamente — [Telematique](https://ojs2.urbe.edu/index.php/telematique/article/download/2614/2400/5474).
- Argentina (referencia regional): la Dirección Provincial de Defensa del Consumidor de Buenos Aires investiga a Mercado Libre por cláusulas de modificación unilateral con aceptación tácita por uso, considerando que cambios relevantes requieren aceptación expresa; sin resolución final a mayo-julio 2026 — [Tiempo de San Juan](https://www.tiempodesanjuan.com/politica/cuales-son-las-10-clausulas-aplicadas-mercado-libre-que-el-gobierno-bonaerense-investiga-abusivas-n431535).

### Inferences
- Para Luma (B2B, con montos de obra) el clickwrap con casilla propia en el registro minimiza el riesgo; "al continuar aceptas" es defendible solo con diseño conspicuo y botón que diga que acepta.
- En Venezuela, la evidencia de aceptación sería un mensaje de datos valorado por sana crítica; por eso conviene un registro robusto (versión, hash, timestamp, IP, UA) más que depender del tipo de wrap.
- La tendencia regional del consumidor (Argentina) es hostil a la aceptación tácita por uso continuado; aunque Luma sea B2B, conviene aceptación expresa para cambios materiales.

### Gaps
- No encontré jurisprudencia venezolana (TSJ) específica sobre T&C en línea ni sobre clickwrap.
- No verifiqué el texto de las sentencias; solo resúmenes secundarios.
- No cubrí Ley de Protección al Consumidor venezolana (cláusulas abusivas / contratos de adhesión) ni su aplicabilidad a B2B.

## 2. Cómo lo hacen las apps reales

### Takeaway
Las apps B2B grandes (Slack, Stripe) usan aceptación por uso/registro con cambios notificados por email o in-app y "uso continuado = aceptación"; los casos de litigio muestran que cuando se necesita exigibilidad fuerte (p. ej. Bumble) se usa un blocker card con casilla. No pude verificar directamente Notion, Procore, Buildertrend, Mercado Pago, Airbnb, Linear, Basecamp ni WhatsApp.

### Cited Findings
- Slack: usar el servicio implica aceptar los User Terms y la AUP; cambios materiales con "aviso razonable" previo por email o mensaje dentro del servicio, sin plazo fijo; el uso continuado tras la fecha efectiva es aceptación — [Slack User Terms](https://slack.com/terms-of-service/user).
- Slack, usuarios invitados: quien es invitado a un workspace es "Authorized User" bajo el Cliente; el Cliente es responsable de informar sus políticas y obtener consentimientos; el acceso depende de la suscripción del Cliente — [Slack User Terms](https://slack.com/terms-of-service/user).
- Stripe (Stripe Services Agreement): vigente cuando el usuario accede o usa los servicios; en India menciona "clicking the acceptance button, registering"; quien acepta por una entidad declara tener autoridad para obligarla; Stripe puede modificar publicando o notificando, efectivo al publicar o según aviso; uso continuado = aceptación; en Australia exige aviso de al menos 30 días para cambios materiales o perjudiciales con derecho a terminar; 30 días para aumentos de tarifas — [Stripe SSA](https://stripe.com/legal/ssa).
- Notion: según un tracker de terceros, puede revisar la política a su discreción y el uso continuado cuenta como aceptación; un resumen no oficial de abril 2024 indica vigencia para clientes existentes alrededor de un mes después — [ConductAtlas](https://conductatlas.com/platform/notion/notion-privacy-policy/privacy-policy-modification-and-deemed-acceptance/), [resumen en Notion (no oficial)](https://hikium.notion.site/Notion-Terms-Update-Summary-April-2024-b92415df18694715a3abcde722334b89). La página oficial de ToS no pude leerla (404 en el fetch).
- Mercado Libre/Pago: plazo de 10 días de aviso para modificaciones que afecten derechos u obligaciones (Argentina, fuente secundaria); en México, 3 días; en Colombia, un banco bloquea retiros hasta aceptar nuevos términos en la app — [Mundo Empresarial](https://mundoempresarial.ar/ojo-que-mercado-pago-ahora-podria-descontarte-de-tu-cuenta-deuda-de-terceros-sin-orden-judicial/), [Xataka México](https://www.xataka.com.mx/empresas-y-economia/mercado-pago-quiere-que-inviertas-para-darte-15-rendimiento-mexico-este-su-nuevo-monto-maximo), [Cronista](https://www.cronista.com/colombia/finanzas-y-economia/bloqueo-inminente-este-banco-impedira-retiros-si-no-se-aceptan-sus-nuevos-terminos-en-la-app/). Los plazos varían por país y producto; no leí los términos originales.
- Bumble (caso Alkutkar): email más blocker card con casilla al abrir la app; el tribunal dio peso a los registros de que se mostró la tarjeta y a que el uso posterior requería aceptarla — [Polsinelli](https://www.polsinelli.com/publications/alkutkar-v-bumble-securing-active-consent-for-updated-terms-of-service).

### Inferences
- Patrón dominante B2B: aceptación implícita por uso + aviso por email/in-app. Patrón dominante fintech/consumidor con riesgo: bloqueo con aceptación explícita para cambios materiales.
- Para Luma (maneja plata de obras y suscripciones) el patrón fintech es más apropiado que el de Slack.

### Gaps
- No pude verificar flujos de signup ni textos de Procore, Buildertrend, Airbnb, Linear, Basecamp, WhatsApp ni los T&C oficiales de Notion y Mercado Pago. Requieren revisión manual (capturas del signup).

## 3. Qué se guarda como evidencia / modelo de datos

### Takeaway
El estándar de facto: un registro por aceptación, inmutable, con tipo de documento, versión, timestamp UTC, IP, user agent, método/fuente, y opcionalmente hash del texto mostrado. Se prefiere tabla/colección append-only sobre campos en el usuario.

### Cited Findings
- Campos comunes en herramientas de consent log: timestamp UTC, IP, user agent, versión del documento, URL de origen y texto completo de consentimiento — [Terms & Conditions Consent Log (WordPress)](https://wordpress.org/plugins/terms-conditions-consent-log/).
- Integridad: un plugin sella cada registro con SHA-256 del texto aceptado; otro usa MD5 — mismos resultados de búsqueda arriba (fuentes de plugins, baja autoridad).
- Inmutabilidad: el SDK de YieldFi indica que los registros de consentimiento no se pueden borrar ni revocar una vez creados; cada tipo de consentimiento tiene múltiples versiones y se guarda la versión vigente al aceptar — [YieldFi docs](https://docs.yield.fi/earn-with-yieldfi/integration-sdk/authentication/consent).
- Los tipos de consentimiento (ToS, privacidad, marketing/analytics) se separan, cada uno con versión propia — mismas fuentes de vendors.
- LGPD art. 8 §2: la carga de la prueba es del controlador, que debe poder demostrar qué versión aceptó el titular, por qué canal y cuándo (interpretación de un vendor) — [Confidata](https://confidata.com.br/recursos/gestao-de-consentimento).
- Caso Bumble: los registros de cuándo se mostró la tarjeta y cuándo se aceptó fueron decisivos; se recomienda reforzar con autenticación multifactor la identidad de quien aceptó — [Polsinelli](https://www.polsinelli.com/publications/alkutkar-v-bumble-securing-active-consent-for-updated-terms-of-service).
- Un PR de código abierto (no autoritativo) argumenta guardar identificador de versión y no solo hash — [zff.dev](https://zff.dev/YezhArVro/YAR/pulls/153).
- Para screenshots de la pantalla de registro: los tribunales pueden inclinarse según el diseño; conviene conservar el diseño de cada versión del flujo — [Apify](https://blog.apify.com/enforceability-of-terms-of-use/) (blog de vendor).

### Inferences
- Modelo sugerido para Luma: colección `LegalDocumentVersion` (tipo, versión, idioma, fecha de publicación, hash SHA-256 del contenido, URL estable, `materialChange`) y `ConsentRecord` append-only (userId, docType, version, hash, acceptedAt UTC, ip, userAgent, method [checkbox_signup | modal_reaccept | invitation | oauth], locale, flowVersion). Estado "último aceptado" derivable por consulta (coherente con la regla del proyecto de no guardar lo derivado).
- Guardar IP y user agent es dato personal: mencionarlo en la política de privacidad y definir retención.

### Gaps
- No encontré fuente oficial (OneTrust/Osano) que enumere campos mínimos; la lista viene de vendors/plugins.
- No obtuve el texto del Art. 7(1) GDPR ni guías EDPB sobre cómo demostrar consentimiento.

## 4. Re-aceptación al cambiar los términos

### Takeaway
La práctica jurídica recomendada: cambios materiales con aviso previo y aceptación explícita mediante un bloqueo (blocker card/modal); cambios menores con aviso o publicación. Los plazos de preaviso reales de las empresas van de 3 a 30 días según país.

### Cited Findings
- Los avisos pasivos (email, banner) pueden no dar conocimiento real o constructivo; los tribunales favorecen blocker cards con clic afirmativo — [Polsinelli sobre Alkutkar v. Bumble](https://www.polsinelli.com/publications/alkutkar-v-bumble-securing-active-consent-for-updated-terms-of-service); cita Wilson v. Huuuge (9th Cir. 2019).
- SAP: al cambiar la versión de un consentimiento, se muestra la pantalla de re-consentimiento a usuarios con sesión activa y se recomienda un cut-off de re-consentimiento — [SAP Learning](https://learning.sap.com/courses/getting-started-with-sap-enterprise-consent-and-preference-management/understanding-sap-customer-consent-version-control).
- Auth0: el checkbox integrado solo funciona en registro; para usuarios existentes hay que redirigir/bloquear hasta aceptar la última versión — [Auth0 Community](https://community.auth0.com/t/ask-for-consent-from-already-existing-users/102972).
- Las correcciones menores (typos) pueden no requerir re-prompt; las fuentes difieren en dónde trazar la línea — [búsqueda sobre re-consent, fuentes de vendors](https://learning.sap.com/courses/getting-started-with-sap-enterprise-consent-and-preference-management/understanding-sap-customer-consent-version-control).
- Plazos observados: Stripe 30 días en Australia y para tarifas; Mercado Libre Argentina 10 días; México 3 días (ver sección 2).
- Planet49/EDPB: la aceptación debe ser por acción afirmativa; casillas premarcadas no son consentimiento válido (referencia GDPR; aplica a consentimiento de datos, no necesariamente a ToS contractual) — [Bird & Bird](https://www.twobirds.com/en/news/articles/2019/global/planet49-cjeu-rules-on-cookie-consent).

### Inferences
- Esquema recomendable: `materialChange: true` → email + aviso in-app con X días (propuesta: 15-30) y luego modal bloqueante con aceptación explícita; `false` → solo publicar con changelog.
- Bloqueo con acceso de solo lectura/exportación de datos mientras no acepte sería menos hostil que bloquear todo (opinión mía, sin fuente).

### Gaps
- Sin fuente oficial sobre plazos mínimos legales de preaviso en Venezuela.
- Sin umbral formal de "cambio material" más allá de criterio de práctica.

## 5. Usuarios existentes (migración retroactiva)

### Takeaway
Se resuelve igual que una re-aceptación: una versión "base" de los documentos y un gate que bloquea hasta que quien no tiene registro de aceptación de la versión vigente la acepte.

### Cited Findings
- Auth0: redirigir a quienes no aceptaron la última versión y bloquear hasta aceptar — [Auth0 Community](https://community.auth0.com/t/ask-for-consent-from-already-existing-users/102972).
- Un paquete Laravel registra la versión aceptada y conserva el historial — [laraconsent en Packagist](https://root.packagist.org/packages/ekoukltd/laraconsent).
- Recomendación de combinar email, blocker card y registro de cuándo se mostró y aceptó — [Polsinelli](https://www.polsinelli.com/publications/alkutkar-v-bumble-securing-active-consent-for-updated-terms-of-service).

### Inferences
- Para Luma: no hacer backfill con aceptaciones inventadas; usuarios sin `ConsentRecord` quedan "pendientes" y pasan por el modal en el próximo login (nueva fecha/IP reales). Distinguir método `retroactive_modal`.

### Gaps
- No encontré ejemplos documentados de empresas reales explicando su migración inicial.

## 6. Accesibilidad y buenas prácticas UX

### Takeaway
Casilla no premarcada, enlaces distinguibles (color y subrayado), texto de acción explícito, y la aceptación en un elemento propio del formulario; scroll-to-accept solo para contratos largos de alto riesgo.

### Cited Findings
- Berman: enlaces solo subrayados del mismo color y texto diminuto fueron decisivos para no hacer valer los términos — [Eric Goldman](https://blog.ericgoldman.org/?p=23784).
- Meyer: enlaces azules, subrayados, pantalla despejada, cerca del botón de registro — [WSGR](https://wsgr.com/en/insights/federal-appellate-court-enforces-terms-of-use-including-arbitration-provision-entered-during-mobile-application-registration-process.html).
- Planet49/EDPB: no usar casillas premarcadas (consentimiento de datos) — [Bird & Bird](https://www.twobirds.com/en/news/articles/2019/global/planet49-cjeu-rules-on-cookie-consent).
- LGPD (práctica brasileña): el consentimiento debe destacarse del resto de cláusulas y referirse a finalidades determinadas; las autorizaciones genéricas son nulas — [Confidata](https://confidata.com.br/recursos/gestao-de-consentimento), [Jornal Contábil](https://jornalcontabil.com.br/noticia/como-elaborar-o-termo-de-consentimento-exigido-pela-lgpd/).
- Scroll-wrap: la concurrencia de Berman cita scrollwrap y clickwrap como presumiblemente exigibles — [Eric Goldman](https://blog.ericgoldman.org/?p=23784).

### Inferences
- Nueva pestaña (`target=_blank rel=noopener`) para los enlaces legales y que el formulario no pierda estado; el texto en castellano claro; resumen corto opcional. Requisito de etiqueta accesible (`<label>` asociada, error en `aria-live`). Estas son prácticas mías, sin cita directa salvo lo anterior.
- Scroll-to-accept no es necesario para B2B SaaS estándar; aplicaría a contratos extensos o con cláusulas excepcionales.
- Separar T&C/privacidad (contractual) de consentimientos opcionales (marketing), que no deben ir atados al acceso.

### Gaps
- No busqué guías WCAG específicas para casillas legales ni evidencia empírica de conversión.

## 7. Aceptación por invitación y por OAuth/login social

### Takeaway
El invitado que crea cuenta debe aceptar él mismo (clickwrap en la pantalla de alta); en OAuth se necesita un paso propio o una frase conspicua, porque el consentimiento de Google no es el del operador.

### Cited Findings
- Slack trata a los invitados como Authorized Users bajo los términos del Cliente, con el Cliente responsable de informar y obtener consentimientos — [Slack User Terms](https://slack.com/terms-of-service/user).
- Stripe: quien acepta en nombre de una entidad declara tener autoridad para obligarla — [Stripe SSA](https://stripe.com/legal/ssa).
- El sign-in-wrap agrupa el consentimiento en el acto de login con una nota de aceptación; los clickwrap tienen prueba más clara — [Sirion](https://www.sirion.ai/library/contract-management/clickwrap-agreement/?libid=50), [Ironclad](https://ironcladapp.com/?p=5900).
- La búsqueda no devolvió jurisprudencia sobre OAuth específicamente.

### Inferences
- Invitación: la persona acepta los T&C de la plataforma al crear la cuenta; al registrar se guarda `method: invitation` y el `projectId`/`invitationId` de contexto. Los T&C de Luma deberían decir que el dueño de la Empresa responde por informar a sus colaboradores.
- OAuth: tras el primer login social, si no hay `ConsentRecord` de la versión vigente, redirigir a una pantalla de aceptación con casilla antes de crear/activar la cuenta. Es el mismo gate que usuarios existentes.

### Gaps
- Sin documentación de las políticas de Google/Apple sobre mostrar T&C del operador.
- Sin jurisprudencia sobre aceptación vía OAuth.

## 8. Páginas legales públicas: ubicación, URL estables, idiomas

### Takeaway
No hallé fuente sólida; lo que sigue son inferencias de práctica, no hallazgos citados.

### Cited Findings
- Stripe publica sus acuerdos en una "Legal Page" a la que remite para revisar modificaciones — [Stripe SSA](https://stripe.com/legal/ssa).
- Slack mantiene los User Terms en una URL pública (`/terms-of-service/user`) — [Slack User Terms](https://slack.com/terms-of-service/user).
- Notion redirige su URL de ToS entre dominios (307), lo que muestra que las URL pueden cambiar de host; conviene mantener redirects — observado en el fetch de [Notion ToS](https://www.notion.com/notion/terms-of-service) (sin confirmar contenido).

### Inferences
- Para Luma: páginas públicas en la landing (estática, nginx) con rutas estables por idioma (p. ej. `/terminos`, `/privacidad`, y variantes `/pt/...`), cada versión archivada e inmutable (`/legal/terminos/v2026-10`), y la "vigente" apuntando a la última. Registrar en `ConsentRecord` el hash y la versión por idioma mostrado; definir qué idioma prevalece ante discrepancias (típicamente es-AR / el idioma contractual).
- Dado que es-ES y pt son traducciones, el texto legal debería ser revisado por abogado en cada idioma; el test de paridad i18n del repo no cubre documentos legales largos si viven fuera de `translation.json`.

### Gaps
- No encontré fuente sobre convenciones de URL ni versionado por idioma en las apps nombradas.
- No verifiqué Argentina Ley 25.326 art. 5 ni normas venezolanas de protección de datos: Venezuela no tendría ley general de datos personales, solo art. 28 de la Constitución (habeas data) desarrollado por jurisprudencia de la Sala Constitucional según [Global Compliance News](https://www.globalcompliancenews.com/data-privacy/data-protection-enforcement-in-venezuela/) (fuente posiblemente desactualizada) y [Acceso a la Justicia](https://accesoalajusticia.org/competencia-para-conocer-de-las-demandas-de-habeas-data-correspondera-a-los-juzgados-de-municipio/).
