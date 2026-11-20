import {
  asAppPath,
  joinAppPath,
  type AppPath,
} from "@plugins/infra/plugins/host-fs/plugins/user-path/core";
import { openOwnedFdSync } from "@plugins/packages/plugins/owned-fd/core";
import { REPO_ROOT } from "@plugins/infra/plugins/paths/plugins/repo-root/core";
import { spawnCaptured } from "@plugins/infra/plugins/spawn/core";
import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHECKOUT_BUN_DIR,
  checkoutBun,
  cloneNamedBinary,
  isCurrentCloneOf,
  refreshCheckoutBun,
  RUNNING_BUN,
} from "./process-name";

/**
 * This file re-run as a child on a Bun whose file has no name left — on Linux
 * its execPath reads `<path> (deleted)` — the state a re-clone of
 * `equin · <verb>` left a starting `./equin` process in (the parent test at
 * the bottom of this file).
 */
const DELETED_EXE_CHILD = process.env.PROCESS_NAME_DELETED_EXE_CHILD === "1";

// Where the tests make clones. macOS's temp dir is APFS; Linux's `/tmp` is
// often tmpfs, which has no FICLONE — every clone there is refused (ENOTSUP),
// so on Linux the disk-backed `/var/tmp`. Removed once this file's tests end.
const CLONEABLE_TMP = mkdtempSync(
  join(process.platform === "linux" ? "/var/tmp" : tmpdir(), "process-name-"),
);
afterAll(() => {
  rmSync(CLONEABLE_TMP, { recursive: true, force: true });
});

function tmpRoot(prefix = "process-name-"): string {
  return mkdtempSync(join(CLONEABLE_TMP, prefix));
}

function fakeBin(dir: string, name = "bun"): AppPath {
  const path = asAppPath(join(dir, name));
  // The name in the body: two fake Buns differ in size, as two Buns do.
  writeFileSync(path, `#!/bin/sh\n# ${name}\n`, { mode: 0o755 });
  return path;
}

describe.if(!DELETED_EXE_CHILD)("cloneNamedBinary", () => {
  test("the name is a file of its own with the binary's bytes, and a new binary replaces it", async () => {
    const root = asAppPath(tmpRoot());
    const first = fakeBin(root, "one");
    const second = fakeBin(root, "second");
    const dir = asAppPath(join(root, "names"));
    const a = await cloneNamedBinary({ bin: first, dir, name: "equin · x" });
    if (a.kind !== "cloned") throw new Error("not cloned");
    expect(statSync(a.path).ino).not.toBe(statSync(first).ino);
    expect(statSync(a.path).nlink).toBe(1);
    expect(statSync(first).nlink).toBe(1);
    expect(readFileSync(a.path, "utf8")).toBe(readFileSync(first, "utf8"));
    // Its source's mtime, to the millisecond: how a later call knows it current.
    expect(Math.trunc(statSync(a.path).mtimeMs)).toBe(
      Math.trunc(statSync(first).mtimeMs),
    );
    const b = await cloneNamedBinary({ bin: second, dir, name: "equin · x" });
    if (b.kind !== "cloned") throw new Error("not cloned");
    expect(b.path).toBe(a.path);
    expect(readFileSync(b.path, "utf8")).toBe(readFileSync(second, "utf8"));
  });

  test("a current clone is left in place — no fresh file to scan", async () => {
    const root = asAppPath(tmpRoot());
    const bin = fakeBin(root);
    const dir = asAppPath(join(root, "names"));
    const a = await cloneNamedBinary({ bin, dir, name: "equin · x" });
    if (a.kind !== "cloned") throw new Error("not cloned");
    const ino = statSync(a.path).ino;
    await cloneNamedBinary({ bin, dir, name: "equin · x" });
    expect(statSync(a.path).ino).toBe(ino);
  });

  test("a dead writer's staging is removed, even beside a current clone; a live one's is kept", async () => {
    const root = asAppPath(tmpRoot());
    const bin = fakeBin(root);
    const dir = asAppPath(join(root, "names"));
    await cloneNamedBinary({ bin, dir, name: "equin · x" });
    const exited = Bun.spawn(["true"]);
    await exited.exited;
    const dead = String(exited.pid);
    // The hardlink builds' pid-only name, and today's `<pid>.<seq>`.
    linkSync(bin, join(dir, `.${dead}.tmp`));
    writeFileSync(join(dir, `.${dead}.3.tmp`), "");
    writeFileSync(join(dir, `.verbs.${dead}.1.tmp`), "");
    const live = `.${String(process.ppid)}.1.tmp`;
    writeFileSync(join(dir, live), "");
    await cloneNamedBinary({ bin, dir, name: "equin · x" });
    expect(readdirSync(dir).sort()).toEqual(
      [live, "equin · x", ".locks"].sort(),
    );
    expect(statSync(bin).nlink).toBe(1);
  });

  test("concurrent makers of one name make it once: none renames over another's file", async () => {
    const root = asAppPath(tmpRoot());
    const bin = fakeBin(root);
    const dir = asAppPath(join(root, "names"));
    const inos = await Promise.all(
      Array.from({ length: 6 }, async () => {
        const named = await cloneNamedBinary({ bin, dir, name: "equin · x" });
        if (named.kind !== "cloned") throw new Error("not cloned");
        // What a process exec'ing it as soon as its start returned would run.
        return statSync(named.path).ino;
      }),
    );
    expect(new Set(inos).size).toBe(1);
    expect(statSync(join(dir, "equin · x")).ino).toBe(inos[0]!);
  });

  test("an old build's hardlink at the name is replaced by a clone", async () => {
    const root = asAppPath(tmpRoot());
    const bin = fakeBin(root);
    const dir = asAppPath(join(root, "names"));
    mkdirSync(dir);
    linkSync(bin, join(dir, "equin · x"));
    const named = await cloneNamedBinary({ bin, dir, name: "equin · x" });
    if (named.kind !== "cloned") throw new Error("not cloned");
    expect(statSync(named.path).ino).not.toBe(statSync(bin).ino);
    expect(statSync(bin).nlink).toBe(1);
  });
});

