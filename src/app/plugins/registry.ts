import type {
  Plugin,
  PluginCategory,
  ProcessType,
  CommandDefinition,
  MessageRoute,
  WebhookRoute,
  ScheduleDefinition,
  WatcherDefinition,
  PluginContext,
} from "./types.js";

/** Maps plugin categories to the process types they run in */
const PROCESS_CATEGORIES: Record<ProcessType, PluginCategory[]> = {
  bot: ["interactive", "hybrid"],
  worker: ["automation", "hybrid"],
};

export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    console.log(`[PluginRegistry] Registered plugin: ${plugin.name} (${plugin.category})`);
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getPlugins(filter?: { category?: PluginCategory }): Plugin[] {
    const all = Array.from(this.plugins.values());
    if (!filter?.category) return all;
    return all.filter((p) => p.category === filter.category);
  }

  getPluginsForProcess(processType: ProcessType): Plugin[] {
    const categories = PROCESS_CATEGORIES[processType];
    return Array.from(this.plugins.values()).filter((p) => categories.includes(p.category));
  }

  // --- Aggregation helpers ---

  getAllCommands(processType: ProcessType): CommandDefinition[] {
    return this.getPluginsForProcess(processType).flatMap((p) => p.contributions.bot?.commands ?? []);
  }

  getAllMessageRoutes(processType: ProcessType): MessageRoute[] {
    return this.getPluginsForProcess(processType).flatMap((p) => p.contributions.bot?.messageRoutes ?? []);
  }

  getAllWebhooks(processType: ProcessType): WebhookRoute[] {
    return this.getPluginsForProcess(processType).flatMap((p) => p.contributions.worker?.webhooks ?? []);
  }

  getAllSchedules(processType: ProcessType): ScheduleDefinition[] {
    return this.getPluginsForProcess(processType).flatMap((p) => p.contributions.worker?.schedules ?? []);
  }

  getAllWatchers(processType: ProcessType): WatcherDefinition[] {
    return this.getPluginsForProcess(processType).flatMap((p) => p.contributions.worker?.watchers ?? []);
  }

  // --- Lifecycle ---

  async initAll(
    context: Omit<PluginContext, "pluginConfig">,
    pluginConfigs: Record<string, Record<string, unknown>> = {},
  ): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.init) {
        const pluginConfig = pluginConfigs[plugin.name] ?? {};
        console.log(`[PluginRegistry] Initializing plugin: ${plugin.name}`);
        await plugin.init({ ...context, pluginConfig });
      }
    }
    console.log(`[PluginRegistry] All plugins initialized (${this.plugins.size} total)`);
  }

  async shutdownAll(): Promise<void> {
    const plugins = Array.from(this.plugins.values()).reverse();
    for (const plugin of plugins) {
      if (plugin.shutdown) {
        console.log(`[PluginRegistry] Shutting down plugin: ${plugin.name}`);
        try {
          await plugin.shutdown();
        } catch (err) {
          console.error(`[PluginRegistry] Error shutting down plugin "${plugin.name}":`, err);
        }
      }
    }
    console.log(`[PluginRegistry] All plugins shut down`);
  }
}

export const registry = new PluginRegistry();
