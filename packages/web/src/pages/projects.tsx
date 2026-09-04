import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROJECT_ROLE_LABELS, createProjectSchema } from '@luma/shared';
import { projectsApi } from '@/api';
import { useProjects } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { ROUTES } from '@/lib/routes';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Spinner,
  Textarea,
} from '@/components/ui';

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { switchProject } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Tus proyectos</h1>
        <Button size="sm" onClick={() => navigate(ROUTES.NEW_PROJECT)}>
          Nuevo proyecto
        </Button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          title="Todavía no tenés proyectos"
          description="Creá el primero e importá el presupuesto con el que cotizaste."
          action={<Button onClick={() => navigate(ROUTES.NEW_PROJECT)}>Crear proyecto</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() =>
                  void switchProject(project).then(() =>
                    navigate(project.role === 'client' ? ROUTES.CLIENT_HOME : ROUTES.HOME),
                  )
                }
              >
                <Card className="transition-colors hover:bg-muted">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <span className="font-medium">{project.name}</span>
                    <Badge tone="outline">{PROJECT_ROLE_LABELS[project.role]}</Badge>
                  </CardContent>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewProjectPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    currency: 'ARS',
    margin_pct: 10,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 py-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Nuevo proyecto</h1>
        <p className="text-sm text-muted-foreground">
          Después vas a poder importar el presupuesto e invitar al cliente y al asistente de obra.
        </p>
      </header>

      <Card>
        <CardContent className="pt-5">
          <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);

              const parsed = createProjectSchema.safeParse({
                ...form,
                description: form.description || undefined,
                address: form.address || undefined,
              });
              if (!parsed.success) {
                setError(parsed.error.errors[0].message);
                return;
              }

              setLoading(true);
              try {
                await projectsApi.create(parsed.data);
                // La sesión tiene que re-emitirse: el token todavía no tiene
                // este proyecto en su scope.
                await refresh();
                navigate(ROUTES.PROJECTS);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No pudimos crear el proyecto');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Field label="Nombre de la obra">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Remodelación Depto Belgrano"
              />
            </Field>
            <Field label="Descripción">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Baño principal, cocina y placard a medida."
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field
              label="Margen de rentabilidad (%)"
              hint="Se descuenta del saldo para calcular tu margen de maniobra real."
            >
              <Input
                type="number"
                min={0}
                max={90}
                value={form.margin_pct}
                onChange={(e) => setForm({ ...form, margin_pct: Number(e.target.value) })}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? <Spinner /> : 'Crear proyecto'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
