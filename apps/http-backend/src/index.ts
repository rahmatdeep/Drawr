import express from "express";
import { authMiddleware } from "./middleware";
import {
  createRoomSchema,
  deleteRoomSchema,
  joinRoomsSchema,
  leaveRoomsSchema,
  signinSchema,
  signupSchema,
} from "@repo/common/types";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";
import bcrypt from "bcrypt";
import cors from "cors";

const app = express();

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

app.use(express.json());
app.use(cors());

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
      res.status(409).json({ message: "Email already exists" });
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

    if (!user || !user.password) {
      res
        .status(401)
        .json({ message: "User with this email ID does not exist" });
      return;
    }

    // Check if user is a Google-authenticated user
    if (user.provider === "google") {
      res.status(401).json({ message: "Please sign in with Google" });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      res.status(401).json({ message: "Password is invalid" });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    res.json({ message: "Login Successful", token, userId: user.id });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.post("/google-auth", async (req, res) => {
  const { email, name, providerId } = req.body;

  try {
    let user = await prismaClient.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prismaClient.user.create({
        data: {
          email,
          username: name,
          provider: "google",
          providerAccountId: providerId,
          password: "", // Empty password for Google users
        },
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ message: "Login Successful", token, userId: user.id });
  } catch (e) {
    console.error(e);
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
  try {
    const room = await prismaClient.room.create({
      data: {
        slug: parsedData.data.name,
        adminId: userId,
      },
    });

    await prismaClient.userRooms.create({
      data: {
        userId: req.userId,
        roomId: room.id,
      },
    });

    res.json({
      roomId: room.id,
    });
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    if (error.code === "P2002") {
      res.status(409).json({ message: "Room with this name already exists" });
      return;
    }
    res.status(500).json({
      message: "Something went wrong",
    });
  }
});

app.get("/chats/:roomId", async (req, res) => {
  const roomId = Number(req.params.roomId);
  const messages = await prismaClient.chat.findMany({
    where: {
      roomId,
    },
    orderBy: {
      id: "asc",
    },
  });
  res.json({
    messages,
  });
});

app.delete("/room", authMiddleware, async (req, res) => {
  const parsedData = deleteRoomSchema.safeParse(req.body);

  if (!parsedData.success) {
    res.status(400).json({
      message: "Validation Failed",
      error: parsedData.error.format(),
    });
    return;
  }
  try {
    const roomId = Number(parsedData.data.roomId);
    const room = await prismaClient.room.findUnique({
      where: {
        id: roomId,
      },
    });
    if (room?.adminId !== req.userId) {
      res.status(403).json({ message: "Not authorized to delete this room" });
      return;
    }
    await prismaClient.room.delete({
      where: { id: roomId },
    });
    res.json({ message: "Room deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
});

app.get("/room/:slug", authMiddleware, async (req, res) => {
  const slug = req.params.slug;
  const room = await prismaClient.room.findFirst({
    where: {
      slug: slug,
    },
  });

  res.json({ room });
});

app
  .route("/rooms")
  .get(authMiddleware, async (req, res) => {
    const userId = req.userId;
    try {
      const user = await prismaClient.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          roomsJoined: {
            select: {
              room: true,
            },
          },
        },
      });
      res.json(user?.roomsJoined);
    } catch (e) {
      res.status(500).json({
        message: "Something went wrong",
      });
    }
  })
  .post(authMiddleware, async (req, res) => {
    const parsedData = joinRoomsSchema.safeParse(req.body);

    if (!parsedData.success) {
      res.status(400).json({
        message: "Validation Failed",
        error: parsedData.error.format(),
      });
      return;
    }
    try {
      const userRoom = await prismaClient.userRooms.create({
        data: {
          userId: req.userId,
          roomId: Number(parsedData.data.roomId),
        },
      });

      res.json({
        userRoom,
      });
    } catch (e) {
      const error = e as { code?: string; message?: string };
      if (error.code === "P2002") {
        res.status(409).json({ message: "Room is already joined" });
        return;
      }
      res.status(500).json({
        message: "something went wrong",
      });
    }
  })
  .delete(authMiddleware, async (req, res) => {
    const parsedData = leaveRoomsSchema.safeParse(req.body);
    if (!parsedData.success) {
      res.status(400).json({
        message: "Validation Failed",
        error: parsedData.error.format(),
      });
      return;
    }
    try {
      await prismaClient.userRooms.delete({
        where: {
          userId_roomId: {
            userId: req.userId,
            roomId: Number(parsedData.data.roomId),
          },
        },
      });
      res.json({
        message: "Success",
      });
    } catch (e) {
      res.status(500).json({
        message: "Something went wrong",
      });
    }
  });

app.listen(3001, () => {
  console.log("HTTP server is listening on port 3001");
});
