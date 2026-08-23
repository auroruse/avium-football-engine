globalThis.localStorage = { _d:{}, getItem(k){return this._d[k] ?? null;}, setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];}, clear(){this._d={};}, key(){return null;}, get length(){return 0;} };
globalThis.matchMedia = () => ({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
globalThis.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
globalThis.scrollTo = () => {};
if (typeof window === "undefined") globalThis.window = globalThis;
if (typeof document === "undefined") globalThis.document = {
  createElement: () => ({ style:{}, setAttribute(){}, appendChild(){}, getContext: () => null, remove(){} }),
  body: { appendChild(){}, removeChild(){} }, documentElement: { style:{}, setAttribute(){}, classList:{ add(){}, remove(){} } },
  addEventListener(){}, removeEventListener(){}, querySelector: () => null, getElementById: () => null,
};
try { if (!globalThis.navigator?.clipboard) Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node", clipboard: { writeText(){} } }, configurable: true }); } catch {}
