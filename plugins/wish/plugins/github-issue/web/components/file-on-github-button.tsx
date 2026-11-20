import { Button } from "@plugins/primitives/plugins/css/plugins/ui-kit/web";
import { TooltipDoc } from "@plugins/primitives/plugins/overlay/plugins/tooltip/web";
import { brand } from "@plugins/ui/plugins/icons/core";
import { Icon } from "@plugins/ui/plugins/icons/web";
import { Clip } from "@plugins/primitives/plugins/css/plugins/clip/web";
import { yieldClass } from "@plugins/primitives/plugins/css/plugins/yield/web";
import type { WishFooterActionProps } from "@plugins/wish/web";
import { wishIssueLink } from "../internal/issue-link";
import { useEnvironmentNotes } from "../internal/use-environment-notes";

const githubIcon = brand("github");

/**
 * Sends the drafted wish to GitHub instead of an agent here: a real
 * `<a target="_blank">` to the repository's new-issue form, prefilled with the
 * wish (picks made readable, titled from its first line) and the page it is
 * about (only when the draft's URL capture is on), closed by the environment a maintainer asks for first: the equin
 * version (release, commit, commits ahead of / behind the trunk), the system
 * and the browser. The browser opens the tab on the user's click. The click
 * leaves the draft alone: opening a link says nothing about an issue having
 * been filed, so the draft stays until the user dismisses it themselves.
 */
export function FileOnGithubButton({ draft, pageUrl }: WishFooterActionProps) {
  const environment = useEnvironmentNotes();
  const blankTooltip = (
    <TooltipDoc title="File on GitHub">
      Open a GitHub issue with this wish instead of launching an agent. The
      issue names your equin version, system and browser.
    </TooltipDoc>
  );
  if (draft.trim() === "" || environment.kind === "loading") {
    return (
      <Button
        variant="ghost"
        disabled
        loading={draft.trim() !== "" && environment.kind === "loading"}
        tooltip={blankTooltip}
        className="gap-none"
      >
        <GithubFace />
      </Button>
    );
  }
  const { href, title, labels } = wishIssueLink({
    draft,
    pageUrl,
    environmentNotes: environment.notes,
  });
  const tooltip = (
    <TooltipDoc title="File on GitHub">
      Opens a new issue on GitHub; the draft stays here until you clear it.
      Title: {title}. Label: {labels.join(", ")}.{" "}
      {pageUrl === null
        ? "No page URL is included."
        : "The page URL is included."}{" "}
      The issue names your equin version, system and browser.
    </TooltipDoc>
  );
  return (
    <Button
      variant="ghost"
      tooltip={tooltip}
      className="gap-none"
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <GithubFace />
    </Button>
  );
}

/**
 * The GitHub mark, its "File on GitHub" label folded away beside it until the
 * button is hovered or keyboard-focused — so the footer's one primary action
 * stays Launch. The label animates to its own width (a `0fr → 1fr` grid
 * track, clipped while folded); the icon-to-label gap rides inside the label, so the folded button
 * is the icon alone.
 */
function GithubFace() {
  return (
    <>
      <Icon icon={githubIcon} />
      <span
        // eslint-disable-next-line layout/no-adhoc-layout -- the fold is a one-column grid whose track animates 0fr → 1fr, so the label opens to its own width with none restated here; no layout primitive owns an animatable track
        className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-hover/button:grid-cols-[1fr] group-focus-visible/button:grid-cols-[1fr] motion-reduce:transition-none"
      >
        <Clip className={yieldClass("x")}>
          <span className="pl-xs">File on GitHub</span>
        </Clip>
      </span>
    </>
  );
}
