export type ApiError = { code: string; message: string };

type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

type ApiFailure = {
  success: false;
  error: ApiError;
};

type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const request = async <T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const json = (await response.json()) as ApiResponse<T>;
  return json;
};

export type PendingChallenge = {
  challengeId: string;
  resetRequestId: string;
  usernameOrEmail?: string;
  expiresAt: string;
  createdAt: string;
};

export type StatusPayload = {
  nextStep:
    | "WAITING_APPROVAL"
    | "APPROVED"
    | "DENIED"
    | "OTP_REQUIRED"
    | "OTP_VERIFIED"
    | "RESET_ALLOWED"
    | "COMPLETED";
  pushExpiresAt?: string | null;
  otpExpiresAt?: string | null;
  resendAvailableAt?: string | null;
  resetTokenIssued?: boolean;
  authFlowExpiresAt?: string | null;
  resetFlowExpiresAt?: string | null;
  failureReason?: string | null;
  flowExpired?: boolean;
};

export const api = {
  requestReset: (usernameOrEmail: string) =>
    request<{ resetRequestId?: string }>("/api/sspr/request", {
      method: "POST",
      body: JSON.stringify({ usernameOrEmail }),
    }),

  getStatus: (resetRequestId: string) =>
    request<StatusPayload>(`/api/sspr/status/${resetRequestId}`),

  verifyOtp: (resetRequestId: string, otp: string) =>
    request<{ status: string; resetToken?: string; resetTokenExpiresAt?: string }>(
      "/api/sspr/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({ resetRequestId, otp }),
      }
    ),

  resendOtp: (resetRequestId: string) =>
    request<{ otpPreview?: string; otpExpiresAt?: string }>(
      "/api/sspr/otp/resend",
      {
        method: "POST",
        body: JSON.stringify({ resetRequestId }),
      }
    ),

  resetPassword: (token: string, newPassword: string, confirmPassword: string) =>
    request<{ resetRequestId: string }>("/api/sspr/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    }),

  validateResetToken: (token: string) =>
    request<{ usernameOrEmail: string; resetRequestId: string }>(
      "/api/sspr/reset/validate",
      {
        method: "POST",
        body: JSON.stringify({ token }),
      }
    ),

  getPendingChallenges: () => request<{ challenges: PendingChallenge[] }>("/api/authenticator/pending"),

  approveChallenge: (challengeId: string) =>
    request<{ challengeId: string; resetToken?: string; resetTokenExpiresAt?: string }>(
      "/api/authenticator/approve",
      {
        method: "POST",
        body: JSON.stringify({ challengeId }),
      }
    ),

  denyChallenge: (challengeId: string) =>
    request<{ challengeId: string }>("/api/authenticator/deny", {
      method: "POST",
      body: JSON.stringify({ challengeId }),
    }),

  getAuditLogs: (params: {
    page?: number;
    limit?: number;
    eventType?: string;
    status?: string;
    usernameOrEmail?: string;
    from?: string;
    to?: string;
  }) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      search.set(key, String(value));
    });
    const query = search.toString();
    return request<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }>(
      `/api/audit-logs${query ? `?${query}` : ""}`
    );
  },
};
