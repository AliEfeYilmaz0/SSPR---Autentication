import nodemailer from "nodemailer";
import { env, isDev } from "../config/env";

export const emailService = {
  sendOtpEmail: async (to: string, otp: string): Promise<void> => {
    const hasConfig = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);

    if (!hasConfig) {
      if (isDev) {
        console.log(`[email:dev] OTP for ${to}: ${otp}`);
        return;
      }
      throw new Error("SMTP configuration missing");
    }

    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });

    await transporter.sendMail({
      from: env.smtpFrom,
      to,
      subject: "Your password reset OTP",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    });
  },
};
