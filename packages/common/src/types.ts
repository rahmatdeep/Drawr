import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string(),
});

export const signinSchema = signupSchema.pick({
  username: true,
  password: true,
});

export const createRoomSchema = z.object({
  name: z.string().min(3).max(20),
});
