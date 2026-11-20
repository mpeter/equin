import {
  asAppPath,
  type AppPath,
} from "@plugins/infra/plugins/host-fs/plugins/user-path/core";
import { afterAll, describe, expect, test } from "bun:test";
import {
  copyFileSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { sharedBunDir } from "./shared-bun";

const TMP = mkdtempSync(join("/var/tmp", "shared-bun-"));
afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function fakeBun(
  name: string,
  body: string,
  mtimeSec = 1_700_000_000,
): AppPath {
  const path = join(TMP, name);
  writeFileSync(path, body, { mode: 0o755 });
  utimesSync(path, mtimeSec, mtimeSec);
  return asAppPath(path);
}

describe("sharedBunDir", () => {
  test("two different Buns of one version never share a folder", async () => {
    // Homebrew's and mise's Bun 1.4.4: one version string, two files.
    const homebrew = fakeBun("homebrew-bun", "#!/bin/sh\n# homebrew\n");
    const mise = fakeBun("mise-bun", "#!/bin/sh\n# mise, a larger build\n");
    expect(await sharedBunDir(homebrew)).not.toBe(await sharedBunDir(mise));
  });

  test("same size, different mtime is a different Bun too", async () => {
    const a = fakeBun("a", "same-size-body");
    const b = fakeBun("b", "same-size-body", 1_700_000_500);
    expect(await sharedBunDir(a)).not.toBe(await sharedBunDir(b));
  });

  test("the same Bun reached by another path or as a copy keeps its folder", async () => {
    const bun = fakeBun("original", "#!/bin/sh\n# one\n");
    const copy = join(TMP, "copy");
    copyFileSync(bun, copy);
    utimesSync(copy, 1_700_000_000, 1_700_000_000);
    expect(await sharedBunDir(asAppPath(copy))).toBe(await sharedBunDir(bun));
    expect(await sharedBunDir(bun)).toBe(await sharedBunDir(bun));
  });

  test("the folder names the version, then the identity; the running Bun is the default", async () => {
    expect(await sharedBunDir()).toMatch(
      new RegExp(`/bun-${Bun.version.replaceAll(".", "\\.")}-[0-9a-f]{8}$`),
    );
  });
});
