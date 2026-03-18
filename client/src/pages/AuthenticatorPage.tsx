import { useEffect, useMemo, useState } from "react";
import PageLayout from "../components/PageLayout";
import StatusBadge from "../components/StatusBadge";
import { api, PendingChallenge } from "../services/api";
import useInterval from "../hooks/useInterval";
import { formatTimeRemaining, parseDate, toLocaleTime } from "../utils/time";
import { saveResetToken } from "../utils/tokenStore";
import { mapApiError } from "../utils/errorMapper";
import { useI18n } from "../i18n/I18nContext";

const POLL_MS = 4000;

const AuthenticatorPage = () => {
  const { t } = useI18n();
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    const response = await api.getPendingChallenges();
    setLoading(false);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    setChallenges(response.data.challenges);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  useInterval(fetchPending, POLL_MS);

  const handleApprove = async (challengeId: string, resetRequestId: string) => {
    setError(null);
    setInfo(null);
    setProcessingId(challengeId);
    const response = await api.approveChallenge(challengeId);
    setProcessingId(null);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    if (response.data.resetToken) {
      saveResetToken(resetRequestId, response.data.resetToken);
      setInfo(t("msg.reset_token_issued"));
    } else {
      setInfo(t("msg.challenge_approved"));
    }

    fetchPending();
  };

  const handleDeny = async (challengeId: string) => {
    setError(null);
    setInfo(null);
    setProcessingId(challengeId);
    const response = await api.denyChallenge(challengeId);
    setProcessingId(null);

    if (!response.success) {
      setError(mapApiError(response.error, t));
      return;
    }

    setInfo(t("msg.challenge_denied"));
    fetchPending();
  };

  const emptyState = useMemo(() => challenges.length === 0, [challenges.length]);

  return (
    <PageLayout
      title={t("title.authenticator")}
      subtitle={t("subtitle.authenticator")}
    >
      <section className="card">
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h3>{t("card.pending_challenges")}</h3>
          <StatusBadge tone="info">{challenges.length}</StatusBadge>
        </div>
        {loading && <div className="muted">{t("msg.loading_pending")}</div>}
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
        {info && <div className="notice" style={{ marginTop: 8 }}>{info}</div>}

        {emptyState && !loading && (
          <div className="notice" style={{ marginTop: 12 }}>
            {t("msg.no_pending")}
          </div>
        )}

        <div className="list" style={{ marginTop: 16 }}>
          {challenges.map((challenge) => {
            const expiresAt = parseDate(challenge.expiresAt);
            const countdown = formatTimeRemaining(expiresAt);

            return (
              <div key={challenge.challengeId} className="card" style={{ padding: 16 }}>
                <div className="flex-between">
                  <div>
                    <div style={{ fontWeight: 600 }}>{challenge.usernameOrEmail ?? t("common.unknown")}</div>
                    <div className="small">{t("label.reset_request_id")}: {challenge.resetRequestId}</div>
                  </div>
                  <StatusBadge tone="warning">{t("status.PENDING")}</StatusBadge>
                </div>
                <div className="flex-between" style={{ marginTop: 12 }}>
                  <div>
                    <div className="small">{t("hint.expires_in")}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{countdown}</div>
                    <div className="small">{t("hint.expiry_time")}: {toLocaleTime(expiresAt)}</div>
                  </div>
                  <div className="flex">
                    <button
                      className="button-secondary"
                      disabled={processingId === challenge.challengeId}
                      onClick={() => handleApprove(challenge.challengeId, challenge.resetRequestId)}
                    >
                      {processingId === challenge.challengeId ? t("btn.processing") : t("btn.approve")}
                    </button>
                    <button
                      className="button-ghost"
                      disabled={processingId === challenge.challengeId}
                      onClick={() => handleDeny(challenge.challengeId)}
                    >
                      {processingId === challenge.challengeId ? t("btn.processing") : t("btn.deny")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </PageLayout>
  );
};

export default AuthenticatorPage;
