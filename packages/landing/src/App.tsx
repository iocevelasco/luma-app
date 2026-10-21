import { Nav } from './components/Nav';
import { Faq } from './sections/Faq';
import { Features } from './sections/Features';
import { FinalCTA } from './sections/FinalCTA';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { How } from './sections/How';
import { Pricing } from './sections/Pricing';
import { Problem } from './sections/Problem';
import { Roles } from './sections/Roles';
import { Security } from './sections/Security';

/**
 * Orden de la página: promesa → problema → quién ve qué → qué incluye →
 * cómo se empieza → seguridad → precio → dudas → cierre. Termina en la banda
 * de cierre, que es el elemento de continuidad de la marca y va en la landing,
 * no en el panel.
 *
 * Todo el contenido sale de i18n. No hay testimonios a propósito: no hay datos
 * reales para sostenerlos y esta página no inventa. El precio (plan Gratis de
 * 30 días; Pro a $39/mes con 3 obras y $8 por obra extra) vive en `pricing.*` y
 * en ningún otro lugar de la landing. La fuente de verdad de esos números es
 * `PLAN` en `@luma/shared/billing` (lo que la app cobra de verdad): si cambia
 * allá, se cambia acá en el mismo PR.
 */
export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Roles />
        <Features />
        <How />
        <Security />
        <Pricing />
        <Faq />
        <FinalCTA />
      </main>
      <div className="brand-stripe" aria-hidden="true" />
      <Footer />
    </>
  );
}
