import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginSchema } from '@luma/shared';
import { authApi } from '@/api';
import { ROUTES } from '@/lib/routes';
import { useSessionStore } from '@/stores/session-store';
import { Button, Card, CardContent, Field, Input, Spinner } from '@/components/ui';
import { AuthLayout } from './auth-layout';

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Se valida con el MISMO schema que usa el backend: si el email está mal
    // escrito, no hace falta un round-trip para decirlo.
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const session = await authApi.login(parsed.data);
      setSession(session.user, session.accessToken);
      navigate(session.user.project_role === 'client' ? ROUTES.CLIENT_HOME : ROUTES.HOME);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Entrar" subtitle="Gestión y ejecución de obras">
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vos@ejemplo.com"
              />
            </Field>
            <Field label="Contraseña">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? <Spinner /> : 'Entrar'}
            </Button>
          </form>

          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 text-sm">
            <Link to={ROUTES.FORGOT_PASSWORD} className="text-primary hover:underline">
              Olvidé mi contraseña
            </Link>
            <p className="text-muted-foreground">
              ¿No tenés cuenta?{' '}
              <Link to={ROUTES.REGISTER} className="text-primary hover:underline">
                Creá una
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
