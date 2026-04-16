import * as approvals from "../app/store/approvals.js";
import * as outbox from "../app/store/outbox.js";
import { addTimelineEvent } from "./incidentEngine.js";
import { logAudit } from "../app/store/audit.js";

export class ApprovalProcessor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private pendingActions: Map<
    number,
    { incidentId: string; action: string; onApproved: () => Promise<void> }
  > = new Map();

  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      this.checkDecisions().catch((err) =>
        console.error("[approvals] Check error:", err),
      );
    }, 5000);
    console.log("[approvals] Approval processor started.");
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.pendingActions.clear();
    console.log("[approvals] Approval processor stopped.");
  }

  requestApproval(params: {
    incidentId: string;
    actionName: string;
    onApproved: () => Promise<void>;
    alertChannelId: string;
  }): number {
    const approvalId = approvals.requestApproval({
      incident_id: params.incidentId,
      action_name: params.actionName,
      requested_by: "worker",
    });

    this.pendingActions.set(approvalId, {
      incidentId: params.incidentId,
      action: params.actionName,
      onApproved: params.onApproved,
    });

    outbox.insertOutboxMessage({
      channel_id: params.alertChannelId,
      message_type: "approval_request",
      payload: {
        content: null,
        embeds: [
          {
            title: "🔒 Approval Required",
            description: `Action \`${params.actionName}\` requires approval for incident ${params.incidentId}`,
            color: 0xffa500,
            timestamp: new Date().toISOString(),
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: "Approve",
                custom_id: `approve:${approvalId}`,
                emoji: { name: "✅" },
              },
              {
                type: 2,
                style: 4,
                label: "Deny",
                custom_id: `deny:${approvalId}`,
                emoji: { name: "❌" },
              },
            ],
          },
        ],
        metadata: { approvalId, incidentId: params.incidentId },
      },
    });

    addTimelineEvent(params.incidentId, {
      event_type: "approval_requested",
      actor: "worker",
      content: `Approval requested for action: ${params.actionName}`,
    });

    return approvalId;
  }

  private async checkDecisions(): Promise<void> {
    for (const [approvalId, pending] of this.pendingActions) {
      const decision = approvals.getDecision(approvalId);
      if (!decision?.decision) continue; // Still pending

      this.pendingActions.delete(approvalId);

      if (decision.decision === "approved") {
        try {
          await pending.onApproved();
          addTimelineEvent(pending.incidentId, {
            event_type: "action_approved_executed",
            actor: decision.decided_by ?? "unknown",
            content: `Action ${pending.action} approved and executed`,
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          addTimelineEvent(pending.incidentId, {
            event_type: "action_failed",
            actor: "worker",
            content: `Action ${pending.action} failed after approval: ${error}`,
          });
        }
      } else {
        addTimelineEvent(pending.incidentId, {
          event_type: "action_denied",
          actor: decision.decided_by ?? "unknown",
          content: `Action ${pending.action} denied: ${decision.reason ?? "no reason"}`,
        });
      }

      try {
        logAudit({
          process: "worker",
          event_type: "approval_decided",
          target: pending.action,
          detail: {
            approvalId,
            decision: decision.decision,
            decidedBy: decision.decided_by,
          },
        });
      } catch { /* best-effort */ }
    }
  }
}
