const ROUTES=new Set(['overview','timeline','model']);
export const routeFromHash=hash=>ROUTES.has(String(hash).replace(/^#\/?/,''))?String(hash).replace(/^#\/?/,''):'overview';
export function installRouting(onRoute){const apply=()=>onRoute(routeFromHash(location.hash));addEventListener('hashchange',apply);apply();return()=>removeEventListener('hashchange',apply);}
