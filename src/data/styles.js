// THE PLAYSTYLES' NAMES. These labels ARE the registry file format: parseBulk (App.tsx) builds its lookup straight off
// this table, so renaming one silently demotes every club that spells it the old way to Balanced. "Park Bus" became
// "Park The Bus" here and keeps a legacy alias in parseBulk for exactly that reason.
// RENAMED 6 Oct 2026 to the correct football terms, with the styles rebuilt (src/engine/tactics.ts): the ids stay, the
// names move. "tikitaka" is Juego de Posición and "possession" is Tiki-Taka, so the name Tiki-Taka now means the
// patient style; parseBulk keeps the other old names as aliases. The registry server accepts these names and no others.
export const STYLE_LBL = {balanced:"Balanced",gegenpress:"Gegenpressing",tikitaka:"Juego de Posición",verticaltiki:"Vertical Tiki-Taka",possession:"Tiki-Taka",cholismo:"Cholismo",counterattack:"Counter-Attack",zonamista:"Zona Mista",wingplay:"Wing Play",secondball:"Kick and Rush",routeone:"Route One",lanuestra:"La Nuestra",catenaccio:"Catenaccio",parkthebus:"Park the Bus"};
