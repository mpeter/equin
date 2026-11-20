import {
  joinAppPath,
  type AppPath,
} from "@plugins/infra/plugins/host-fs/plugins/user-path/core";
import { readdir } from "@plugins/packages/plugins/timed-fs/core";
import { processNamesDir } from "../../data-dirs";
import {
  binaryIdentity,
  cloneNamedBinary,
  RUNNING_BUN,
  type CloneSource,
  type NamedBinary,
} from "./process-name";

// The machine-wide named Buns: `process-names/bun-<version>-<identity>/`, one APFS clone
// per name and Bun binary, shared by every checkout and backend. The CLI
// verbs sit in it directly (the `./equin` script names them from its argv);
// the processes a backend starts (`cloneSharedBun`) in its `processes/`
// subdirectory, so no verb can ever be given one of their names.
//
// Shared because macOS scans every fresh executable on its first exec, and the
// verdict is kept per (path, file): measured 2026-11-12, a scanned clone
// renamed or hardlinked to a new path is scanned again (1.5–1.8 s), a new clone
// at a scanned path too (3.0–3.6 s), whatever its signature (notarized
// Developer ID, ad-hoc) or provenance; only the same file at the same path runs
// free (0.03 s). So a name made once per machine is scanned once, and a name
// made per checkout or per agent is scanned once each — ~1.7 s for Bun's 88 MB.
// A symlink is not scanned, but the kernel names the process after the target
// (`proc_name` `bun`), so a name needs a file of its own.

/**
 * The named Buns of `bin` (default: the Bun this process runs on):
 * `process-names/bun-<version>-<identity>/`.
 *
 * Keyed by the file as well as the version: one version string can be two
 * different binaries (Homebrew's and mise's Bun 1.4.4 differ by 19 MB), and
 * clones are current only for their own source's size and mtime, so checkouts
 * on the two would re-clone over each other's names forever. The identity is
 * the size and mtime a clone is judged current by (`isCurrentClone`), hashed:
 * a stat, no file read, and equal for a clone, a copy that kept its mtime, and
 * the same file under another path. The version stays in the name for whoever
 * reads the directory.
 */
export async function sharedBunDir(
  bin: CloneSource = RUNNING_BUN,
): Promise<AppPath> {
  return processNamesDir.file(
    `bun-${Bun.version}-${await binaryIdentity(bin)}`,
  );
}

/** Where the processes a backend starts live, under a version's directory. */
const PROCESSES = "processes";

/**
 * This process's Bun cloned into {@link sharedBunDir}'s `processes/` as
 * `name` — left alone while current, so every process run through it after
 * the first skips the scan.
 */
export async function cloneSharedBun(name: string): Promise<NamedBinary> {
  return cloneNamedBinary({
    bin: RUNNING_BUN,
    dir: joinAppPath(await sharedBunDir(), PROCESSES),
    name,
  });
}

/**
 * {@link cloneSharedBun}'s `name` in every Bun version's directory that holds
 * it — the ones an upgrade left behind included, for whoever runs processes
 * through `name` to reclaim once none does.
 */
export async function sharedBunsNamed(name: string): Promise<AppPath[]> {
  let versions: string[];
  try {
    versions = await readdir(processNamesDir.path);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: AppPath[] = [];
  for (const v of versions.filter((d) => d.startsWith("bun-"))) {
    const dir = joinAppPath(processNamesDir.path, v, PROCESSES);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") continue;
      throw err;
    }
    if (names.includes(name)) out.push(joinAppPath(dir, name));
  }
  return out;
}
