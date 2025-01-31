import express from "express";
import { authMiddleware } from "./middleware";
import {
  createRoomSchema,
  signinSchema,
  signupSchema,
} from "@repo/common/types";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import bcrypt from "bcrypt";

const app = express();

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

app.use(express.json());

app.post("/signup", async (req, res) => {
  const parsedData = signupSchema.safeParse(req.body);

  if (!parsedData.success) {
    res.status(400).json({
      message: "Validation Failed",
      error: parsedData.error.format(),
    });
    return;
  }

  const { email, username, password } = parsedData.data;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prismaClient.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
      },
    });
    res.status(201).json({
      message: "Signup successful",
      userId: user.id,
    });
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    if (error.code === "P2002") {
      res.status(409).json({ message: "Email already exsists" });
      return;
    }
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.post("/signin", async (req, res) => {
  const parsedData = signinSchema.safeParse(req.body);
  if (!parsedData.success) {
    res.status(400).json({
      message: "Validation Failed",
      error: parsedData.error.format(),
    });
    return;
  }
  const { email, password } = parsedData.data;
  try {
    const user = await prismaClient.user.findUnique({
      where: { email },
    });

    if (!user) {
      res
        .status(401)
        .json({ message: "user with this email id does not exsist" });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      res.status(401).json({ message: "Password is invalid" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    res.json({ message: "Login Successful", token });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/room", authMiddleware, async (req, res) => {
  const parsedData = createRoomSchema.safeParse(req.body);

  if (!parsedData.success) {
    res.status(400).json({
      message: "Validation Failed",
      error: parsedData.error.format(),
    });
    return;
  }

  const userId = req.userId;

  const { name } = parsedData.data;

  const room = await prismaClient.room.create({
    data: {
      slug: parsedData.data.name,
      adminId: userId,
    },
  });

  res.json({
    roomId: room.id,
  });
});

app.listen(3001, () => {
  console.log("http server is listening on port 3000");
});
