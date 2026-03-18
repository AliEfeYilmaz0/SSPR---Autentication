export type AuditLogItem = {
  id: string;
  createdAt: string;
  usernameOrEmail?: string;
  eventType: string;
  status: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type AuditLogResponse = {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
};
