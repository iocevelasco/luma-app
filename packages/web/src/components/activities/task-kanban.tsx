import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Kanban, Willow, type ColumnConfig, type KanbanCard, type KanbanInstanceApi } from '@svar-ui/react-kanban';
import '@svar-ui/react-kanban/style.css';
import '@/lib/svar-icons';
import type { Activity } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { ActivityStatusIcon } from '@/components/common/activity-status-icon';
import { TASK_COLUMNS, type TaskColumn, type TaskLayout } from '@/lib/task-board';

interface TaskKanbanProps {
  layout: TaskLayout;
  /** Si esta tarea puede ir a esa columna: las reglas por rol, ya resueltas (`allowedMoves`). */
  canMoveTo: (task: Activity, column: TaskColumn) => boolean;
  onMove: (task: Activity, column: TaskColumn) => void;
  /** Un clic en la tarjeta abre el detalle de la actividad. */
  onSelect: (activityId: string) => void;
  /** El contenido de cada tarjeta: lo arma el Tablero, que sabe de menús y diálogos. */
  renderCard: (task: Activity) => ReactNode;
}

const RenderCardContext = createContext<(task: Activity) => ReactNode>(() => null);

/**
 * La librería pide un componente estable para el cuerpo de la tarjeta, no una
 * función que cambie con cada render: el contenido real se lee de un contexto.
 */
function KanbanCardContent({ card }: { card: KanbanCard }) {
  const renderCard = useContext(RenderCardContext);
  return <>{renderCard(card.task as Activity)}</>;
}

/** Lo que la librería ofrece y Luma no: la tarjeta no se crea, edita ni borra desde acá. */
const BLOCKED_ACTIONS = ['add-card', 'update-card', 'delete-card', 'duplicate-card'] as const;

/**
 * Las columnas del Tablero sobre `@svar-ui/react-kanban` (edición gratuita).
 *
 * La librería hace el arrastre —con eventos de puntero, que es lo que anda
 * con el dedo— y el Tablero conserva las reglas: quién mueve qué sale de
 * `allowedMoves` y la API las vuelve a aplicar. Cada soltar se **intercepta**:
 * si el rol no puede o es una columna igual, se corta; si corresponde, se manda
 * como una mutación optimista y se deja pasar para que la tarjeta ya esté en la
 * columna nueva al soltarla.
 *
 * No se reordena dentro de una columna: una actividad no tiene posición, el
 * orden es siempre atrasadas primero y después por fecha de fin.
 */
export function TaskKanban({ layout, canMoveTo, onMove, onSelect, renderCard }: TaskKanbanProps) {
  const { t } = useTranslation();

  // Los manejadores se enganchan una sola vez, al iniciar la librería: leen
  // lo último por ref para no quedar con las reglas de ese momento.
  const tasksRef = useRef(layout);
  const canMoveToRef = useRef(canMoveTo);
  const onMoveRef = useRef(onMove);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    tasksRef.current = layout;
    canMoveToRef.current = canMoveTo;
    onMoveRef.current = onMove;
    onSelectRef.current = onSelect;
  });

  const columns = useMemo<ColumnConfig[]>(
    () =>
      TASK_COLUMNS.map((column) => ({
        id: column,
        // `@svar-ui/react-kanban` 2.6.0 no tiene un slot para el encabezado de la columna
        // (sólo `cardContent`, `cardCss` y `columnCss`), y el ícono del estado va ahí.
        // Se aprovecha que el título es `<h3 class="wx-title">{column.label}</h3>`: lo que
        // se pasa como `label` se dibuja tal cual, así que un nodo de React funciona
        // aunque el tipo diga `string`. Se asume entonces que (1) la librería no le hace
        // nada al `label` y (2) sólo se usa para ese título: con `addCard` apagado no
        // entra en ningún `aria-label`. Por eso la versión está fija en `package.json`:
        // al subirla, revisar que el encabezado siga mostrando ícono y nombre (hay un
        // E2E) y, si ya hay un slot, usarlo y sacar el cast.
        label: (
          <span className="inline-flex items-center gap-2">
            <ActivityStatusIcon status={column} />
            {t(`activity.status.${column}`)}
          </span>
        ) as unknown as string,
        addCard: false,
      })),
    [t],
  );

  const cards = useMemo<KanbanCard[]>(
    () =>
      TASK_COLUMNS.flatMap((column) =>
        layout.columns[column].map((task) => ({
          id: task.id,
          label: task.name,
          column,
          task,
        })),
      ),
    [layout],
  );

  const handleInit = useCallback((api: KanbanInstanceApi) => {
    for (const action of BLOCKED_ACTIONS) api.intercept(action, () => false);

    api.intercept('move-card', ({ id, column }) => {
      const current = tasksRef.current;
      const task = [...TASK_COLUMNS.flatMap((name) => current.columns[name])].find(
        (candidate) => candidate.id === String(id),
      );
      const target = TASK_COLUMNS.find((name) => name === column);
      // Soltar en la misma columna es reordenar: no hay orden que guardar.
      if (!task || !target || task.status === target || !canMoveToRef.current(task, target)) {
        return false;
      }
      onMoveRef.current(task, target);
      // Se deja pasar: la librería ya acomoda la tarjeta en la columna nueva en el mismo
      // cuadro en que se suelta. Cortarlo la dejaba un instante de vuelta en su columna
      // de origen, hasta que llegaban los datos, y parecía que parpadeaba o se perdía.
      // Los datos que llegan después ponen la tarjeta donde corresponde por el orden de
      // siempre (atrasadas primero), y si la API rechaza el cambio vuelve a su lugar.
      return true;
    });

    api.on('select-card', ({ id }) => {
      if (id == null) return;
      onSelectRef.current(String(id));
      // Soltar la selección, o el segundo clic sobre la misma tarjeta no avisa.
      void api.exec('select-card', { id: null });
    });
  }, []);

  return (
    // Ocupa todo el ancho y todo el alto que deja la pantalla: las columnas se estiran
    // hasta abajo y el arrastre acierta aunque se suelte en la parte vacía de una.
    <div className="luma-kanban min-h-80 min-w-0 flex-1 [&_.wx-theme]:h-full">
      <RenderCardContext.Provider value={renderCard}>
        <Willow fonts={false}>
          <Kanban
            cards={cards}
            columns={columns}
            cardContent={KanbanCardContent}
            // Las columnas reparten el ancho entero, no miden 280px y dejan el resto en blanco.
            render={{ fixedColumnWidth: false }}
            init={handleInit}
          />
        </Willow>
      </RenderCardContext.Provider>
    </div>
  );
}

export default TaskKanban;
