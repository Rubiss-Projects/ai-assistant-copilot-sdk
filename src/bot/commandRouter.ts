import type { ChatInputCommandInteraction, Client } from "discord.js";
import type { SessionManager } from "../app/copilot/interactiveSessions.js";

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
      await handler(interaction, context);
    } else {
      console.warn(`Unknown command: ${interaction.commandName}`);
    }
  }
}
