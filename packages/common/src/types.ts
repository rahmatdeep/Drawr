import { number, z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string(),
});

export const signinSchema = signupSchema.pick({
  email: true,
  password: true,
});

export const createRoomSchema = z.object({
  name: z.string().min(3).max(20),
});

export const joinRoomsSchema = z.object({
  roomId: z.string(),
});

export const leaveRoomsSchema = z.object({
  roomId: z.string(),
});
