import bcrypt from "bcrypt";
import { connectToDatabase } from "../config/db";
import { env } from "../config/env";
import { User, UserStatus } from "../models/User";

const SALT_ROUNDS = 12;

const demoUsers: Array<{ username: string; email: string; password: string; status: UserStatus }> = [
  { username: "alice", email: "alice@example.com", password: "Password123!", status: "ACTIVE" },
  { username: "bob", email: "bob@example.com", password: "Password123!", status: "ACTIVE" },
  { username: "admin", email: "admin@example.com", password: "Admin123!", status: "ACTIVE" },
  { username: "aliefe", email: "aliefe@gmail.com", password: "Password123!", status: "ACTIVE" },
];

const seedUsers = async () => {
  await connectToDatabase();

  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);
    await User.updateOne(
      { username: user.username },
      {
        $set: {
          username: user.username,
          email: user.email,
          passwordHash,
          status: user.status,
        },
      },
      { upsert: true }
    );
  }

  console.log(`[seed] inserted/updated ${demoUsers.length} users into ${env.mongoUri}`);
  process.exit(0);
};

seedUsers().catch((error) => {
  console.error("[seed] failed", error);
  process.exit(1);
});
