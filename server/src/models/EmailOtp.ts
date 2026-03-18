import { Schema, model, Types } from "mongoose";

export type EmailOtpStatus = "SENT" | "VERIFIED" | "FAILED" | "EXPIRED";

export type EmailOtpDocument = {
  resetRequestId: Types.ObjectId;
  otpHash: string;
  status: EmailOtpStatus;
  attempts: number;
  expiresAt: Date;
  sentAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const EmailOtpSchema = new Schema<EmailOtpDocument>(
  {
    resetRequestId: {
      type: Schema.Types.ObjectId,
      ref: "ResetRequest",
      required: true,
      index: true,
    },
    otpHash: { type: String, required: true },
    status: {
      type: String,
      enum: ["SENT", "VERIFIED", "FAILED", "EXPIRED"],
      required: true,
      index: true,
    },
    attempts: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
    sentAt: { type: Date, required: true },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

export const EmailOtp = model<EmailOtpDocument>("EmailOtp", EmailOtpSchema);
