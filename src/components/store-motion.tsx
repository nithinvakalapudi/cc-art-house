'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Progressive enhancement: content stays visible if scripts or observers fail. */
export default function StoreMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || !('IntersectionObserver' in window)) return;
    const animations = new Set<Animation>();
    const seen = new WeakSet<Element>();
    const selector = '.craft-centered-heading, .craft-section-heading, .flow-product-card, .home-gallery-card, .craft-category, .craft-promise-grid > div, .craft-story-inner > div, .craft-custom-copy, .home-faq-inner, .craft-last-cta, .checkout-success, .panel, .studio-contact-card';
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const element = entry.target as HTMLElement;
        const isCard = element.matches('.flow-product-card,.home-gallery-card,.craft-category,.craft-promise-grid > div,.panel,.studio-contact-card');
        const siblings = element.parentElement ? [...element.parentElement.children].filter(item => item.matches(selector)) : [];
        const order = Math.max(0, siblings.indexOf(element)) % 5;
        const animation = element.animate(isCard ? [
          { opacity: .18, transform: 'translateY(28px) scale(.975)', filter: 'blur(5px)' },
          { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
        ] : [
          { opacity: .25, transform: 'translateY(24px)', clipPath: 'inset(0 0 18% 0)' },
          { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
        ], { duration: isCard ? 720 : 620, delay: isCard ? order * 80 : 0, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      });
    }, { threshold: .12 });
    const scan = () => document.querySelectorAll(selector).forEach(element => {
      if (!seen.has(element)) { seen.add(element); observer.observe(element); }
    });
    scan();
    const mutations = new MutationObserver(scan);
    const main = document.getElementById('main-content');
    if (main) mutations.observe(main, { childList: true, subtree: true });
    const stop = () => { observer.disconnect(); mutations.disconnect(); animations.forEach(animation => animation.cancel()); };
    const onPreference = () => { if (preference.matches) stop(); };
    preference.addEventListener('change', onPreference);
    return () => { stop(); preference.removeEventListener('change', onPreference); };
  }, [pathname]);
  return null;
}
