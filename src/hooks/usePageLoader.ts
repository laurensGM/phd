import { useEffect } from 'react';
import { hidePageLoader, showPageLoader } from '../lib/pageLoader';

/** Keep the global logo spinner visible while `active` is true. */
export function usePageLoader(active: boolean): void {
  useEffect(() => {
    if (!active) {
      hidePageLoader();
      return;
    }
    showPageLoader();
    return () => {
      hidePageLoader();
    };
  }, [active]);
}
