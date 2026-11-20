import { useMemo } from "react";
import { combineResources } from "@plugins/network/plugins/live/plugins/live-state/web";
import type { ResourceResult } from "@plugins/network/plugins/live/plugins/live-state/web";
import { TaskLaunch, type LaunchOptionInfo } from "../slots";

/** A draft card's launch-option values, keyed by option id. */
export type LaunchOptionValues = Record<string, unknown>;

/** Every registered option's seed value — what a fresh draft card starts from. */
export function useLaunchOptionDefaults(): LaunchOptionValues {
  const options = TaskLaunch.Option.useContributions();
  return useMemo(
    () => Object.fromEntries(options.map((o) => [o.id, o.def.defaultValue])),
    [options],
  );
}

/**
 * One option's value on a draft card. Presence, not `??`: `null` is a real
 * value (auto-start Off), and `??` would silently restore the default the user
 * just cleared.
 */
export function launchOptionValue(
  values: LaunchOptionValues,
  option: LaunchOptionInfo,
): unknown {
  return option.id in values ? values[option.id] : option.def.defaultValue;
}

/**
 * Drops values whose option is no longer registered. Asymmetric on purpose: a
 * stale localStorage draft must never block the user, while the server — which
 * cannot be stale — rejects an unknown id loudly.
 */
export function pickKnownOptions(
  values: LaunchOptionValues,
  known: readonly { id: string }[],
): LaunchOptionValues {
  const ids = new Set(known.map((o) => o.id));
  return Object.fromEntries(
    Object.entries(values).filter(([id]) => ids.has(id)),
  );
}

/**
 * The draft-card seeds that are settings (`useDraftDefault`), keyed by option
 * id; an option without one is absent and keeps `def.defaultValue`. Loading or
 * error until every setting is known: a draft surface waits rather than show a
 * stand-in for a value the user configured.
 */
export function useDraftOptionDefaults(): ResourceResult<LaunchOptionValues> {
  const options = TaskLaunch.Option.useContributions();
  // The registry is fixed for the life of the page (contributions are declared
  // at build time), so this calls the same hooks in the same order every render.
  const results: Record<string, ResourceResult<unknown>> = {};
  for (const option of options) {
    const useDraftDefault = option.useDraftDefault;
    if (!useDraftDefault) continue;
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed registry, see above
    results[option.id] = useDraftDefault();
  }
  return combineResources(results);
}

/** The options with their seed replaced by the configured draft default, so every read of `def.defaultValue` downstream follows it. */
export function withDraftDefaults<T extends LaunchOptionInfo>(
  options: readonly T[],
  defaults: LaunchOptionValues,
): T[] {
  return options.map((o) =>
    o.id in defaults
      ? { ...o, def: { ...o.def, defaultValue: defaults[o.id] } }
      : o,
  );
}
