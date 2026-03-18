import { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/PageLayout";
import StatusBadge from "../components/StatusBadge";
import MetadataPreview from "../components/MetadataPreview";
import EmptyState from "../components/EmptyState";
import { api } from "../services/api";
import { AuditLogItem, AuditLogResponse } from "../types/audit";
import { mapApiError } from "../utils/errorMapper";
import { useI18n } from "../i18n/I18nContext";

const EVENT_TYPES = [
  "reset_requested",
  "user_found",
  "user_not_found",
  "push_challenge_created",
  "push_approved",
  "push_denied",
  "push_timed_out",
  "email_otp_sent",
  "email_otp_verified",
  "email_otp_failed",
  "email_otp_expired",
  "otp_resent",
  "reset_token_issued",
  "reset_token_invalid",
  "reset_token_expired",
  "password_policy_failed",
  "password_changed",
  "password_change_failed",
  "reset_flow_completed",
  "duplicate_action",
  "reset_flow_failed",
  "too_many_attempts",
];

const STATUS_OPTIONS = ["PENDING", "FOUND", "NOT_FOUND", "EXPIRED", "APPROVED", "DENIED", "VERIFIED", "COMPLETED", "FAILED"];

const AuditLogPage = () => {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [eventType, setEventType] = useState("");
  const [status, setStatus] = useState("");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    const response = await api.getAuditLogs({
      page,
      limit,
      eventType: eventType || undefined,
      status: status || undefined,
      usernameOrEmail: usernameOrEmail || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    setLoading(false);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    const data = response.data as AuditLogResponse;
    setItems(data.items);
    setTotal(data.total);
  };

  useEffect(() => {
    fetchLogs();
  }, [page, limit]);

  const handleApplyFilters = () => {
    setPage(1);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setEventType("");
    setStatus("");
    setUsernameOrEmail("");
    setFrom("");
    setTo("");
    setPage(1);
    fetchLogs();
  };

  return (
    <PageLayout
      title={t("title.audit")}
      subtitle={t("subtitle.audit")}
    >
      <section className="card">
        <h3 style={{ marginBottom: 12 }}>{t("card.audit_filters")}</h3>
        <div className="grid two">
          <div className="field">
            <label>{t("label.event_type")}</label>
            <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
              <option value="">{t("label.all_events")}</option>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`event.${type}`, type)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("label.status")}</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t("label.all_statuses")}</option>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`status.${value}`, value)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("label.user_search")}</label>
            <input
              value={usernameOrEmail}
              onChange={(event) => setUsernameOrEmail(event.target.value)}
              placeholder="alice@example.com"
            />
          </div>
          <div className="field">
            <label>{t("label.from")}</label>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="field">
            <label>{t("label.to")}</label>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="field">
            <label>{t("label.limit")}</label>
            <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              {[10, 20, 30, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex" style={{ marginTop: 16 }}>
          <button onClick={handleApplyFilters}>{t("btn.apply_filters")}</button>
          <button className="button-ghost" onClick={handleClearFilters}>
            {t("btn.clear")}
          </button>
        </div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3>{t("card.audit_events")}</h3>
          <StatusBadge tone="info">{total} {t("audit.total")}</StatusBadge>
        </div>

        {loading && <div className="muted">{t("msg.loading_audit")}</div>}
        {error && <div className="error">{error}</div>}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title={t("msg.audit_empty_title")}
            message={t("msg.audit_empty")}
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="list">
            {items.map((item) => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div className="flex-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{t(`event.${item.eventType}`, item.eventType)}</div>
                    <div className="small">
                      {new Date(item.createdAt).toLocaleString()} · {item.usernameOrEmail ?? t("common.unknown")}
                    </div>
                  </div>
                  <StatusBadge
                    tone={
                      item.status === "COMPLETED" || item.status === "APPROVED"
                        ? "success"
                        : item.status === "DENIED" || item.status === "FAILED"
                        ? "danger"
                        : item.status === "EXPIRED"
                        ? "warning"
                        : "info"
                    }
                  >
                    {t(`status.${item.status}`, item.status)}
                  </StatusBadge>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  {locale === "en" ? item.message : t(`event.${item.eventType}`, item.message)}
                </div>
                <div style={{ marginTop: 12 }}>
                  <MetadataPreview metadata={item.metadata} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-between" style={{ marginTop: 16 }}>
          <span className="small">
            {t("msg.page_of").replace("{page}", String(page)).replace("{total}", String(totalPages))}
          </span>
          <div className="flex">
            <button
              className="button-ghost"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("btn.previous")}
            </button>
            <button
              className="button-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              {t("btn.next")}
            </button>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default AuditLogPage;
