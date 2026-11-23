// Light and dark follow the operating system. The header toggle stores an explicit choice, which this
// inline script applies before the page paints (so a saved theme never flashes the other one).
export const THEME_KEY = 'cb.theme';

/** Browser chrome colour (status bar, tab strip) for each theme; matches --bg in site.css. */
export const THEME_COLORS = { light: '#0f1116', dark: '#07080b' } as const;

const theme = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){d.dataset.theme=t;document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.content=t==='light'?'${THEME_COLORS.light}':'${THEME_COLORS.dark}'})}}catch(e){}`;

// Animations (src/components/client/motion): `motion` hides the elements that animate in until GSAP has
// set their starting state (it then adds `motion-ready`). Only when the visitor has not asked to reduce
// motion, and if the animations have not started within 4 seconds (slow or failed script), the class is
// removed so nothing ever stays hidden.
const motion = `try{if(matchMedia('(prefers-reduced-motion: no-preference)').matches){d.classList.add('motion');setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.remove('motion')},4000)}}catch(e){}`;

export const THEME_SCRIPT = `(function(){var d=document.documentElement;${theme}${motion}})()`;
