export interface NormalizedHost {
  name: string;
  ssh: string;
  port: number | null;
  identityFile: string | null;
  cwd: string | null;
  remotePath: string;
  profile: string;
  recent: string[];
  source: "config" | "user";
}

export interface SshPluginConfig {
  /** Configured hosts from cordis patch file. */
  hosts?: (string | Partial<NormalizedHost>)[];
  /** Custom path to persist manually added hosts. Defaults to ~/.dsh/ssh-hosts.json. */
  storePath?: string;
  /** Custom root directory for local workspace shadows. Defaults to ~/.dsh/remote. */
  mirrorRoot?: string;
  /** Options passed to the underlying AgentLoop plugin. */
  agentLoop?: Record<string, unknown>;
}

export interface MirrorInfo {
  host: string;
  path: string;
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export interface DirListing {
  resolved: string;
  entries: DirEntry[];
}

export interface JsonRpcRequest {
  kind: "request";
  id: number | string;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  kind: "response";
  id: number | string;
  error?: unknown;
  result?: unknown;
}

export interface JsonRpcNotification {
  kind: "notification";
  method: string;
  params?: unknown;
}

export interface JsonRpcJunk {
  kind: "junk";
}

export type ClassifiedMessage =
  | JsonRpcRequest
  | JsonRpcResponse
  | JsonRpcNotification
  | JsonRpcJunk;
