import { useEffect, useState } from 'react';

import { parseHash } from '@/dashboard/router';
import type { Route } from '@/dashboard/router';

/**
 * Page hash route. The hook reads the route on mount and on each hashchange
 * event. The Back button and saved links then work.
 */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChanged = (): void => {
      setRoute(parseHash(window.location.hash));
    };

    window.addEventListener('hashchange', onHashChanged);
    return () => {
      window.removeEventListener('hashchange', onHashChanged);
    };
  }, []);

  return route;
}
