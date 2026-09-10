export function cleanVersion(v: string): string {
  return v.trim().replace(/^[v^~]/, "");
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

export function parseVersion(v: string): ParsedVersion {
  const cleaned = cleanVersion(v);
  const [main, pre] = cleaned.split("-", 2);
  const parts = (main || "0.0.0").split(".").map((n) => parseInt(n, 10) || 0);

  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  const prerelease = pre ? pre.split(".") : [];

  return { major, minor, patch, prerelease };
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;

  // A version without prerelease is higher than one with prerelease (e.g. 1.0.0 > 1.0.0-rc.1)
  if (pa.prerelease.length === 0 && pb.prerelease.length > 0) return 1;
  if (pa.prerelease.length > 0 && pb.prerelease.length === 0) return -1;
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;

  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i++) {
    const partA = pa.prerelease[i];
    const partB = pb.prerelease[i];

    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);
    const isNumA = !isNaN(numA);
    const isNumB = !isNaN(numB);

    if (isNumA && isNumB) {
      if (numA !== numB) return numA > numB ? 1 : -1;
    } else if (isNumA && !isNumB) {
      return -1;
    } else if (!isNumA && isNumB) {
      return 1;
    } else {
      const cmp = partA.localeCompare(partB);
      if (cmp !== 0) return cmp > 0 ? 1 : -1;
    }
  }

  return 0;
}

export function isNewerVersion(current: string, available: string): boolean {
  if (!current || !available) return false;
  return compareVersions(current, available) < 0;
}
