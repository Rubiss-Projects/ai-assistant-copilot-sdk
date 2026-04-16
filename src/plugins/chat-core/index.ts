import type { Plugin } from "../../app/plugins/types.js";

/**
 * chat-core plugin — provides all interactive Discord chat functionality.
 *
 * This is the default plugin that ships enabled. It contributes:
 * - All slash commands (/ask, /chat, /reset, /model, /status, etc.)
 * - Message routes (mention handling, free channels, bot-owned threads)
 *
 * Commands and routes will be wired up when the existing handlers are
 * migrated into the plugin model (Phase 3 tasks: move-commands, move-handlers).
 */
export const chatCorePlugin: Plugin = {
  name: "chat-core",
  category: "interactive",
  contributions: {
    bot: {
      // Commands will be populated when handlers are migrated from src/handlers/slash/
      commands: [],
      // Message routes will be populated when mention handler is migrated
      messageRoutes: [],
    },
  },

  async init(context) {
    console.log(`[chat-core] Initialized (process: ${context.processType})`);
  },

  async shutdown() {
    console.log("[chat-core] Shut down.");
  },
};
