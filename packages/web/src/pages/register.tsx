import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@luma/shared';
import { authApi } from '@/api';
import { ROUTES } from '@/lib/routes';
import { useSessionStore } from '@/stores/session-store';
import { Button, Card, CardContent, Field, Input, Spinner } from '@/components/ui';
import { AuthLayout } from './auth-layout';

export function RegisterPage() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const session = await authApi.register(parsed.data);
      setSession(session.user, session.accessToken);
      navigate(ROUTES.NEW_PROJECT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Crear cuenta" subtitle="Gestión y ejecución de obras">
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Nombre">
              <Input
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Contraseña" hint="Mínimo 8 caracteres, con al menos una letra y un número">
              <Input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? <Spinner /> : 'Crear cuenta'}
            </Button>
          </form>

          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link to={ROUTES.LOGIN} className="text-primary hover:underline">
              Entrá
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
