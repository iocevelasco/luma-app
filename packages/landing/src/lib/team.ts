import ioceFoto from '../assets/team/ioce-480.webp';
import marioFoto from '../assets/team/mario-480.webp';

/**
 * Integrantes del equipo. Nombre, LinkedIn y foto viven acá; cargo y
 * descripción van por i18n bajo `team.members.<id>`.
 *
 * Foto: WebP cuadrado, 480 px (`src/assets/team/`). Sin `linkedin` no se
 * muestra el botón; sin `photo` se muestra un marco neutro.
 */
export interface TeamMember {
  id: string;
  name: string;
  linkedin?: string;
  photo?: string;
}

export const TEAM: TeamMember[] = [
  {
    id: 'm1',
    name: 'José Mario Wong Sánchez',
    linkedin: 'https://www.linkedin.com/in/jose-mario-wong-sanchez-2b59b1113/',
    photo: marioFoto,
  },
  {
    id: 'm2',
    name: 'Ioce Velasco',
    linkedin: 'https://www.linkedin.com/in/ioce-velasco-23b53752/',
    photo: ioceFoto,
  },
];
