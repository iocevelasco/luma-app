import { describe, expect, it } from 'vitest';
import {
  canSubmitFeedback,
  isFeedbackDue,
  summarizeFeedback,
  type FeedbackRow,
} from './index';

const day = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000);

describe('isFeedbackDue', () => {
  it('no pregunta antes de los 14 días', () => {
    expect(isFeedbackDue({ createdAt: day(0), now: day(13) })).toBe(false);
  });
  it('pregunta desde los 14 días', () => {
    expect(isFeedbackDue({ createdAt: day(0), now: day(14) })).toBe(true);
  });
  it('tras responder espera 90 días', () => {
    expect(isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(20), now: day(109) })).toBe(false);
    expect(isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(20), now: day(110) })).toBe(true);
  });
  it('tras cerrarla sin responder vuelve a los 7 días', () => {
    expect(isFeedbackDue({ createdAt: day(0), lastDismissedAt: day(20), now: day(26) })).toBe(false);
    expect(isFeedbackDue({ createdAt: day(0), lastDismissedAt: day(20), now: day(27) })).toBe(true);
  });
  it('cerrarla después de una respuesta no acorta los 90 días', () => {
    expect(
      isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(100), lastDismissedAt: day(20), now: day(150) }),
    ).toBe(false);
    expect(
      isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(20), lastDismissedAt: day(110), now: day(116) }),
    ).toBe(false);
    expect(
      isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(20), lastDismissedAt: day(110), now: day(117) }),
    ).toBe(true);
  });
});

describe('canSubmitFeedback', () => {
  it('bloquea reenvíos dentro de la semana', () => {
    expect(canSubmitFeedback(null, day(1))).toBe(true);
    expect(canSubmitFeedback(day(0), day(6))).toBe(false);
    expect(canSubmitFeedback(day(0), day(7))).toBe(true);
  });
});

describe('summarizeFeedback', () => {
  const row = (user: string, score: number, comment?: string): FeedbackRow => ({
    user,
    timeSaved: score,
    clarity: score,
    control: score,
    change: comment?.trim() ? `x${comment}` : undefined,
    comment,
    createdAt: day(1),
  });

  it('sin medias debajo del umbral, pero las respuestas salen igual', () => {
    const report = summarizeFeedback([row('a', 5, 'hola'), row('b', 4)]);
    expect(report).toMatchObject({ suppressed: true, averages: null, respondents: 2 });
    expect(report.answers).toHaveLength(2);
    expect(report.answers.map((a) => a.timeSaved).sort()).toEqual([4, 5]);
  });

  it('promedia desde el umbral y lista las respuestas sin autor', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((u, i) => row(u, i + 1, i === 0 ? ' ' : `c${i}`));
    const report = summarizeFeedback(rows);
    expect(report.suppressed).toBe(false);
    expect(report.averages).toEqual({ timeSaved: 3, clarity: 3, control: 3 });
    expect(report.answers).toHaveLength(5);
    expect(report.answers.map((a) => a.comment)).toContain('c4');
    expect(report.answers.find((a) => a.timeSaved === 1)?.comment).toBeUndefined();
    expect(JSON.stringify(report)).not.toContain('"user"');
  });
});
