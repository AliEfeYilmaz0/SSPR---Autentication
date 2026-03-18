import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext";
import { Locale } from "../i18n/translations";

const PageLayout = ({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) => {
  const location = useLocation();
  const { locale, setLocale, t } = useI18n();

  const navItems = [
    { label: t("nav.portal"), path: "/" },
    { label: t("nav.authenticator"), path: "/authenticator" },
    { label: t("nav.audit"), path: "/audit" },
  ];

  return (
    <div className="app-shell">
      <header className="navbar">
        <h1>{t("app.title")}</h1>
        <div className="nav-links" style={{ alignItems: "center" }}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                fontWeight: location.pathname === item.path ? 700 : 500,
                color: location.pathname === item.path ? "#0f766e" : undefined,
              }}
            >
              {item.label}
            </Link>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
            <span className="small">{t("lang.label")}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              style={{ padding: "6px 10px", borderRadius: 8 }}
            >
              <option value="en">{t("lang.en")}</option>
              <option value="tr">{t("lang.tr")}</option>
            </select>
          </div>
        </div>
      </header>

      {title && (
        <section className="hero">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </section>
      )}

      <main style={{ marginTop: 24 }}>{children}</main>
    </div>
  );
};

export default PageLayout;
