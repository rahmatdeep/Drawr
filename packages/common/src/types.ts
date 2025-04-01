import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1),
  password: z.string().min(5, "Password must be at least 5 characters"),
});

export const signinSchema = signupSchema.pick({
  email: true,
  password: true,
});
export const deleteRoomSchema = z.object({
  roomId: z.string(),
});
export const createRoomSchema = z.object({
  name: z.string(),
});

export const joinRoomsSchema = z.object({
  roomId: z.string(),
});

export const leaveRoomsSchema = z.object({
  roomId: z.string(),
});
