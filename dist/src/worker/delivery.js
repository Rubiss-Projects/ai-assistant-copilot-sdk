import * as operatorCommands from "../app/store/operatorCommands.js";
import * as outbox from "../app/store/outbox.js";
import { addTimelineEvent, transitionStatus } from "./incidentEngine.js";
import { logAudit } from "../app/store/audit.js";
export class CommandProcessor {
    timer = null;
    running = false;
    pollIntervalMs;
    escalationChannelId;
    constructor(options = {}) {
        this.pollIntervalMs = options.pollIntervalMs ?? 5000;
        this.escalationChannelId = options.escalationChannelId;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.poll().catch((err) => console.error("[delivery] Poll error:", err));
        this.timer = setInterval(() => {
            this.poll().catch((err) => console.error("[delivery] Poll error:", err));
        }, this.pollIntervalMs);
        console.log(`[delivery] Command processor started (poll every ${this.pollIntervalMs}ms)`);
    }
    stop() {
        if (!this.running)
            return;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log("[delivery] Command processor stopped.");
    }
    async poll() {
        const commands = operatorCommands.claimPending(10);
        for (const cmd of commands) {
            try {
                await this.execute(cmd);
                operatorCommands.markExecuted(cmd.id, JSON.stringify({ success: true }));
                try {
                    logAudit({
                        process: "worker",
                        event_type: "command_executed",
                        actor: cmd.actor,
                        target: cmd.command_type,
                        detail: { commandId: cmd.id, incidentId: cmd.incident_id },
                    });
                }
                catch { /* best-effort */ }
            }
            catch (err) {
                const error = err instanceof Error ? err.message : String(err);
                operatorCommands.markFailed(cmd.id, error);
                try {
                    logAudit({
                        process: "worker",
                        event_type: "command_failed",
                        actor: cmd.actor,
                        target: cmd.command_type,
                        detail: { commandId: cmd.id, error },
                    });
                }
                catch { /* best-effort */ }
            }
        }
    }
    async execute(cmd) {
        if (!cmd.incident_id)
            throw new Error("Command has no incident_id");
        switch (cmd.command_type) {
            case "ack":
                transitionStatus(cmd.incident_id, "acknowledged", cmd.actor);
                break;
            case "note":
                addTimelineEvent(cmd.incident_id, {
                    event_type: "note",
                    actor: cmd.actor,
                    content: cmd.payload?.text,
                });
                break;
            case "escalate": {
                if (this.escalationChannelId) {
                    outbox.insertOutboxMessage({
                        channel_id: this.escalationChannelId,
                        message_type: "alert",
                        payload: {
                            content: null,
                            embeds: [
                                {
                                    title: "🔺 Escalation",
                                    description: `Incident ${cmd.incident_id} escalated by ${cmd.actor}`,
                                    color: 0xff0000,
                                    fields: cmd.payload?.reason
                                        ? [{ name: "Reason", value: String(cmd.payload.reason) }]
                                        : [],
                                    timestamp: new Date().toISOString(),
                                },
                            ],
                        },
                    });
                }
                addTimelineEvent(cmd.incident_id, {
                    event_type: "escalated",
                    actor: cmd.actor,
                    content: cmd.payload?.reason,
                });
                break;
            }
            case "action":
                addTimelineEvent(cmd.incident_id, {
                    event_type: "action_requested",
                    actor: cmd.actor,
                    content: JSON.stringify(cmd.payload),
                });
                break;
            default:
                throw new Error(`Unknown command type: ${cmd.command_type}`);
        }
    }
}
