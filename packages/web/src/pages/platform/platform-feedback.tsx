import { useTranslation } from 'react-i18next';
import { FEEDBACK_QUESTIONS, FEEDBACK_SCORE_MAX, MIN_PEOPLE_PER_CELL } from '@luma/shared';
import { PageLayout } from '@/components/layout/page-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePlatformFeedback } from '@/hooks/feedback/use-feedback-queries';

/**
 * Qué responde la gente en la encuesta de productividad. Son agregados que la
 * API ya filtró: con menos de `MIN_PEOPLE_PER_CELL` personas no llegan cifras
 * ni comentarios. Los comentarios salen sin autor. Sólo lectura.
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
            <>
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('platform.feedback.commentsTitle')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {report.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('platform.feedback.noComments')}</p>
                  ) : (
                    report.comments.map((item) => (
                      <div key={item.createdAt + item.comment} className="flex flex-col gap-1">
                        <p className="text-sm">{item.comment}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString(i18n.language)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </PageLayout>
  );
}

export default PlatformFeedbackPage;
