import { chunkForDiscord } from "../../copilot.js";
export async function handleWorkspace(interaction, sessions) {
    const sub = interaction.options.getSubcommand(true);
    const sessionKey = interaction.channel?.isThread()
        ? interaction.channelId
        : interaction.user.id;
    const path = interaction.options.getString("path") ?? "";
    try {
        await interaction.deferReply({ ephemeral: true });
        if (sub === "list") {
            const files = await sessions.listWorkspaceFiles(sessionKey);
            if (files.length === 0) {
                await interaction.editReply("📁 Workspace is empty.");
            }
            else {
                const list = files.map((f, i) => `${i + 1}. \`${f}\``).join("\n");
                const chunks = chunkForDiscord(`📁 **Workspace files:**\n${list}`);
                await interaction.editReply(chunks[0]);
                for (const chunk of chunks.slice(1)) {
                    await interaction.followUp({ ephemeral: true, content: chunk });
                }
            }
        }
        else if (sub === "read") {
            const content = await sessions.readWorkspaceFile(sessionKey, path);
            const chunks = chunkForDiscord(`📄 **\`${path}\`:**\n\`\`\`\n${content}\n\`\`\``);
            await interaction.editReply(chunks[0]);
            for (const chunk of chunks.slice(1)) {
                await interaction.followUp({ ephemeral: true, content: chunk });
            }
        }
        else if (sub === "create") {
            const content = interaction.options.getString("content", true);
            await sessions.createWorkspaceFile(sessionKey, path, content);
            await interaction.editReply(`✅ Created \`${path}\` in workspace.`);
        }
    }
    catch (err) {
        console.error(`[/workspace ${sub}] Error:`, err);
        const msg = sub === "list" ? "❌ Failed to list workspace files." :
            sub === "read" ? `❌ Failed to read \`${path}\` from workspace.` :
                `❌ Failed to create \`${path}\` in workspace.`;
        if (interaction.deferred)
            await interaction.editReply(msg).catch(() => { });
        else
            await interaction.reply({ content: msg, ephemeral: true }).catch(() => { });
    }
}
