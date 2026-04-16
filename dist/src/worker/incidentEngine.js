import { randomUUID } from "node:crypto";
import { getDb } from "../app/store/db.js";
import { createIncident, findBySourceId, updateStatus, } from "../app/store/incidents.js";
import { insertOutboxMessage } from "../app/store/outbox.js";
import { logAudit } from "../app/store/audit.js";
/* ------------------------------------------------------------------ */
/*  State-machine transitions                                          */
/* ------------------------------------------------------------------ */
const VALID_TRANSITIONS = {
    open: ["acknowledged", "investigating", "resolved", "closed"],
    acknowledged: ["investigating", "resolved", "closed"],
    investigating: ["resolved", "closed"],
    resolved: ["closed", "open"],
    closed: ["open"],
};
/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function severityColor(severity) {
    if (severity === "critical")
        return 0xff0000;
    if (severity === "warning")
        return 0xffa500;
    return 0x3498db;
}
function buildAlertPayload(alert) {
    return {
        content: null,
        embeds: [
            {
                title: `🚨 ${alert.title}`,
                color: severityColor(alert.severity),
                fields: [
                    { name: "Service", value: alert.service_name ?? "Unknown", inline: true },
                    { name: "Source", value: alert.source, inline: true },
                    { name: "Severity", value: alert.severity ?? "warning", inline: true },
                ],
                timestamp: new Date().toISOString(),
            },
        ],
        metadata: { source: alert.source, source_id: alert.source_id },
    };
}
function buildResolvedPayload(incident) {
    return {
        content: `✅ Incident **${incident.title}** has been resolved.`,
        metadata: { incident_id: incident.id },
    };
}
/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */
export function processAlert(alert, config) {
    // Dedupe by source_id
    if (alert.source_id) {
        const existing = findBySourceId(alert.source, alert.source_id);
        if (existing) {
            const isOpen = !["resolved", "closed"].includes(existing.status);
            // Source says resolved → resolve the incident
            if (alert.status === "resolved") {
                if (isOpen) {
                    transitionStatus(existing.id, "resolved", `source:${alert.source}`);
                }
                insertOutboxMessage({
                    channel_id: config.alertChannelId,
                    thread_id: existing.thread_id ?? undefined,
                    message_type: "update",
                    payload: buildResolvedPayload(existing),
                });
                return { incidentId: existing.id, created: false };
            }
            // Still firing — merge metadata and add timeline event
            if (isOpen) {
                if (alert.metadata) {
                    const merged = { ...existing.metadata, ...alert.metadata };
                    const db = getDb();
                    db.prepare("UPDATE incidents SET metadata = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(merged), new Date().toISOString(), existing.id);
                }
                addTimelineEvent(existing.id, {
                    event_type: "updated",
                    actor: `source:${alert.source}`,
                    content: `Alert updated: ${alert.title}`,
                });
                insertOutboxMessage({
                    channel_id: config.alertChannelId,
                    thread_id: existing.thread_id ?? undefined,
                    message_type: "update",
                    payload: {
                        content: `🔄 Alert updated: **${alert.title}**`,
                        metadata: { incident_id: existing.id },
                    },
                });
            }
            return { incidentId: existing.id, created: false };
        }
    }
    // No existing incident — create new
    const id = randomUUID();
    createIncident({
        id,
        source: alert.source,
        source_id: alert.source_id,
        service_name: alert.service_name,
        title: alert.title,
        severity: alert.severity ?? "warning",
        metadata: alert.metadata,
    });
    addTimelineEvent(id, {
        event_type: "created",
        actor: `source:${alert.source}`,
        content: `Incident created from ${alert.source} alert`,
    });
    const payload = buildAlertPayload(alert);
    insertOutboxMessage({
        channel_id: config.alertChannelId,
        message_type: "alert",
        payload: { ...payload, metadata: { ...payload.metadata, incident_id: id } },
    });
    try {
        logAudit({
            process: "worker",
            event_type: "incident_created",
            actor: `source:${alert.source}`,
            target: id,
            detail: { title: alert.title, severity: alert.severity },
        });
    }
    catch { /* best-effort */ }
    return { incidentId: id, created: true };
}
export function addTimelineEvent(incidentId, event) {
    const db = getDb();
    db.prepare("INSERT INTO incident_events (incident_id, event_type, actor, content) VALUES (?, ?, ?, ?)").run(incidentId, event.event_type, event.actor ?? null, event.content ?? null);
}
export function getTimeline(incidentId) {
    const db = getDb();
    return db
        .prepare("SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC")
        .all(incidentId);
}
export function transitionStatus(incidentId, newStatus, actor) {
    const db = getDb();
    const row = db
        .prepare("SELECT status FROM incidents WHERE id = ?")
        .get(incidentId);
    if (!row)
        throw new Error(`Incident ${incidentId} not found`);
    const allowed = VALID_TRANSITIONS[row.status];
    if (!allowed || !allowed.includes(newStatus)) {
        throw new Error(`Invalid transition: ${row.status} → ${newStatus} (allowed: ${allowed?.join(", ") ?? "none"})`);
    }
    updateStatus(incidentId, newStatus);
    addTimelineEvent(incidentId, {
        event_type: `status_${newStatus}`,
        actor,
        content: `Status changed from ${row.status} to ${newStatus}`,
    });
    if (newStatus === "resolved" || newStatus === "closed") {
        const incident = db
            .prepare("SELECT * FROM incidents WHERE id = ?")
            .get(incidentId);
        if (incident?.thread_id) {
            insertOutboxMessage({
                channel_id: incident.thread_id,
                message_type: "update",
                payload: {
                    content: `✅ Incident **${incident.title}** status → **${newStatus}**`,
                    metadata: { incident_id: incidentId },
                },
            });
        }
    }
    try {
        logAudit({
            process: "worker",
            event_type: "incident_transition",
            actor,
            target: incidentId,
            detail: { from: row.status, to: newStatus },
        });
    }
    catch { /* best-effort */ }
}
