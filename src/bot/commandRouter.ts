import type { ChatInputCommandInteraction, Client } from "discord.js";
import type { SessionManager } from "../app/copilot/interactiveSessions.js";
import { logAudit } from "../app/store/audit.js";

export type CommandHandler = (
  interaction: ChatInputCommandInteraction,
  context: CommandContext
) => Promise<void>;

export interface CommandContext {
  sessions: SessionManager;
  client: Client;
}

export class CommandRouter {
  private handlers = new Map<string, CommandHandler>();

  register(name: string, handler: CommandHandler): void {
    this.handlers.set(name, handler);
  }

  async dispatch(interaction: ChatInputCommandInteraction, context: CommandContext): Promise<void> {
    const handler = this.handlers.get(interaction.commandName);
    if (handler) {
      try {
        await handler(interaction, context);
        try { logAudit({ process: "bot", event_type: "command", actor: `user:${interaction.user.id}`, target: interaction.commandName }); } catch { /* audit is best-effort */ }
      } catch (err) {
        try { logAudit({ process: "bot", event_type: "command_error", actor: `user:${interaction.user.id}`, target: interaction.commandName, detail: { error: err instanceof Error ? err.message : String(err) } }); } catch { /* audit is best-effort */ }
        throw err;
      }
    } else {
      console.warn(`Unknown command: ${interaction.commandName}`);
    }
  }
}
