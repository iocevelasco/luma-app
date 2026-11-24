import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CTA_PRIMARY } from '../lib/cta';
import { landingHref } from '../lib/paths';
import { LegalFrame } from './LegalDocument';

const REASONS = ['noLongerUse', 'privacy', 'security', 'other'] as const;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  reason: string;
  additionalInfo: string;
  confirmed: boolean;
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  nationalId: '',
  reason: '',
  additionalInfo: '',
  confirmed: false,
};

const fieldClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function CancellationPage() {
  const { t } = useTranslation();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const title = t('legal.cancellation.title');

  const set = (key: keyof FormState, value: string | boolean) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!values.firstName.trim() || !values.lastName.trim() || !values.phone.trim() || !values.nationalId.trim() || !values.reason || !values.confirmed) {
      setError(t('legal.cancellation.required'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      setError(t('legal.cancellation.emailInvalid'));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/legal/service-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          nationalId: values.nationalId.trim(),
          reason: values.reason,
          additionalInfo: values.additionalInfo.trim(),
          confirmed: true,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error || t('legal.cancellation.network'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('legal.cancellation.network'));
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <LegalFrame current="baja-servicio" title={title}>
        <header className="flex flex-col gap-3">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{t('legal.cancellation.successTitle')}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t('legal.cancellation.successBody')}</p>
        </header>
        <a href={landingHref('home')} className={`${CTA_PRIMARY} h-11 w-fit px-5 text-sm`}>
          {t('legal.cancellation.backHome')}
        </a>
      </LegalFrame>
    );
  }

  return (
    <LegalFrame current="baja-servicio" title={title}>
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{t('legal.cancellation.intro')}</p>
      </header>

      <form className="flex flex-col gap-8" onSubmit={(event) => void submit(event)} noValidate>
        <fieldset className="flex flex-col gap-4">
          <legend className="text-xl">{t('legal.cancellation.personal')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('legal.cancellation.firstName')} value={values.firstName} onChange={(value) => set('firstName', value)} />
            <Field label={t('legal.cancellation.lastName')} value={values.lastName} onChange={(value) => set('lastName', value)} />
            <Field label={t('legal.cancellation.email')} type="email" value={values.email} onChange={(value) => set('email', value)} />
            <Field label={t('legal.cancellation.phone')} value={values.phone} onChange={(value) => set('phone', value)} />
          </div>
          <Field label={t('legal.cancellation.nationalId')} value={values.nationalId} onChange={(value) => set('nationalId', value)} />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-xl">{t('legal.cancellation.details')}</legend>
          <label className="flex flex-col gap-2 text-sm">
            {t('legal.cancellation.reason')}
            <select
              className={fieldClass}
              value={values.reason}
              onChange={(event) => set('reason', event.target.value)}
              required
            >
              <option value="">{t('legal.cancellation.reasonPlaceholder')}</option>
              {REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t(`legal.cancellation.reasons.${reason}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            {t('legal.cancellation.additionalInfo')}
            <textarea
              className={`${fieldClass} min-h-28`}
              value={values.additionalInfo}
              onChange={(event) => set('additionalInfo', event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="text-xl">{t('legal.cancellation.confirmTitle')}</legend>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
            <input
              type="checkbox"
              className="mt-1"
              checked={values.confirmed}
              onChange={(event) => set('confirmed', event.target.checked)}
            />
            <span>{t('legal.cancellation.confirm')}</span>
          </label>
        </fieldset>

        {error ? (
          <p role="alert" className="text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <button type="submit" className={`${CTA_PRIMARY} h-11 w-fit px-5 text-sm`} disabled={pending}>
          {pending ? t('legal.cancellation.submitting') : t('legal.cancellation.submit')}
        </button>
      </form>
    </LegalFrame>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      {label}
      <input className={fieldClass} type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}
