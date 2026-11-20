import { defineDataDir } from "@plugins/infra/plugins/paths/core";

/**
 * One directory per install run (`<run-id>/`), written by install.sh itself
 * (it names this path by hand: it runs before any of the repo exists):
 * `events.jsonl` (every event of the run, what the window and the terminal
 * drew), `install.log` (every log line of the run, whole — the events cut the
 * long ones), `events.fifo` (the hub every writer reaches), and `timing.json`
 * (how long each step took, when the install finished — the input of
 * `./equin installer estimates`). `latest` links the newest run.
 */
export const installRunsDir = defineDataDir({
  kind: "logs",
  name: "install",
  owner: "installer",
  description:
    "Install runs (one dir per run of install.sh): the run's event stream, its hub FIFO and, once it finished, its per-step timing; `latest` links the newest",
  // The record of past installs; the medians already taken are in
  // installer/core's estimates.json.
  reclaim: { kind: "keep", keep: 10 },
  logs: [
    {
      pattern: "*/events.jsonl",
      bound: {
        kind: "truncate-on-start",
        reason:
          "one file per install run, written once by that run and never appended to again",
      },
    },
    {
      pattern: "*/install.log",
      bound: {
        kind: "truncate-on-start",
        reason:
          "one file per install run, written only by that run (and its resume); the dir keeps the last 10 runs",
      },
    },
  ],
});

export default [installRunsDir];
