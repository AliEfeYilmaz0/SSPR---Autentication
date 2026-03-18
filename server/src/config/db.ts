import mongoose from "mongoose";
import { env } from "./env";

export const connectToDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(env.mongoUri);
  } catch (error) {
    throw error;
  }
};
