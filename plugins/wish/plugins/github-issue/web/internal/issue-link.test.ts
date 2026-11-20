import { describe, expect, test } from "bun:test";
import { serializeUiContext } from "@plugins/primitives/plugins/ui-context/core";
import { wishIssueLink } from "./issue-link";

const PAGE = "https://app.example/tasks/secret-board?token=abc";
const NOTES = ["Version: 1", "Browser: Test"];

const body = (href: string) => new URL(href).searchParams.get("body") ?? "";

describe("wishIssueLink", () => {
  test("names the page in the body when the draft shares its URL", () => {
    const { href } = wishIssueLink({
      draft: "Make it faster",
      pageUrl: PAGE,
      environmentNotes: NOTES,
    });
    expect(body(href)).toContain(`Page: ${PAGE}`);
  });

  test("carries no page URL anywhere in the link without one", () => {
    const { href } = wishIssueLink({
      draft: "Make it faster",
      pageUrl: null,
      environmentNotes: NOTES,
    });
    expect(body(href)).not.toContain("Page:");
    expect(body(href)).not.toContain("app.example");
    expect(decodeURIComponent(href.replace(/\+/g, " "))).not.toContain(
      "app.example",
    );
    expect(body(href)).toContain("Version: 1");
  });

  test("keeps each pick's coordinates but not its url without a page", () => {
    const pickUrl = "https://app.example/tasks/secret-board?token=abc";
    const draft = `Fix ${serializeUiContext(
      {
        url: pickUrl,
        element: "button — Save",
        selector: "main>button",
        source: "plugins/x/web/save.tsx:7",
      },
      "picked",
    )} please`;
    const off = wishIssueLink({
      draft,
      pageUrl: null,
      environmentNotes: NOTES,
    });
    const offBody = body(off.href);
    expect(offBody).not.toContain("app.example");
    expect(offBody).not.toContain("token=abc");
    expect(offBody).toContain("button — Save");
    expect(offBody).toContain('selector="main>button"');
    expect(offBody).toContain('source="plugins/x/web/save.tsx:7"');
    expect(decodeURIComponent(off.href.replace(/\+/g, " "))).not.toContain(
      "app.example",
    );

    const on = wishIssueLink({ draft, pageUrl: PAGE, environmentNotes: NOTES });
    expect(body(on.href)).toContain(`url="${pickUrl}"`);
  });
});
