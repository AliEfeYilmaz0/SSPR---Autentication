import { Schema, model, Types } from "mongoose";

export type AuditLogResult = "SUCCESS" | "FAILURE";

export type AuditLogDocument = {
  userId?: Types.ObjectId;
  usernameOrEmail?: string;
  eventType: string;
  status: string;
  result: AuditLogResult;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    usernameOrEmail: { type: String, required: false },
    eventType: { type: String, required: true },
    status: { type: String, required: true },
    result: { type: String, enum: ["SUCCESS", "FAILURE"], required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, required: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ eventType: 1, createdAt: -1 });

export const AuditLog = model<AuditLogDocument>("AuditLog", AuditLogSchema);
