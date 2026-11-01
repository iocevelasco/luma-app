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
  it('tras responder o descartar espera 90 días', () => {
    expect(isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(20), now: day(109) })).toBe(false);
    expect(isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(20), now: day(110) })).toBe(true);
    expect(isFeedbackDue({ createdAt: day(0), lastDismissedAt: day(20), now: day(50) })).toBe(false);
  });
  it('cuenta desde lo más reciente de las dos marcas', () => {
    expect(
      isFeedbackDue({ createdAt: day(0), lastRespondedAt: day(15), lastDismissedAt: day(100), now: day(150) }),
    ).toBe(false);
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
    comment,
    createdAt: day(1),
  });

  it('sin cifras ni comentarios debajo del umbral de personas', () => {
    const report = summarizeFeedback([row('a', 5, 'hola'), row('b', 4)]);
    expect(report).toMatchObject({ suppressed: true, averages: null, comments: [], respondents: 2 });
  });

  it('promedia y lista comentarios desde el umbral', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((u, i) => row(u, i + 1, i === 0 ? ' ' : `c${i}`));
    const report = summarizeFeedback(rows);
    expect(report.suppressed).toBe(false);
    expect(report.averages).toEqual({ timeSaved: 3, clarity: 3, control: 3 });
    expect(report.comments).toHaveLength(4);
    expect(JSON.stringify(report)).not.toContain('"user"');
  });
});
