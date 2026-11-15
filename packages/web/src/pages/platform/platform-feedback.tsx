import { useTranslation } from 'react-i18next';
import {
  FEEDBACK_QUESTIONS,
  FEEDBACK_SCORE_MAX,
  MIN_PEOPLE_PER_CELL,
  type FeedbackAnswer,
} from '@luma/shared';
import { PageLayout } from '@/components/layout/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePlatformFeedback } from '@/hooks/feedback/use-feedback-queries';

/**
 * Qué responde la gente en la encuesta de productividad. Las medias las filtra
 * la API: debajo de `MIN_PEOPLE_PER_CELL` personas salen sin cifras. Las
 * respuestas se muestran tal cual llegaron, sin autor. Sólo lectura.
 */

export function PlatformFeedbackPage() {
  const { t, i18n } = useTranslation();
  const feedback = usePlatformFeedback();
  const report = feedback.data;

  return (
    <PageLayout width="default" isLoading={feedback.isLoading} isError={feedback.isError}>
      {report && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t('platform.feedback.summary', {
              responses: report.responses,
              respondents: report.respondents,
            })}
          </p>

          {report.suppressed || !report.averages ? (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                {t('platform.feedback.suppressed', { min: MIN_PEOPLE_PER_CELL })}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {FEEDBACK_QUESTIONS.map((question) => {
                const average = report.averages![question];
                return (
                  <Card key={question}>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {t(`platform.feedback.questions.${question}`)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                      <p className="font-mono text-3xl">
                        {average.toLocaleString(i18n.language, { minimumFractionDigits: 1 })}
                        <span className="text-sm text-muted-foreground"> / {FEEDBACK_SCORE_MAX}</span>
                      </p>
                      <Progress value={(average / FEEDBACK_SCORE_MAX) * 100} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('platform.feedback.answersTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {report.answers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('platform.feedback.noAnswers')}</p>
              ) : (
                report.answers.map((answer) => (
                  <AnswerItem key={answer.createdAt + answer.timeSaved + answer.clarity + answer.control} answer={answer} />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}

function AnswerItem({ answer }: { answer: FeedbackAnswer }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <p className="text-xs text-muted-foreground">
        {new Date(answer.createdAt).toLocaleDateString(i18n.language)}
      </p>
      <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        {FEEDBACK_QUESTIONS.map((question) => (
          <div key={question} className="contents">
            <dt className="text-muted-foreground">{t(`platform.feedback.questions.${question}`)}</dt>
            <dd className="font-mono">
              {answer[question]} / {FEEDBACK_SCORE_MAX}
            </dd>
          </div>
        ))}
      </dl>
      {answer.change && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t('platform.feedback.changeLabel')}: </span>
          {answer.change}
        </p>
      )}
      {answer.comment && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t('platform.feedback.commentLabel')}: </span>
          {answer.comment}
        </p>
      )}
    </div>
  );
}

export default PlatformFeedbackPage;
