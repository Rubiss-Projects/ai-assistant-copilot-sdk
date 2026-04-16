import type { Message, Client, ButtonInteraction } from "discord.js";
import { insertCommand } from "../app/store/operatorCommands.js";
import { findByThreadId } from "../app/store/incidents.js";
import * as approvals from "../app/store/approvals.js";

/**
 * Check if a message is in an incident thread (not from the bot).
 */
export function isIncidentThread(message: Message, client: Client): boolean {
  if (!message.channel.isThread()) return false;
  if (message.author.id === client.user?.id) return false;
  const incident = findByThreadId(message.channelId);
  return incident !== null;
}

/**
 * Look up the incident id for a thread.
 */
export function getIncidentForThread(threadId: string): string | null {
  const incident = findByThreadId(threadId);
  return incident?.id ?? null;
}

/**
 * Parse a user message into a command descriptor.
 */
export function parseCommand(
  content: string,
): { type: string; payload?: Record<string, unknown> } | null {
  const lower = content.toLowerCase().trim();

  if (lower === "ack" || lower === "acknowledge") return { type: "ack" };
  if (lower.startsWith("note ") || lower.startsWith("note:"))
    return { type: "note", payload: { text: content.slice(5).trim() } };
  if (lower.startsWith("escalate"))
    return {
      type: "escalate",
      payload: { reason: content.slice(9).trim() || undefined },
    };
  if (lower.startsWith("action "))
    return { type: "action", payload: { action: content.slice(7).trim() } };

  // Default: treat as a note
  return { type: "note", payload: { text: content } };
}

/**
 * Handle a message posted inside an incident thread.
 */
export async function handleIncidentMessage(
  message: Message,
  incidentId: string,
): Promise<void> {
  const parsed = parseCommand(message.content);
  if (!parsed) return;

  const actor = `user:${message.author.id}`;
  insertCommand({
    incident_id: incidentId,
    command_type: parsed.type,
    actor,
    payload: parsed.payload,
  });

  const emoji =
    parsed.type === "ack"
      ? "✅"
      : parsed.type === "escalate"
        ? "🔺"
        : parsed.type === "action"
          ? "⚡"
          : "📝";

  await message.reply(`${emoji} Command \`${parsed.type}\` queued for worker`);
}

/**
 * Handle approval button interactions.
 */
export async function handleApprovalButton(
  interaction: ButtonInteraction,
): Promise<void> {
  const [action, approvalIdStr] = interaction.customId.split(":");
  const approvalId = parseInt(approvalIdStr, 10);
  if (isNaN(approvalId)) return;

  const decision = action === "approve" ? "approved" : "denied";
  approvals.decide(approvalId, {
    decided_by: `user:${interaction.user.id}`,
    decision: decision as "approved" | "denied",
  });

  await interaction.update({
    content: `${decision === "approved" ? "✅" : "❌"} ${decision} by <@${interaction.user.id}>`,
    components: [],
  });
}
