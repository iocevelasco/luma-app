import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FEEDBACK_CHANGE_MAX_LENGTH,
  FEEDBACK_COMMENT_MAX_LENGTH,
  FEEDBACK_QUESTIONS,
  FEEDBACK_SCORE_MAX,
  FEEDBACK_SCORE_MIN,
  type FeedbackQuestion,
} from '@luma/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitFeedback } from '@/hooks/feedback/use-feedback-queries';
import { errorMessage } from '@/lib/error-message';

const SCORES = Array.from(
  { length: FEEDBACK_SCORE_MAX - FEEDBACK_SCORE_MIN + 1 },
  (_, i) => FEEDBACK_SCORE_MIN + i,
);

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al cerrar sin responder (la X, tocar afuera, "Ahora no"). */
  onDismiss?: () => void;
}

/**
 * Tres preguntas de productividad, escala 1 a 5, y un comentario opcional. Lo
 * usan el modal automático (`FeedbackGate`) y el ítem del menú de cuenta.
 */
export function FeedbackDialog({ open, onOpenChange, onDismiss }: FeedbackDialogProps) {
  const { t } = useTranslation();
  const submit = useSubmitFeedback();
  const [scores, setScores] = useState<Partial<Record<FeedbackQuestion, number>>>({});
  const [change, setChange] = useState('');
  const [comment, setComment] = useState('');

  const complete = FEEDBACK_QUESTIONS.every((q) => scores[q] !== undefined);

  function close(answered: boolean) {
    onOpenChange(false);
    if (!answered) onDismiss?.();
  }

  function send() {
    if (!complete) return;
    submit.mutate(
      {
        timeSaved: scores.timeSaved!,
        clarity: scores.clarity!,
        control: scores.control!,
        change: change.trim() || undefined,
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          setScores({});
          setChange('');
          setComment('');
          close(true);
        },
      },
    );
  }

  const error = errorMessage(submit.error, t);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !next && !submit.isPending && close(false)}
      title={t('feedback.title')}
      description={t('feedback.description')}
    >
      <div className="flex flex-col gap-5">
        {FEEDBACK_QUESTIONS.map((question) => {
          const labelId = `feedback-${question}`;
          return (
            <div key={question} className="flex flex-col gap-2">
              <Label id={labelId} className="text-sm leading-snug">
                {t(`feedback.questions.${question}`)}
              </Label>
              <div role="radiogroup" aria-labelledby={labelId} className="flex gap-2">
                {SCORES.map((score) => {
                  const selected = scores[question] === score;
                  return (
                    <Button
                      key={score}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      variant={selected ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setScores((prev) => ({ ...prev, [question]: score }))}
                    >
                      {score}
                    </Button>
                  );
                })}
              </div>
              <div className="flex justify-between text-2xs text-muted-foreground">
                <span>{t('feedback.scaleLow')}</span>
                <span>{t('feedback.scaleHigh')}</span>
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-change" className="text-sm">
            {t('feedback.changeLabel')}
          </Label>
          <Input
            id="feedback-change"
            maxLength={FEEDBACK_CHANGE_MAX_LENGTH}
            value={change}
            onChange={(event) => setChange(event.target.value)}
            placeholder={t('feedback.changePlaceholder')}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-comment" className="text-sm">
            {t('feedback.commentLabel')}
          </Label>
          <Textarea
            id="feedback-comment"
            rows={3}
            maxLength={FEEDBACK_COMMENT_MAX_LENGTH}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t('feedback.commentPlaceholder')}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={submit.isPending}>
            {t('feedback.later')}
          </Button>
          <Button type="button" onClick={send} disabled={!complete || submit.isPending}>
            {submit.isPending ? t('common.loading') : t('feedback.send')}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
