// GSAP set-up shared by the animated components (import only from client components).
// Plugins are registered once, here, before any useGSAP() runs. Every GSAP plugin is free.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, DrawSVGPlugin);

/** Fast start, long gentle settle and no overshoot: GSAP's closest match to the site's critically damped spring. */
export const EASE = 'expo.out';

/** Animations run only for people who have not asked their system to reduce motion. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

/**
 * The inline head script (src/lib/theme.ts) adds `motion` to <html> when animations may run, which hides
 * the elements that animate in until they start. Components check it before animating anything.
 */
export const motionOn = () => document.documentElement.classList.contains('motion');

/** Tells the stylesheet that every animated element now has its starting state set by GSAP. */
export const motionReady = () => document.documentElement.classList.add('motion-ready');

export { DrawSVGPlugin, gsap, ScrollTrigger, SplitText, useGSAP };
