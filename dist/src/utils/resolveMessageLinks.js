import { PermissionFlagsBits } from "discord.js";
// Matches https://discord.com/channels/{guildId}/{channelId}/{messageId}
const MESSAGE_URL_RE = /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g;
/**
 * Scans `content` for Discord message URLs, fetches each referenced message,
 * and returns the original content with a context block prepended.
 *
 * This is a one-time passive fetch — it does NOT subscribe to or monitor the
 * channel. Works for any channel the bot has "Read Messages" + "Read Message
 * History" permissions on, regardless of DISCORD_FREE_CHANNELS.
 *
 * @param requestingUserId - Discord user ID of the person sending the prompt.
 *   When provided, guild channels are permission-checked against this user so
 *   a requester cannot exfiltrate content from channels they cannot see.
 */
export async function resolveMessageLinks(content, client, requestingUserId) {
    const matches = [...content.matchAll(MESSAGE_URL_RE)];
    if (matches.length === 0)
        return content;
    const contextBlocks = [];
    for (const match of matches) {
        const [, , channelId, messageId] = match;
        const url = match[0];
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !("messages" in channel)) {
                contextBlocks.push(`[Could not fetch ${url}: channel not accessible or not a text channel]`);
                continue;
            }
            // Permission check: verify the *requesting user* can view the channel.
            // This prevents the bot's elevated credentials from being used to read
            // content the requester isn't allowed to see.
            if (requestingUserId && "permissionsFor" in channel) {
                const perms = channel.permissionsFor(requestingUserId);
                if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) {
                    contextBlocks.push(`[Could not fetch ${url}: you don't have permission to view that channel]`);
                    continue;
                }
            }
            const msg = await channel.messages.fetch(messageId);
            const date = msg.createdAt.toISOString().split("T")[0];
            const author = msg.author.username;
            const channelName = "name" in channel ? channel.name : channelId;
            const body = msg.content || "(no text content)";
            const quotedBody = body.split("\n").map((line) => `> ${line}`).join("\n");
            const attachmentNote = msg.attachments.size > 0
                ? `\n> [+ ${msg.attachments.size} attachment(s)]`
                : "";
            contextBlocks.push(`[Context from #${channelName} by ${author} (${date})]:\n${quotedBody}${attachmentNote}`);
        }
        catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            contextBlocks.push(`[Could not fetch ${url}: ${reason}]`);
        }
    }
    if (contextBlocks.length === 0)
        return content;
    return `${contextBlocks.join("\n\n")}\n\n---\n\n${content}`;
}
