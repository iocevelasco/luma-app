import { type ReactNode } from 'react';
import { Nav } from './components/Nav';
import { TESTIMONIALS } from './lib/testimonials';
import { Adaptable } from './sections/Adaptable';
import { Faq } from './sections/Faq';
import { Features } from './sections/Features';
import { FinalCTA } from './sections/FinalCTA';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { How } from './sections/How';
import { Pricing } from './sections/Pricing';
import { Problem } from './sections/Problem';
import { Roles } from './sections/Roles';
import { Scene } from './sections/Scene';
import { Security } from './sections/Security';
import { Team } from './sections/Team';
import { Testimonials } from './sections/Testimonials';
import { WhatsAppButton } from './components/WhatsAppButton';
import { Contact } from './sections/Contact';

/**
 * Bandas alternadas: la página va claro → oscuro → claro, empezando en claro
 * después del hero. El tono sale del orden, no de cada sección: si una banda se
 * oculta (testimonios sin datos reales), las demás no quedan con dos iguales
 * seguidas.
 *
 * Orden: promesa → problema → quién ve qué → qué incluye → se adapta → cómo
 * se empieza → seguridad → quiénes somos → testimonios → precio → dudas →
 * cierre.
 *
 * Todo el contenido sale de i18n. Los testimonios son citas reales de personas
 * que dieron permiso: sin datos en `lib/testimonials.ts` la sección no se
 * renderiza, y esta página no inventa. El precio (plan Gratis de 30 días; Pro a
 * $39/mes con 3 obras y $8 por obra extra) vive en `pricing.*` y en ningún otro
 * lugar de la landing. La fuente de verdad de esos números es `PLAN` en
 * `@luma/shared/billing` (lo que la app cobra de verdad): si cambia allá, se
 * cambia acá en el mismo PR.
 */
function Band({ light, children }: { light: boolean; children: ReactNode }) {
  return <div className={light ? 'surface-light bg-background' : 'bg-card'}>{children}</div>;
}

export default function App() {
  const bands: { key: string; node: ReactNode; hidden?: boolean }[] = [
    { key: 'problem', node: <Problem /> },
    { key: 'scene', node: <Scene /> },
    { key: 'roles', node: <Roles /> },
    { key: 'features', node: <Features /> },
    { key: 'adaptable', node: <Adaptable /> },
    { key: 'how', node: <How /> },
    { key: 'security', node: <Security /> },
    { key: 'team', node: <Team /> },
    { key: 'testimonials', node: <Testimonials />, hidden: TESTIMONIALS.length === 0 },
    { key: 'pricing', node: <Pricing /> },
    { key: 'faq', node: <Faq /> },
    { key: 'contact', node: <Contact /> },
    { key: 'finalCta', node: <FinalCTA /> },
  ];
  const visible = bands.filter((band) => !band.hidden);

  return (
    <>
      <Nav />
      <main>
        <Hero />
        {visible.map((band, index) => (
          <Band key={band.key} light={index % 2 === 0}>
            {band.node}
          </Band>
        ))}
      </main>
      <div className="brand-stripe" aria-hidden="true" />
      <Footer />
      <WhatsAppButton />
    </>
  );
}
