import { Schema, model } from "mongoose";

export type UserStatus = "ACTIVE" | "LOCKED";

export type UserDocument = {
  username: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

const UserSchema = new Schema<UserDocument>(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    status: { type: String, enum: ["ACTIVE", "LOCKED"], required: true },
  },
  { timestamps: true }
);

export const User = model<UserDocument>("User", UserSchema);
