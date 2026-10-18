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
 * reales para sostenerlos y esta página no inventa. El precio ($39/mes, 3 obras,
 * primer mes gratis) vive en `pricing.*` y en ningún otro lugar: si cambia, se
 * cambia ahí.
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
