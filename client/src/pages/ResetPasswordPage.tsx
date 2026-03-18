import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import { api } from "../services/api";
import { clearResetToken, getResetToken } from "../utils/tokenStore";
import { mapApiError } from "../utils/errorMapper";
import { clearActiveFlow, setActiveFlow } from "../utils/flowStore";
import { formatTimeRemaining, parseDate, toLocaleTime } from "../utils/time";
import useInterval from "../hooks/useInterval";
import { useI18n } from "../i18n/I18nContext";

const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const resetRequestId = params.get("rid") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [flowStatus, setFlowStatus] = useState<{ resetFlowExpiresAt?: string | null; failureReason?: string | null } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!resetRequestId) return;
    const stored = getResetToken(resetRequestId);
    if (!stored) {
      setError(t("error.INVALID_TOKEN"));
      setTimeout(() => navigate("/"), 2000);
      return;
    }

    api.validateResetToken(stored).then((response) => {
      if (!response.success) {
        setError(t("error.INVALID_TOKEN"));
        clearResetToken(resetRequestId);
        clearActiveFlow();
        setTimeout(() => navigate("/"), 2000);
        return;
      }
      setUserLabel(response.data.usernameOrEmail);
      setTokenChecked(true);
    });

    setActiveFlow(resetRequestId);
  }, [resetRequestId]);

  const resetFlowExpiresAt = useMemo(
    () => parseDate(flowStatus?.resetFlowExpiresAt),
    [flowStatus?.resetFlowExpiresAt]
  );
  const resetCountdown = formatTimeRemaining(resetFlowExpiresAt);
  const resetExpired = flowStatus?.failureReason === "RESET_TIMEOUT";

  useInterval(() => setTick((prev) => prev + 1), 1000);

  const fetchStatus = async () => {
    if (!resetRequestId) return;
    const response = await api.getStatus(resetRequestId);
    if (response.success) {
      setFlowStatus({
        resetFlowExpiresAt: response.data.resetFlowExpiresAt,
        failureReason: response.data.failureReason,
      });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [resetRequestId]);

  useInterval(fetchStatus, resetRequestId ? 5000 : null);

  useEffect(() => {
    if (resetExpired) {
      clearActiveFlow();
      clearResetToken(resetRequestId);
      setError(t("msg.timeout_reset"));
      setTimeout(() => navigate("/"), 2000);
    }
  }, [resetExpired, navigate, resetRequestId]);

  const handleReset = async () => {
    setError(null);
    setInfo(null);

    if (!tokenChecked) {
      setError(t("error.INVALID_TOKEN"));
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError(t("error.VALIDATION_ERROR"));
      return;
    }

    setLoading(true);
    const token = getResetToken(resetRequestId);
    if (!token) {
      setError(t("error.INVALID_TOKEN"));
      return;
    }

    const response = await api.resetPassword(token, newPassword, confirmPassword);
    setLoading(false);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    clearResetToken(resetRequestId);
    clearActiveFlow();
    setInfo(t("msg.reset_success"));
    navigate("/success");
  };

  return (
    <PageLayout
      title={t("title.reset")}
      subtitle={t("subtitle.reset")}
    >
      <div className="grid two">
        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t("card.choose_password")}</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            {userLabel ? t("msg.resetting_for").replace("{user}", userLabel) : t("msg.user_verifying")}
          </p>
          <div className="grid">
            <div className="field">
              <label>{t("label.new_password")}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="field">
              <label>{t("label.confirm_password")}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {error && <div className="error">{error}</div>}
            {info && <div className="notice">{info}</div>}
            <button onClick={handleReset} disabled={loading || !tokenChecked}>
              {loading ? t("btn.saving") : t("btn.reset_password")}
            </button>
          </div>
        </section>

        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t("card.password_policy")}</h3>
          <div className="list">
            <div className="notice">{t("policy.min_length")}</div>
            <div className="notice">{t("policy.upper_lower")}</div>
            <div className="notice">{t("policy.number")}</div>
            <div className="notice">{t("policy.special")}</div>
          </div>
          <div style={{ marginTop: 16 }} className="card">
            <div className="small">{t("hint.reset_window")}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {resetFlowExpiresAt ? resetCountdown : "--:--"}
            </div>
            <div className="small">
              {t("hint.reset_expires")} {resetFlowExpiresAt ? toLocaleTime(resetFlowExpiresAt) : t("common.pending")}
            </div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default ResetPasswordPage;
