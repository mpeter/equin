/**
 * e2e barrel for the desktop's windows: which windows a surface shows, the way
 * back to the desktop from full screen, and the elements one desktop ↔ full
 * screen switch restyles (from Chrome's trace), importable by another plugin's
 * e2e script as
 * `@plugins/apps/plugins/desktop/plugins/windows/e2e`.
 */
export { openBackToDesktop } from "./support/back-to-desktop";
export type { BackToDesktop } from "./support/back-to-desktop";
export { shownWindowIds } from "./support/shown-window-ids";
export {
  BIG_RECALC,
  styleRecalcs,
  traceSwitch,
} from "./support/styled-elements";
export type { TracedSwitch } from "./support/styled-elements";
