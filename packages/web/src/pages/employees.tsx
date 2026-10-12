import { TeamDirectory } from '@/components/organization/team-directory';

/**
 * Los empleados de la Empresa: personal de obra y administrativo, en una sola
 * vista. Los datos de la Empresa (nombre, contacto) viven en la configuración
 * de la cuenta: se tocan una vez, y ocupaban la mitad de una pantalla que se
 * usa para mover gente.
 *
 * Tiene pantalla propia y no vive al final de la home. Ahí estaba debajo del
 * listado de obras, que crece: con cinco obras ya había que scrollear para
 * encontrar al equipo, y con veinte directamente no existía.
 */
export function EmployeesPage() {
  return (
    <div className="flex flex-col gap-6 p-3 md:p-4">
      <TeamDirectory />
    </div>
  );
}

export default EmployeesPage;
