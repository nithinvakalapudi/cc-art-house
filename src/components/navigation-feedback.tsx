'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function NavigationFeedback() {
  const pathname = usePathname();
  return <NavigationIndicator key={pathname} />;
}

function NavigationIndicator() {
  const [destination, setDestination] = useState('');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download') || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

      const label = (anchor.getAttribute('aria-label') || anchor.textContent || 'page').trim().replace(/\s+/g, ' ');
      setDestination(label.slice(0, 50));
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setDestination(''), 15000);
    }

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  if (!destination) return null;
  return <div className="navigation-feedback" role="status" aria-live="polite">
    <div className="navigation-feedback-bar" aria-hidden="true" />
    <div className="navigation-feedback-message"><span className="loading-spinner" aria-hidden="true" />Opening {destination}…</div>
  </div>;
}
