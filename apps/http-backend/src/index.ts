import express from "express";
import { authMiddleware } from "./middleware";
import {
  createRoomSchema,
  signinSchema,
  signupSchema,
} from "@repo/common/types";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
const app = express();

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

app.use(express.json());

app.post("/signup", (req, res) => {
  const result = signupSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      message: "Validation Failed",
      error: result.error.format(),
    });
    return;
  }

  const { email, username, password } = result.data;

  res.status(201).json({
    message: "Signup successful",
    user: { username, email },
  });
});

app.post("/signin", (req, res) => {
  const result = signinSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      message: "Validation Failed",
      error: result.error.format(),
    });
    return;
  }
  const { username, password } = result.data;

  const token = jwt.sign(username, JWT_SECRET);
  res.json({
    token,
  });
});

app.post("/room", authMiddleware, (req, res) => {
  const result = createRoomSchema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      message: "Validation Failed",
      error: result.error.format(),
    });
    return;
  }

  const { name } = result.data;

  res.json({
    roomId: "123",
  });
});

app.listen(3001, () => {
  console.log("http server is listening on port 3000");
});
