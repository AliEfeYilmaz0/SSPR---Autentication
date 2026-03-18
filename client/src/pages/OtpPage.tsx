import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import StatusBadge from "../components/StatusBadge";
import { api, StatusPayload } from "../services/api";
import useInterval from "../hooks/useInterval";
import { formatTimeRemaining, parseDate, toLocaleTime } from "../utils/time";
import { saveResetToken } from "../utils/tokenStore";
import { mapApiError } from "../utils/errorMapper";
import { clearActiveFlow, setActiveFlow } from "../utils/flowStore";
import { useI18n } from "../i18n/I18nContext";

const OTP_POLL_MS = 5000;

const OtpPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const resetRequestId = params.get("rid") || "";

  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [otpPreview, setOtpPreview] = useState<string | null>(null);

  const otpExpiresAt = useMemo(() => parseDate(status?.otpExpiresAt), [status?.otpExpiresAt]);
  const resendAvailableAt = useMemo(
    () => parseDate(status?.resendAvailableAt),
    [status?.resendAvailableAt]
  );

  const countdown = formatTimeRemaining(otpExpiresAt);
  const resendCountdown = formatTimeRemaining(resendAvailableAt);
  const isExpired = otpExpiresAt ? otpExpiresAt.getTime() <= Date.now() : false;
  const isTerminal = status?.nextStep === "DENIED" || status?.nextStep === "COMPLETED";
  const flowExpired = status?.failureReason === "AUTH_TIMEOUT";

  const fetchStatus = async () => {
    if (!resetRequestId) return;
    const response = await api.getStatus(resetRequestId);
    if (response.success) {
      setStatus(response.data);
    }
  };

  useInterval(fetchStatus, resetRequestId ? OTP_POLL_MS : null);

  useEffect(() => {
    fetchStatus();
    if (resetRequestId) {
      setActiveFlow(resetRequestId);
    }
  }, [resetRequestId]);

  useEffect(() => {
    if (!status) return;
    if (status.nextStep === "RESET_ALLOWED") {
      navigate(`/reset?rid=${resetRequestId}`);
    }
    if (status.nextStep === "COMPLETED") {
      clearActiveFlow();
      navigate("/success");
    }
    if (status.nextStep === "DENIED") {
      clearActiveFlow();
      setError(t("msg.push_denied"));
    }
    if (status.failureReason === "AUTH_TIMEOUT") {
      clearActiveFlow();
      setError(t("msg.timeout_auth"));
      setTimeout(() => navigate("/"), 2000);
    }
  }, [status, navigate, resetRequestId]);

  const handleVerify = async () => {
    setError(null);
    setInfo(null);
    if (!otp.trim()) {
      setError(t("msg.enter_otp"));
      return;
    }

    setLoading(true);
    const response = await api.verifyOtp(resetRequestId, otp.trim());
    setLoading(false);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    const token = response.data.resetToken;
    if (token) {
      saveResetToken(resetRequestId, token);
    }
    setInfo(t("msg.otp_verified"));
    navigate(`/reset?rid=${resetRequestId}`);
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    setResending(true);
    const response = await api.resendOtp(resetRequestId);
    setResending(false);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    if (response.data.otpPreview) {
      setOtpPreview(response.data.otpPreview);
    }
    setInfo(t("msg.otp_resent"));
    fetchStatus();
  };

  if (!resetRequestId) {
    return (
      <PageLayout title={t("title.otp")}>
        <div className="card">
          <div className="error">{t("msg.missing_request")}</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t("title.otp")}
      subtitle={t("subtitle.otp")}
    >
      <div className="grid two">
        <section className="card">
          <div className="flex-between" style={{ marginBottom: 12 }}>
            <h3>{t("card.verify_otp")}</h3>
            <StatusBadge tone="info">{t("step.OTP_REQUIRED")}</StatusBadge>
          </div>
          <div className="field">
            <label>{t("label.otp")}</label>
            <input value={otp} onChange={(event) => setOtp(event.target.value)} maxLength={6} />
          </div>
          {otpPreview && (
            <div className="notice" style={{ marginTop: 12 }}>
              {t("msg.dev_otp")} <strong>{otpPreview}</strong>
            </div>
          )}
          {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
          {isExpired && (
            <div className="notice" style={{ marginTop: 12 }}>
              {t("msg.otp_expired")}
            </div>
          )}
          {flowExpired && (
            <div className="notice" style={{ marginTop: 12 }}>
              {t("msg.timeout_auth")}
            </div>
          )}
          {info && <div className="notice" style={{ marginTop: 12 }}>{info}</div>}
          <div className="flex" style={{ marginTop: 16 }}>
            <button onClick={handleVerify} disabled={loading || isTerminal}>
              {loading ? t("btn.verifying") : t("btn.verify_otp")}
            </button>
            <button
              className="button-ghost"
              onClick={handleResend}
              disabled={
                resending ||
                isTerminal ||
                (resendAvailableAt ? resendAvailableAt.getTime() > Date.now() : false)
              }
            >
              {resending
                ? t("btn.resending")
                : resendAvailableAt && resendAvailableAt.getTime() > Date.now()
                ? t("msg.resend_in").replace("{time}", resendCountdown)
                : t("btn.resend_otp")}
            </button>
          </div>
        </section>

        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t("card.otp_window")}</h3>
          <div className="status-grid">
            <div className="card" style={{ padding: 16 }}>
              <div className="small">{t("hint.time_remaining")}</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{countdown}</div>
              <div className="small">
                {t("hint.expiry_time")}: {toLocaleTime(otpExpiresAt)}
              </div>
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="small">{t("hint.resend_available")}</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                {resendAvailableAt ? toLocaleTime(resendAvailableAt) : "--"}
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                {t("hint.cooldown")}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default OtpPage;
