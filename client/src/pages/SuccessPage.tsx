import { Link } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import { clearActiveFlow } from "../utils/flowStore";
import { useEffect } from "react";
import { useI18n } from "../i18n/I18nContext";

const SuccessPage = () => {
  const { t } = useI18n();
  useEffect(() => {
    clearActiveFlow();
  }, []);
  return (
    <PageLayout
      title={t("title.success")}
      subtitle={t("subtitle.success")}
    >
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{t("msg.success_title")}</h3>
        <p className="muted" style={{ marginBottom: 16 }}>
          {t("msg.success_detail")}
        </p>
        <div className="flex">
          <Link to="/" className="button-ghost">
            {t("btn.back_portal")}
          </Link>
          <Link to="/audit" className="button-secondary" style={{ padding: "12px 16px", borderRadius: 12 }}>
            {t("btn.view_audit")}
          </Link>
        </div>
      </div>
    </PageLayout>
  );
};

export default SuccessPage;
