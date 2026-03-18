import { Schema, model, Types } from "mongoose";

export type ResetRequestStatus =
  | "PENDING"
  | "PUSH_APPROVED"
  | "PUSH_DENIED"
  | "PUSH_TIMED_OUT"
  | "OTP_PENDING"
  | "OTP_VERIFIED"
  | "COMPLETED"
  | "FAILED";

export type VerificationMethod = "PUSH" | "EMAIL_OTP" | "NONE";

export type ResetRequestDocument = {
  userId?: Types.ObjectId;
  usernameOrEmail: string;
  status: ResetRequestStatus;
  verificationMethod: VerificationMethod;
  pushChallengeId?: Types.ObjectId;
  otpId?: Types.ObjectId;
  resetTokenJti?: string;
  resetTokenExpiresAt?: Date;
  authFlowExpiresAt?: Date;
  resetFlowExpiresAt?: Date;
  failureReason?: string;
  attemptCount: number;
  completedAt?: Date;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const ResetRequestSchema = new Schema<ResetRequestDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    usernameOrEmail: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "PENDING",
        "PUSH_APPROVED",
        "PUSH_DENIED",
        "PUSH_TIMED_OUT",
        "OTP_PENDING",
        "OTP_VERIFIED",
        "COMPLETED",
        "FAILED",
      ],
      required: true,
    },
    verificationMethod: {
      type: String,
      enum: ["PUSH", "EMAIL_OTP", "NONE"],
      required: true,
    },
    pushChallengeId: { type: Schema.Types.ObjectId, ref: "PushChallenge" },
    otpId: { type: Schema.Types.ObjectId, ref: "EmailOtp" },
    resetTokenJti: { type: String },
    resetTokenExpiresAt: { type: Date },
    authFlowExpiresAt: { type: Date },
    resetFlowExpiresAt: { type: Date },
    failureReason: { type: String },
    attemptCount: { type: Number, default: 0 },
    completedAt: { type: Date },
    lastActivityAt: { type: Date },
  },
  { timestamps: true }
);

ResetRequestSchema.index({ userId: 1, status: 1 });
ResetRequestSchema.index({ createdAt: -1 });

export const ResetRequest = model<ResetRequestDocument>(
  "ResetRequest",
  ResetRequestSchema
);
