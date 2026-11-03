import { CHAT_LIMITS } from './limits';

/**
 * Antes de renderizar Markdown se mide. Si el texto es demasiado largo o
 * complejo no se intenta parsear: se muestra como texto plano, que es seguro y
 * barato. Es un freno de rendimiento, no un filtro de seguridad: el escape y
 * la lista de elementos permitidos están en `ChatMarkdown`.
 */
export type ContentAssessment =
  | { mode: 'markdown'; text: string; truncated: boolean }
  | { mode: 'plain'; text: string; truncated: boolean };

export function assessContent(raw: unknown, maxChars: number): ContentAssessment {
  const source = typeof raw === 'string' ? raw : '';
  const truncated = source.length > maxChars;
  const text = truncated ? source.slice(0, maxChars) : source;

  const lines = text.split('\n');
  const tableRows = lines.filter((l) => l.trimStart().startsWith('|')).length;
  const images = (text.match(/!\[/g) ?? []).length;

  const tooComplex =
    lines.length > CHAT_LIMITS.maxMarkdownLines ||
    tableRows > CHAT_LIMITS.maxTableRows ||
    images > CHAT_LIMITS.maxImagesPerMessage;

  return { mode: tooComplex ? 'plain' : 'markdown', text, truncated };
}

export function clampTitle(raw: unknown): string {
  const title = typeof raw === 'string' ? raw.trim() : '';
  return title.length > CHAT_LIMITS.maxTitleChars
    ? `${title.slice(0, CHAT_LIMITS.maxTitleChars - 1)}…`
    : title;
}
