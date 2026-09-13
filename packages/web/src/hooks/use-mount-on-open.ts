import { useEffect, useState } from 'react';

/**
 * Defers mounting an overlay (dialog/sheet) until its first open, then keeps
 * it mounted so close animations still play. Pair with a `React.lazy`
 * component to keep its chunk out of the page's initial load.
 */
export function useMountOnOpen(open: boolean): boolean {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  return mounted || open;
}
