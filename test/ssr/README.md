# Render smoke test

`node test/ssr/build.mjs && node test/ssr/render.mjs`

Bundles `src/App.tsx` for node (virtual modules resolved from `public/`, assets as data URIs,
React kept external so there is one copy) and server-renders every tab. A render-time
`ReferenceError` — the class of bug that shows as a black screen and that neither `vite build`
nor the engine harnesses can see — fails here with a stack.

It renders with DEFAULT state only. It cannot reach a screen that needs a restored save, a
running match, or a click, so a clean run is not proof the app is fine — only that nothing throws
on first paint of each tab.
