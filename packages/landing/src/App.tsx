import { Nav } from './components/Nav';
import { Faq } from './sections/Faq';
import { Features } from './sections/Features';
import { FinalCTA } from './sections/FinalCTA';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';
import { How } from './sections/How';
import { Problem } from './sections/Problem';
import { Roles } from './sections/Roles';

/**
 * Orden de la página: promesa → problema → quién ve qué → qué incluye →
 * cómo se empieza → dudas → cierre. Termina en la banda de cierre, que es el
 * elemento de continuidad de la marca y va en la landing, no en el panel.
 *
 * Todo el contenido sale de i18n. No hay pricing ni testimonios a propósito:
 * no hay datos reales para sostenerlos y esta página no inventa.
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
        <Faq />
        <FinalCTA />
      </main>
      <div className="brand-stripe" aria-hidden="true" />
      <Footer />
    </>
  );
}
