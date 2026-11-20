import { defineConfig } from "@plugins/config_v2/core";
import { dynamicEnumField } from "@plugins/fields/plugins/dynamic-enum/plugins/config/core";
import {
  DEFAULT_MODEL_CHOICE,
  normalizeModelChoice,
  type ModelChoice,
} from "@plugins/conversations/plugins/model-provider/core";

/** The `draftDefault` value that means Off (a config field holds a string, never `null`). */
export const AUTO_START_DRAFT_OFF = "off";

/**
 * Auto-start's settings (Settings → Config). `draftDefault` is what a fresh
 * draft card's Auto-start pill starts on — Off, or a model; the card's own
 * choice and an existing task's own row are untouched by it.
 */
export const autoStartConfig = defineConfig({
  fields: {
    draftDefault: dynamicEnumField({
      label: "New draft default",
      description:
        "What a new task draft (the Wish popover, a fresh draft card) starts with in its Auto-start pill. Off leaves a quick note for you to launch yourself; a model launches an agent with it as soon as the task is filed.",
      default: DEFAULT_MODEL_CHOICE,
    }),
  },
});

/** The configured `draftDefault` as the option's value: `null` is Off. */
export function draftDefaultToValue(stored: string): ModelChoice | null {
  return stored === AUTO_START_DRAFT_OFF ? null : normalizeModelChoice(stored);
}
