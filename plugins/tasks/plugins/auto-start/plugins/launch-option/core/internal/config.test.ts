import { describe, expect, it } from "bun:test";
import { DEFAULT_MODEL_CHOICE } from "@plugins/conversations/plugins/model-provider/core";
import { autoStartLaunchOption } from "./option";
import {
  AUTO_START_DRAFT_OFF,
  autoStartConfig,
  draftDefaultToValue,
} from "./config";

describe("auto-start draft default", () => {
  it("the committed default is the option's own default (no change for other users)", () => {
    expect(
      draftDefaultToValue(autoStartConfig.fields.draftDefault.defaultValue),
    ).toBe(autoStartLaunchOption.defaultValue);
    expect(autoStartLaunchOption.defaultValue).toBe(DEFAULT_MODEL_CHOICE);
  });

  it("Off reads as null, a model as itself", () => {
    expect(draftDefaultToValue(AUTO_START_DRAFT_OFF)).toBeNull();
    expect(draftDefaultToValue("sonnet")).toBe("sonnet");
  });
});
