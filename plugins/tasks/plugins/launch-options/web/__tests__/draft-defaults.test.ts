/**
 * A fresh draft card takes an option's seed from the configured draft default,
 * the committed `def.defaultValue` where none is configured, and a card's own
 * choice over both.
 */
import { describe, expect, it } from "vitest";
import { launchOptionValue, withDraftDefaults } from "../internal/values";
import type { LaunchOptionInfo } from "../slots";

const autoStart = {
  id: "auto-start",
  def: { id: "auto-start", defaultValue: "opus" },
} as unknown as LaunchOptionInfo;
const effort = {
  id: "effort",
  def: { id: "effort", defaultValue: null },
} as unknown as LaunchOptionInfo;

const seed = (defaults: Record<string, unknown>, choices = {}) =>
  withDraftDefaults([autoStart, effort], defaults).map((o) =>
    launchOptionValue(choices, o),
  );

describe("withDraftDefaults", () => {
  it("keeps the committed default when nothing is configured", () => {
    expect(seed({})).toEqual(["opus", null]);
  });

  it("a configured Off seeds a fresh card with null, other options untouched", () => {
    expect(seed({ "auto-start": null })).toEqual([null, null]);
  });

  it("a configured model seeds a fresh card", () => {
    expect(seed({ "auto-start": "sonnet" })).toEqual(["sonnet", null]);
  });

  it("the card's own choice still wins", () => {
    expect(seed({ "auto-start": null }, { "auto-start": "haiku" })).toEqual([
      "haiku",
      null,
    ]);
  });
});
