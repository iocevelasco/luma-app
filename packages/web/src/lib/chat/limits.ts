/**
 * Límites del chat. Un solo lugar: el composer, el store, el renderer y los
 * tests leen de acá. Son un freno de UX y de rendimiento del navegador; **no
 * reemplazan** los límites del servidor (ver `docs/CHAT-SEGURIDAD.md`).
 */
export const CHAT_LIMITS = {
  /** Lo que escribe la persona. */
  maxUserChars: 4000,
  /** Lo que acepta el render de una respuesta del asistente (streaming incluido). */
  maxAssistantChars: 20_000,
  maxHistoryMessages: 200,
  maxTitleChars: 80,

  /** Complejidad del Markdown: más que esto se muestra como texto plano. */
  maxMarkdownLines: 400,
  maxTableRows: 60,
  maxImagesPerMessage: 4,

  maxAttachments: 4,
  maxFileBytes: 5 * 1024 * 1024,
  maxImageSide: 4096,
  maxImagePixels: 16_000_000,
  maxFileNameChars: 120,
} as const;

/** Raster y nada más. Sin SVG ni HTML, que pueden llevar script. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/**
 * Orígenes HTTPS desde los que el chat puede cargar imágenes remotas.
 *
 * **Vacía a propósito.** La CSP de producción (`imgSrc` en `api/src/index.ts`)
 * sólo deja pasar `'self'`, `data:`, `blob:`, Google y Stripe, y no se debilita
 * para el chat. Agregar un origen acá exige agregarlo también a la CSP en el
 * mismo PR; si no, el navegador igual lo bloquearía.
 */
export const ALLOWED_REMOTE_IMAGE_ORIGINS: readonly string[] = [];
