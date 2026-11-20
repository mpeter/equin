import { SOURCE_REPO_URL } from "@plugins/framework/plugins/product-name/core";
import {
  buildIssueUrl,
  issueTitle,
} from "@plugins/integrations/plugins/github-issues/core";

/** The repository label every wish filed from the app carries (applied for a filer with triage rights). */
export const WISH_LABEL = "Wish";

export interface WishIssueInput {
  draft: string;
  /** The page URL the draft shares; `null` leaves the page out of the issue entirely. */
  pageUrl: string | null;
  /** The environment lines the maintainer asks for first. */
  environmentNotes: readonly string[];
}

/** The new-issue link for a wish: what the button opens, and what its tooltip previews. */
export function wishIssueLink({
  draft,
  pageUrl,
  environmentNotes,
}: WishIssueInput): { href: string; title: string; labels: string[] } {
  const labels = [WISH_LABEL];
  return {
    href: buildIssueUrl({
      repoUrl: SOURCE_REPO_URL,
      text: draft,
      omitPickUrls: pageUrl === null,
      ...(pageUrl === null ? {} : { pageUrl }),
      notes: [
        ...environmentNotes,
        "Filed from the Wish button in the equin app",
      ],
      labels,
    }),
    title: issueTitle(draft),
    labels,
  };
}
