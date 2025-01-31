import dotenv from "dotenv";
import z from "zod";

dotenv.config({ path: "../../.env" });

const envSchema = z.object({
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
});

const validateEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(`❌ Invalid environment variables: `, parsed.error.format());
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
};

export const env = validateEnv();

export const { JWT_SECRET } = env;
