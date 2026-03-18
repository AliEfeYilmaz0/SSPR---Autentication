const FLOW_KEY = "sspr:activeFlow";

type FlowContext = {
  resetRequestId: string;
  updatedAt: string;
};

export const setActiveFlow = (resetRequestId: string) => {
  const context: FlowContext = { resetRequestId, updatedAt: new Date().toISOString() };
  sessionStorage.setItem(FLOW_KEY, JSON.stringify(context));
};

export const getActiveFlow = (): FlowContext | null => {
  const raw = sessionStorage.getItem(FLOW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as FlowContext;
    if (!parsed?.resetRequestId) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearActiveFlow = () => {
  sessionStorage.removeItem(FLOW_KEY);
};
