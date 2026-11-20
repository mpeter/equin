import type { Locator, Page } from "playwright";
import {
  closeLauncherGrid,
  openLauncherGrid,
} from "@plugins/apps-core/plugins/app-launcher/e2e";
import { ELEMENT_TIMEOUT_MS } from "@plugins/framework/plugins/tooling/plugins/e2e-harness/plugins/page-ready/core";

/** The way back to the desktop, opened and ready to click. */
export interface BackToDesktop {
  /** The launcher's "Back to Desktop" — the click is the switch. */
  back: Locator;
  /** Close the launcher once the switch is measured (the click closes it). */
  close: () => Promise<void>;
}

/**
 * After a desktop window went full screen, open the launcher drawn in `scope`
 * (a page, or an in-process app embed's root) and return its "Back to
 * Desktop" header (`useReturnTarget`), with the grid settled — so a trace of
 * the click bills the switch, not the popover opening.
 *
 * This is every audience's way back. The action bar's Layout control also
 * switches modes, but it is a developer-only view option (`audience:
 * "developer"`): with Developer mode off — the default — its radios never
 * render, so a script that leaves full screen through them times out waiting
 * for "Desktop" on any install whose user has not turned Developer mode on.
 */
export async function openBackToDesktop(
  scope: Page | Locator,
): Promise<BackToDesktop> {
  const grid = await openLauncherGrid(scope);
  const back = grid.getByRole("button", { name: "Back to Desktop" });
  await back.waitFor({ timeout: ELEMENT_TIMEOUT_MS });
  return { back, close: () => closeLauncherGrid(grid) };
}
