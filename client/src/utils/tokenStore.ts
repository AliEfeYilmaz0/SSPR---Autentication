const tokenStore = new Map<string, string>();

export const saveResetToken = (resetRequestId: string, token: string) => {
  tokenStore.set(resetRequestId, token);
};

export const getResetToken = (resetRequestId: string) => {
  return tokenStore.get(resetRequestId) ?? null;
};

export const clearResetToken = (resetRequestId: string) => {
  tokenStore.delete(resetRequestId);
};
