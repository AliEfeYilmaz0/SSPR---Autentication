import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import StatusBadge from "../components/StatusBadge";
import { api, StatusPayload } from "../services/api";
import useInterval from "../hooks/useInterval";
import { formatTimeRemaining, parseDate, toLocaleTime } from "../utils/time";
import { mapApiError } from "../utils/errorMapper";
import { getResetToken } from "../utils/tokenStore";
import { clearActiveFlow, getActiveFlow, setActiveFlow } from "../utils/flowStore";
import { useI18n } from "../i18n/I18nContext";

const VERIFY_POLL_MS = 3000;

const VerifyPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const resetRequestParam = params.get("rid") || "";

  const [resetRequestId, setResetRequestId] = useState(
    resetRequestParam || getActiveFlow()?.resetRequestId || ""
  );
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");

  const pushExpiresAt = useMemo(() => parseDate(status?.pushExpiresAt), [status?.pushExpiresAt]);
  const authFlowExpiresAt = useMemo(() => parseDate(status?.authFlowExpiresAt), [status?.authFlowExpiresAt]);
  const countdown = formatTimeRemaining(pushExpiresAt);
  const authCountdown = formatTimeRemaining(authFlowExpiresAt);
  const flowExpired = Boolean(status?.failureReason === "AUTH_TIMEOUT");

  const fetchStatus = async () => {
    if (!resetRequestId) return;
    setLoadingStatus(true);
    const response = await api.getStatus(resetRequestId);
    setLoadingStatus(false);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    setStatus(response.data);
  };

  useInterval(fetchStatus, resetRequestId ? VERIFY_POLL_MS : null);

  useEffect(() => {
    if (!resetRequestId) return;
    setActiveFlow(resetRequestId);
    fetchStatus();
  }, [resetRequestId]);

  useEffect(() => {
    if (!resetRequestId) {
      const active = getActiveFlow();
      if (active?.resetRequestId) {
        setResetRequestId(active.resetRequestId);
      }
    }
  }, [resetRequestId]);

  useEffect(() => {
    if (!status) return;

    if (status.nextStep === "OTP_REQUIRED") {
      navigate(`/otp?rid=${resetRequestId}`);
    }

    if (status.nextStep === "RESET_ALLOWED") {
      const token = getResetToken(resetRequestId);
      if (token) {
        navigate(`/reset?rid=${resetRequestId}`);
      } else {
        setError(t("msg.reset_token_missing"));
      }
    }

    if (status.nextStep === "COMPLETED") {
      clearActiveFlow();
      navigate("/success");
    }

    if (status.nextStep === "DENIED") {
      clearActiveFlow();
    }

    if (status.failureReason === "AUTH_TIMEOUT") {
      clearActiveFlow();
      setError(t("msg.timeout_auth"));
      setTimeout(() => navigate("/"), 2000);
    }
  }, [status, navigate, resetRequestId]);

  const handleManual = () => {
    if (!manualId.trim()) return;
    setActiveFlow(manualId.trim());
    setResetRequestId(manualId.trim());
  };

  const stepTone = () => {
    switch (status?.nextStep) {
      case "WAITING_APPROVAL":
        return "warning";
      case "APPROVED":
      case "RESET_ALLOWED":
        return "success";
      case "DENIED":
        return "danger";
      case "OTP_REQUIRED":
        return "info";
      default:
        return "info";
    }
  };

  return (
    <PageLayout
      title={t("title.identity")}
      subtitle={t("subtitle.identity")}
    >
      <div className="grid two">
        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t("card.verification_status")}</h3>
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <StatusBadge tone={stepTone()}>
              {status?.nextStep ? t(`step.${status.nextStep}`, status.nextStep) : t("common.pending")}
            </StatusBadge>
            <span className="small">
              {t("msg.request_id")} {resetRequestId || t("common.pending")}
            </span>
          </div>

          {!resetRequestId && (
            <div className="notice" style={{ marginBottom: 12 }}>
              {t("msg.locating_request")}
            </div>
          )}

          {resetRequestId && status?.nextStep === "WAITING_APPROVAL" && (
            <div className="status-grid">
              <div className="card" style={{ padding: 16 }}>
                <div className="small">{t("hint.push_expires")}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>
                  {pushExpiresAt ? countdown : "--:--"}
                </div>
                <div className="small">
                  {t("hint.expiry_time")}: {pushExpiresAt ? toLocaleTime(pushExpiresAt) : t("common.pending")}
                </div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div className="small">{t("hint.next_step")}</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{t("hint.approve_in_panel")}</div>
                <div className="muted" style={{ marginTop: 8 }}>
                  {t("hint.auto_fallback")}
                </div>
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div className="small">{t("hint.auth_window")}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {authFlowExpiresAt ? authCountdown : "--:--"}
                </div>
                <div className="small">
                  {t("hint.session_ends")}: {authFlowExpiresAt ? toLocaleTime(authFlowExpiresAt) : t("common.pending")}
                </div>
              </div>
            </div>
          )}

          {status?.nextStep === "DENIED" && (
            <div className="notice" style={{ marginTop: 12 }}>
              {t("msg.push_denied")}
            </div>
          )}

          {flowExpired && (
            <div className="notice" style={{ marginTop: 12 }}>
              {t("msg.timeout_auth")}
            </div>
          )}

          {status?.nextStep === "APPROVED" && (
            <div className="notice" style={{ marginTop: 12 }}>
              {t("msg.push_approved")}
            </div>
          )}

          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          {loadingStatus && <div className="muted">{t("msg.refreshing_status")}</div>}
        </section>

        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t("card.manual_lookup")}</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            {t("msg.manual_lookup_help")}
          </p>
          <div className="field">
            <label>{t("label.reset_request_id")}</label>
            <input value={manualId} onChange={(event) => setManualId(event.target.value)} />
          </div>
          <div className="flex" style={{ marginTop: 12 }}>
            <button onClick={handleManual}>{t("btn.use_request_id")}</button>
            <button className="button-ghost" onClick={() => navigate("/authenticator")}>{t("btn.open_authenticator")}</button>
          </div>
          <div className="muted" style={{ marginTop: 16 }}>
            {t("msg.authenticator_hint")}
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default VerifyPage;
