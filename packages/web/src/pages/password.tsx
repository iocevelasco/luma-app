import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { passwordSchema } from '@luma/shared';
import { authApi } from '@/api';
import { ROUTES } from '@/lib/routes';
import { useSessionStore } from '@/stores/session-store';
import { Button, Card, CardContent, Field, Input, Spinner } from '@/components/ui';
import { AuthLayout } from './auth-layout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <AuthLayout title="Recuperar contraseña">
      <Card>
        <CardContent className="pt-5">
          {sent ? (
            // Mensaje idéntico exista o no la cuenta: el backend responde igual
            // en los dos casos y la UI no puede delatar la diferencia.
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Si hay una cuenta con ese email, te mandamos un link para elegir una contraseña
                nueva. Revisá también el correo no deseado.
              </p>
              <Link to={ROUTES.LOGIN} className="text-sm text-primary hover:underline">
                Volver a entrar
              </Link>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setLoading(true);
                try {
                  await authApi.forgotPassword(email);
                } finally {
                  setLoading(false);
                  setSent(true);
                }
              }}
            >
              <Field label="Email">
                <Input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={loading}>
                {loading ? <Spinner /> : 'Enviar link'}
              </Button>
              <Link to={ROUTES.LOGIN} className="text-sm text-muted-foreground hover:underline">
                Volver
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

/**
 * Una sola pantalla para dos caminos: restablecer la contraseña y activar una
 * cuenta creada por invitación. El formulario es idéntico; sólo cambia el
 * endpoint y el texto.
 */
export function SetPasswordPage({ mode }: { mode: 'reset' | 'activate' }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <AuthLayout title="Link inválido">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">
              El link no trae un token válido. Pedí uno nuevo desde la pantalla de recuperación.
            </p>
            <Link
              to={ROUTES.FORGOT_PASSWORD}
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Pedir link nuevo
            </Link>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={mode === 'activate' ? 'Activá tu cuenta' : 'Nueva contraseña'}>
      <Card>
        <CardContent className="pt-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);

              const parsed = passwordSchema.safeParse(password);
              if (!parsed.success) {
                setError(parsed.error.errors[0].message);
                return;
              }

              setLoading(true);
              try {
                if (mode === 'activate') {
                  const session = await authApi.activate(token, password);
                  setSession(session.user, session.accessToken);
                  navigate(
                    session.user.project_role === 'client' ? ROUTES.CLIENT_HOME : ROUTES.HOME,
                  );
                } else {
                  await authApi.resetPassword(token, password);
                  navigate(ROUTES.LOGIN);
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No pudimos guardar la contraseña');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field
              label="Contraseña"
              hint="Mínimo 8 caracteres, con al menos una letra y un número"
              error={error ?? undefined}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner /> : mode === 'activate' ? 'Entrar' : 'Guardar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
