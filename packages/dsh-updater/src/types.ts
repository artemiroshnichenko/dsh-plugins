export interface UpdaterConfig {
  autoCheckIntervalMinutes?: number;
  enableBadge?: boolean;
  enableCommands?: boolean;
  dshInstallPath?: string;
  pluginsRepoPath?: string;
  profilesPath?: string;
}

export interface VersionInfo {
  current: string;
  latest: string;
  updateAvailable: boolean;
  channel?: string;
  publishedAt?: string;
  distTags?: Record<string, string>;
}

export interface PluginItemInfo {
  name: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  location: string;
}

export interface PluginsStatus {
  hasUpdates: boolean;
  repoPath: string;
  repoBehind: number;
  repoBranch: string;
  items: PluginItemInfo[];
}

export interface CheckUpdatesResult {
  dsh: VersionInfo;
  plugins: PluginsStatus;
  checkedAt: string;
  hasAnyUpdates: boolean;
}

export interface UpdateOptions {
  target?: "all" | "dsh" | "plugins";
  restart?: boolean;
  dshVersion?: string;
}

export interface UpdateStepResult {
  step: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  output?: string;
  error?: string;
  durationMs?: number;
}

export interface UpdateExecutionResult {
  ok: boolean;
  target: string;
  steps: UpdateStepResult[];
  restarting: boolean;
  error?: string;
}

export interface UpdateProgress {
  active: boolean;
  target?: string;
  phase: string;
  percent: number;
  currentStepIndex: number;
  totalSteps: number;
  currentStepName: string;
  startedAt?: number;
  steps: UpdateStepResult[];
}

export interface RestartResult {
  ok: boolean;
  restarting: boolean;
  pid: number;
  message: string;
}
