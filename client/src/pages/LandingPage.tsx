import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import { api } from "../services/api";
import { clearActiveFlow, getActiveFlow, setActiveFlow } from "../utils/flowStore";
import { mapApiError } from "../utils/errorMapper";
import { useI18n } from "../i18n/I18nContext";

const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const resumeFlow = async (resetRequestId: string) => {
    setResuming(true);
    const response = await api.getStatus(resetRequestId);
    setResuming(false);

    if (!response.success) {
      clearActiveFlow();
      return;
    }

    const step = response.data.nextStep;
    if (step === "COMPLETED") {
      clearActiveFlow();
      navigate("/success");
      return;
    }

    if (step === "OTP_REQUIRED") {
      navigate(`/otp?rid=${resetRequestId}`);
      return;
    }

    if (step === "RESET_ALLOWED") {
      navigate(`/reset?rid=${resetRequestId}`);
      return;
    }

    navigate(`/verify?rid=${resetRequestId}`);
  };

  useEffect(() => {
    const active = getActiveFlow();
    if (active?.resetRequestId) {
      resumeFlow(active.resetRequestId);
    }
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!usernameOrEmail.trim()) {
      setError(t("msg.enter_username"));
      return;
    }

    setLoading(true);
    const response = await api.requestReset(usernameOrEmail.trim());
    setLoading(false);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    const resetRequestId = response.data.resetRequestId;
    if (resetRequestId) {
      setActiveFlow(resetRequestId);
      setRequestId(resetRequestId);
      setMessage(t("msg.request_submitted"));
      navigate(`/verify?rid=${encodeURIComponent(resetRequestId)}`);
      return;
    }

    setMessage(t("msg.request_submitted"));
    navigate(`/verify`);
  };

  return (
    <PageLayout
      title={t("title.portal")}
      subtitle={t("subtitle.portal")}
    >
      <div className="grid two">
        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t("card.reset")}</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            {t("msg.reset_prompt")}
          </p>
          <form className="grid" onSubmit={handleSubmit}>
            <div className="field">
              <label>{t("label.username_email")}</label>
              <input
                value={usernameOrEmail}
                onChange={(event) => setUsernameOrEmail(event.target.value)}
                placeholder="alice@example.com"
              />
            </div>
            {error && <div className="error">{error}</div>}
            {message && <div className="notice">{message}</div>}
            {requestId && (
              <div className="notice">
                {t("msg.request_id")} <strong>{requestId}</strong>
              </div>
            )}
            <button type="submit" disabled={loading || resuming}>
              {loading ? t("btn.submitting") : resuming ? t("btn.resuming") : t("btn.start_reset")}
            </button>
          </form>
        </section>

        <section className="card">
          <h3 style={{ marginBottom: 12 }}>{t("card.happens_next")}</h3>
          <div className="list">
            <div className="notice">{t("msg.push_demo")}</div>
            <div className="notice">{t("hint.auto_fallback")}</div>
            <div className="notice">{t("msg.short_lived_token")}</div>
          </div>
        </section>
      </div>
    </PageLayout>
  );
};

export default LandingPage;
