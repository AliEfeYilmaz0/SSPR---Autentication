import { ApiError } from "../services/api";

export const mapApiError = (error: ApiError | undefined, t: (key: string) => string) => {
  if (!error) return t("error.generic");
  const translated = t(`error.${error.code}`);
  if (translated && !translated.startsWith("error.")) {
    return translated;
  }
  return error.message || t("error.generic");
};
