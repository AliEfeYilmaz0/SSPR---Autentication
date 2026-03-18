import { ReactNode, createContext, useContext, useMemo, useState } from "react";
import { defaultLocale, Locale, translations } from "./translations";

const STORAGE_KEY = "sspr:locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") return defaultLocale;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "tr") return stored;
  return defaultLocale;
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const t = (key: string, fallback?: string) => {
    return (
      translations[locale]?.[key] ??
      translations[defaultLocale]?.[key] ??
      fallback ??
      key
    );
  };

  const value = useMemo(() => ({ locale, setLocale, t }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};
