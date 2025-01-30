import express from "express";
import { z } from "zod";
import { authMiddleware } from "./middleware";

const app = express();

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string(),
  password: z.string(),
});

const signinSchema = signupSchema.pick({
  username: true,
  password: true,
});

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
  const { username, password } = req.body;
});

app.post("/room", authMiddleware, (req, res) => {
  res.json({
    roomId: "123",
  });
});

app.listen(3000, () => {
  console.log("http server is listening on port 3000");
});