/** The machine-wide verbs dir, in its own temp root. */
function verbsDir(): AppPath {
  return asAppPath(join(tmpRoot("process-name-verbs-"), "bun-1.0.0"));
}

describe.if(!DELETED_EXE_CHILD)("checkout bun", () => {
  test("trusted only while its stamp is newer than mise.lock", async () => {
    const root = asAppPath(tmpRoot());
    const bun = fakeBin(root);
    expect(await checkoutBun(root)).toBeNull();
    const linked = await refreshCheckoutBun(root, bun, verbsDir());
    expect(linked).toEqual({
      kind: "cloned",
      path: joinAppPath(root, CHECKOUT_BUN_DIR, "bun"),
    });
    expect(await checkoutBun(root)).toBe(
      joinAppPath(root, CHECKOUT_BUN_DIR, "bun"),
    );

    // The toolchain moved after the stamp: no longer trusted…
    writeFileSync(join(root, "mise.lock"), "");
    const later = new Date(Date.now() + 60_000);
    utimesSync(join(root, "mise.lock"), later, later);
    expect(await checkoutBun(root)).toBeNull();
    // …until a run on the locked Bun records it again.
    utimesSync(join(root, "mise.lock"), new Date(0), new Date(0));
    await refreshCheckoutBun(root, fakeBin(root, "newer"), verbsDir());
    expect(readFileSync(join(root, CHECKOUT_BUN_DIR, "bun"), "utf8")).toBe(
      readFileSync(join(root, "newer"), "utf8"),
    );
    expect(await checkoutBun(root)).toBe(
      joinAppPath(root, CHECKOUT_BUN_DIR, "bun"),
    );
  });

  test("verbs points at the machine-wide dir, followed when it moves", async () => {
    const root = asAppPath(tmpRoot());
    const bun = fakeBin(root);
    const first = verbsDir();
    await refreshCheckoutBun(root, bun, first);
    const link = join(root, CHECKOUT_BUN_DIR, "verbs");
    expect(readlinkSync(link)).toBe(first);
    expect(statSync(first).isDirectory()).toBe(true);
    // Unchanged: left alone.
    const before = lstatSync(link).ino;
    await refreshCheckoutBun(root, bun, first);
    expect(lstatSync(link).ino).toBe(before);
    // Another Bun version: repointed.
    const second = verbsDir();
    await refreshCheckoutBun(root, bun, second);
    expect(readlinkSync(link)).toBe(second);
  });

  test("an older build's hardlinked bun becomes a clone; per-checkout verb names go", async () => {
    const root = asAppPath(tmpRoot());
    const bun = fakeBin(root);
    const dir = join(root, CHECKOUT_BUN_DIR);
    mkdirSync(dir, { recursive: true });
    linkSync(bun, join(dir, "bun"));
    linkSync(bun, join(dir, "equin · run · att-x"));
    linkSync(bun, join(dir, "equin · test · att-x.4242"));
    await refreshCheckoutBun(root, bun, verbsDir());
    expect(statSync(join(dir, "bun")).nlink).toBe(1);
    expect(existsSync(join(dir, "equin · run · att-x"))).toBe(false);
    // A script's clone in flight is its own business.
    expect(statSync(join(dir, "equin · test · att-x.4242")).ino).toBe(
      statSync(bun).ino,
    );
  });
});

