export interface PolicyContext {
  action: string;
  service?: string;
  severity?: string;
  actor?: string;
  lastActionAt?: Date;
  incidentAge?: number; // ms since incident creation
  metadata?: Record<string, unknown>;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export type PolicyRuleType =
  | "allowlist"
  | "denylist"
  | "cooldown"
  | "rateLimit"
  | "maintenanceWindow";

export interface PolicyRule {
  type: PolicyRuleType;
  name: string;
  description?: string;
  config: Record<string, unknown>;
}

export interface CooldownConfig {
  actionPattern: string; // glob-like pattern for action names
  servicePattern?: string; // glob-like pattern for service names
  cooldownMs: number;
}

export interface RateLimitConfig {
  actionPattern: string;
  maxActions: number;
  windowMs: number;
}

export interface MaintenanceWindowConfig {
  dayOfWeek: number[]; // 0=Sunday, 6=Saturday
  startHour: number; // 0-23, UTC
  endHour: number; // 0-23, UTC
  timezone?: string; // For display only, internally use UTC
  suppressSeverities?: string[]; // severities to suppress during window
}

export interface AllowDenyConfig {
  services: string[]; // service names or '*' for all
  actions: string[]; // action names or '*' for all
}
