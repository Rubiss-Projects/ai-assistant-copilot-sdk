import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChatInputCommandInteraction,
} from "discord.js";
import type { SessionManager } from "../app/copilot/interactiveSessions.js";
import { CommandRouter, type CommandContext } from "./commandRouter.js";

// Import handlers from canonical plugin locations
import { handleAsk } from "../plugins/chat-core/handlers/ask.js";
import { handleChat } from "../plugins/chat-core/handlers/chat.js";
import { handleReset } from "../plugins/chat-core/handlers/reset.js";
import { handleServers } from "../plugins/chat-core/handlers/servers.js";
import { handleLeave } from "../plugins/chat-core/handlers/leave.js";
import { handleModel } from "../plugins/chat-core/handlers/model.js";
import { handleStatus } from "../plugins/chat-core/handlers/status.js";
import { handleHistory } from "../plugins/chat-core/handlers/history.js";
import { handleAgent } from "../plugins/chat-core/handlers/agent.js";
import { handleMode } from "../plugins/chat-core/handlers/mode.js";
import { handleCompact } from "../plugins/chat-core/handlers/compact.js";
import { handleFleet } from "../plugins/chat-core/handlers/fleet.js";
import { handlePlan } from "../plugins/chat-core/handlers/plan.js";
import { handleWorkspace } from "../plugins/chat-core/handlers/workspace.js";
import { handleMcp } from "../plugins/chat-core/handlers/mcp.js";
import { handleMention } from "../plugins/chat-core/handlers/mention.js";

function registerChatCoreCommands(router: CommandRouter): void {
  // Commands that need sessions
  router.register("ask", (cmd, ctx) => handleAsk(cmd, ctx.sessions));
  router.register("chat", (cmd, ctx) => handleChat(cmd, ctx.sessions));
  router.register("reset", (cmd, ctx) => handleReset(cmd, ctx.sessions));
  router.register("model", (cmd, ctx) => handleModel(cmd, ctx.sessions));
  router.register("status", (cmd, ctx) => handleStatus(cmd, ctx.sessions));
  router.register("history", (cmd, ctx) => handleHistory(cmd, ctx.sessions));
  router.register("agent", (cmd, ctx) => handleAgent(cmd, ctx.sessions));
  router.register("mode", (cmd, ctx) => handleMode(cmd, ctx.sessions));
  router.register("compact", (cmd, ctx) => handleCompact(cmd, ctx.sessions));
  router.register("fleet", (cmd, ctx) => handleFleet(cmd, ctx.sessions));
  router.register("plan", (cmd, ctx) => handlePlan(cmd, ctx.sessions));
  router.register("workspace", (cmd, ctx) => handleWorkspace(cmd, ctx.sessions));
  router.register("mcp", (cmd, ctx) => handleMcp(cmd, ctx.sessions));
  // Commands that need client
  router.register("servers", (cmd, ctx) => handleServers(cmd, ctx.client));
  router.register("leave", (cmd, ctx) => handleLeave(cmd, ctx.client));
}

export function createBot(sessions: SessionManager): Client {
  const allowedUsers = new Set(
    (process.env.DISCORD_ALLOWED_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const isAllowed = (userId: string): boolean =>
    allowedUsers.size === 0 || allowedUsers.has(userId);

  const freeChannels = new Set(
    (process.env.DISCORD_FREE_CHANNELS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  );

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  // Set up command routing
  const router = new CommandRouter();
  registerChatCoreCommands(router);
  const context: CommandContext = { sessions, client };

  client.once(Events.ClientReady, (c) => {
    console.log(`✅ Discord bot ready as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (!isAllowed(interaction.user.id)) {
      await interaction.reply({ content: "⛔ You are not authorized to use this bot.", ephemeral: true });
      return;
    }
    await router.dispatch(interaction as ChatInputCommandInteraction, context);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!client.user) return;
    if (!isAllowed(message.author.id)) return;

    // Bot-owned threads: respond to every message, session keyed by thread ID
    if (message.channel.isThread() && message.channel.ownerId === client.user.id) {
      await handleMention(message, client, sessions, message.channelId);
      return;
    }

    const isMentioned = message.mentions.has(client.user.id);
    const isFreeChannel = freeChannels.has(message.channelId);

    if (!isMentioned && !isFreeChannel) return;

    await handleMention(message, client, sessions);
  });

  return client;
}
