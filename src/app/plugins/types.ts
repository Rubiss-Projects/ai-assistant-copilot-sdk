import type { ChatInputCommandInteraction, Client, Message } from "discord.js";

// --- Plugin Categories ---
export type PluginCategory = "interactive" | "automation" | "hybrid";
export type ProcessType = "bot" | "worker";

// --- Bot Contributions ---
export interface CommandDefinition {
  /** The slash command builder data (from discord.js SlashCommandBuilder.toJSON()) */
  data: unknown;
  /** Handler function for the command */
  execute: (interaction: ChatInputCommandInteraction, ...args: unknown[]) => Promise<void>;
}

export interface MessageRoute {
  /** Name for logging/debugging */
  name: string;
  /** Return true if this route should handle the message */
  match: (message: Message, client: Client) => boolean;
  /** Handle the message */
  handle: (message: Message, client: Client, ...args: unknown[]) => Promise<void>;
}

export interface BotContributions {
  commands?: CommandDefinition[];
  messageRoutes?: MessageRoute[];
}

// --- Worker Contributions ---
export interface WebhookRoute {
  /** HTTP method */
  method: "GET" | "POST" | "PUT";
  /** URL path (e.g., "/webhooks/alertmanager") */
  path: string;
  /** Handler function */
  handler: (request: unknown, reply: unknown) => Promise<void>;
  /** Optional HMAC secret env var name for verification */
  hmacSecretEnv?: string;
}

export interface WatcherDefinition {
  /** Watcher name */
  name: string;
  /** Start the watcher. Returns a cleanup function. */
  start: () => Promise<() => void>;
}

export interface ScheduleDefinition {
  /** Schedule name */
  name: string;
  /** Cron-like interval in milliseconds */
  intervalMs: number;
  /** The scheduled function */
  run: () => Promise<void>;
}

export interface WorkerContributions {
  webhooks?: WebhookRoute[];
  watchers?: WatcherDefinition[];
  schedules?: ScheduleDefinition[];
}

// --- Copilot Contributions ---
export interface CustomAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[];
}

export interface CopilotContributions {
  customAgents?: CustomAgentDefinition[];
}

// --- Policy Contributions ---
export interface PolicyDefinition {
  name: string;
  description: string;
  evaluate: (context: Record<string, unknown>) => { allowed: boolean; reason?: string; requiresApproval?: boolean };
}

// --- Reporter Contributions ---
export interface ReporterDefinition {
  name: string;
  description: string;
  generate: () => Promise<string>;
}

// --- Plugin Interface ---
export interface PluginContributions {
  bot?: BotContributions;
  worker?: WorkerContributions;
  copilot?: CopilotContributions;
  policies?: PolicyDefinition[];
  reporters?: ReporterDefinition[];
}

export interface PluginContext {
  configDir: string;
  pluginConfig: Record<string, unknown>;
  processType: ProcessType;
}

export interface Plugin {
  name: string;
  category: PluginCategory;
  contributions: PluginContributions;
  init?(context: PluginContext): Promise<void>;
  shutdown?(): Promise<void>;
}
