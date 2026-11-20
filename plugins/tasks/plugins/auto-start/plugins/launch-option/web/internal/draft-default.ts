import { useConfigResult } from "@plugins/config_v2/web";
import type { DynamicEnumOption } from "@plugins/fields/plugins/dynamic-enum/plugins/config/web";
import { useModelChoiceOptions } from "@plugins/conversations/plugins/model-provider/web";
import type { ModelChoice } from "@plugins/conversations/plugins/model-provider/core";
import { mapResource } from "@plugins/network/plugins/live/plugins/live-state/web";
import {
  AUTO_START_DRAFT_OFF,
  autoStartConfig,
  draftDefaultToValue,
} from "../../core";

/** The configured seed of a fresh draft card's Auto-start pill (`null`: Off). */
export function useAutoStartDraftDefault() {
  return mapResource(
    useConfigResult(autoStartConfig),
    (c): ModelChoice | null => draftDefaultToValue(c.draftDefault),
  );
}

/** The `draftDefault` picker's options: Off, then every selectable model. */
export function useAutoStartDraftOptions(): readonly DynamicEnumOption[] {
  const models = useModelChoiceOptions();
  return [{ value: AUTO_START_DRAFT_OFF, label: "Off" }, ...models];
}
