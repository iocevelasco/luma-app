import { Nav } from './components/Nav';
import { FinalCTA } from './sections/FinalCTA';
import { Features } from './sections/Features';
import { Footer } from './sections/Footer';
import { Hero } from './sections/Hero';

/**
 * Estructura de la landing, sin producto.
 *
 * Cuatro bandas y nada más: encabezado, tres celdas de feature, cierre con CTA
 * y pie, cerradas por la banda de sol — el elemento de continuidad de la marca,
 * que va en todas las páginas de la landing y en ninguna del panel. Es el esqueleto sobre el que va la propuesta real cuando exista — las
 * secciones que falten (precios, testimonios, cómo funciona) se agregan acá.
 */
export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <FinalCTA />
      </main>
      <div className="sunset-stripe" aria-hidden="true" />
      <Footer />
    </>
  );
}
