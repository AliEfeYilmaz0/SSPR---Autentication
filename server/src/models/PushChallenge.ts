import { Schema, model, Types } from "mongoose";

export type PushChallengeStatus =
  | "PENDING"
  | "APPROVED"
  | "DENIED"
  | "TIMED_OUT";

export type PushChallengeDocument = {
  resetRequestId: Types.ObjectId;
  status: PushChallengeStatus;
  expiresAt: Date;
  approvedAt?: Date;
  deniedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const PushChallengeSchema = new Schema<PushChallengeDocument>(
  {
    resetRequestId: {
      type: Schema.Types.ObjectId,
      ref: "ResetRequest",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "DENIED", "TIMED_OUT"],
      required: true,
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    approvedAt: { type: Date },
    deniedAt: { type: Date },
  },
  { timestamps: true }
);

export const PushChallenge = model<PushChallengeDocument>(
  "PushChallenge",
  PushChallengeSchema
);