describe.if(process.platform === "linux" && !DELETED_EXE_CHILD)(
  "a process whose Bun's file has no name (Linux)",
  () => {
    test("clones its Bun all the same: RUNNING_BUN, not its execPath", async () => {
      // A copy of this Bun, its name removed while this process holds it open,
      // exec'd through that descriptor: the child runs a file with no name.
      const copy = asAppPath(join(tmpRoot(), "bun"));
      copyFileSync("/proc/self/exe", copy, constants.COPYFILE_FICLONE);
      chmodSync(copy, 0o755);
      const held = openOwnedFdSync(copy);
      try {
        unlinkSync(copy);
        const exe = `/proc/${String(process.pid)}/fd/${String(held.fd)}`;
        const result = await spawnCaptured([exe, "test", import.meta.path], {
          // The repo root, so the child reads the same bunfig (test preload).
          cwd: REPO_ROOT,
          env: { ...process.env, PROCESS_NAME_DELETED_EXE_CHILD: "1" },
          timeoutMs: 120_000,
        });
        if (result.exitCode !== 0) {
          throw new Error(
            `deleted-exe child exited ${String(result.exitCode)}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
          );
        }
        // Its own three tests ran, not skipped.
        expect(`${result.stdout}${result.stderr}`).toMatch(/\b3 pass\b/);
      } finally {
        held.close();
      }
    }, 150_000);
  },
);

describe.if(DELETED_EXE_CHILD)("on a Bun whose file has no name", () => {
  test("execPath names no file: the case under test", () => {
    expect(process.execPath).toEndWith(" (deleted)");
    expect(existsSync(process.execPath)).toBe(false);
  });

  test("that execPath as a clone source is a loud ENOENT, never a refusal", () => {
    const dir = asAppPath(join(tmpRoot(), "names"));
    const bin = asAppPath(process.execPath);
    expect(
      cloneNamedBinary({ bin, dir, name: "equin · x" }),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("RUNNING_BUN is recorded as the checkout's Bun, and current from then on", async () => {
    const root = asAppPath(tmpRoot());
    const verbs = verbsDir();
    // No clone yet: the locked path, whose wait is a child process.
    const named = await refreshCheckoutBun(root, RUNNING_BUN, verbs);
    expect(named).toEqual({
      kind: "cloned",
      path: joinAppPath(root, CHECKOUT_BUN_DIR, "bun"),
    });
    if (named.kind !== "cloned") return;
    expect(statSync(named.path).size).toBe(statSync("/proc/self/exe").size);
    expect(await isCurrentCloneOf(named.path, [RUNNING_BUN])).toBe(true);
    const ino = statSync(named.path).ino;
    await refreshCheckoutBun(root, RUNNING_BUN, verbs);
    expect(statSync(named.path).ino).toBe(ino);
  });
});
