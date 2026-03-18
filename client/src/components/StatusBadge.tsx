import { ReactNode } from "react";

type StatusBadgeProps = {
  tone?: "success" | "warning" | "danger" | "info";
  children: ReactNode;
};

const StatusBadge = ({ tone = "info", children }: StatusBadgeProps) => {
  return <span className={`badge ${tone}`}>{children}</span>;
};

export default StatusBadge;
