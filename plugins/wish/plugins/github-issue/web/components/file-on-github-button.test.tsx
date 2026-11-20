import { describe, expect, mock, test } from "bun:test";
import type { ReactElement } from "react";

await mock.module("../internal/use-environment-notes", () => ({
  useEnvironmentNotes: () => ({ kind: "ready", notes: ["Version: 1"] }),
}));

const { FileOnGithubButton } = await import("./file-on-github-button");

describe("FileOnGithubButton", () => {
  test("opening the link does not clear the draft", () => {
    const button = FileOnGithubButton({
      draft: "Make it faster",
      pageUrl: null,
    }) as ReactElement<{ onClick?: () => void }>;
    expect(button.props.onClick).toBeUndefined();
  });
});
