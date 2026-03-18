import { useState } from "react";
import { useI18n } from "../i18n/I18nContext";

const formatMetadata = (metadata: Record<string, unknown> | undefined, fallbackNone: string, fallbackUnavailable: string) => {
  if (!metadata) return fallbackNone;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch (error) {
    return fallbackUnavailable;
  }
};

const MetadataPreview = ({ metadata }: { metadata?: Record<string, unknown> }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const preview = formatMetadata(metadata, t("common.none"), t("common.unavailable"));

  return (
    <div>
      <button className="button-ghost" onClick={() => setOpen((prev) => !prev)}>
        {open ? t("btn.hide_details") : t("btn.view_details")}
      </button>
      {open && (
        <pre
          style={{
            marginTop: 12,
            background: "#0f172a",
            color: "#e2e8f0",
            padding: 12,
            borderRadius: 12,
            fontSize: 12,
            overflowX: "auto",
          }}
        >
          {preview}
        </pre>
      )}
    </div>
  );
};

export default MetadataPreview;
