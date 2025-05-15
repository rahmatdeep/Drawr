# Drawr

A real-time collaborative drawing application that allows multiple users to create and share drawings in real-time.

## Overview

Drawr is a web-based canvas application that enables users to draw shapes together in shared rooms. The application supports real-time collaboration through WebSockets, allowing users to see each other's drawings instantly.

## Features

- **Real-time Collaboration**: Draw together with others in the same room
- **Multiple Shape Support**: Create various shapes including rectangles, circles, lines, text and freehand (pencil)
- **Custom Colors**: Choose different colors for your drawings
- **Pan & Zoom**: Navigate around large canvases with pan and zoom functionality
- **Undo & Redo**: Easily correct mistakes with undo and redo functionality
- **Export Canvas**: Save the canvas view as PNG images
- **User Authentication**: Secure access with Google authentication
- **Online Users**: See who is currently active in your drawing room with real-time user presence indicators
- **Guest Mode**: Join and collaborate without requiring an account
- **Voice Calls**: Communicate with other users through integrated voice calls in drawing rooms

## Technical Stack

- **Frontend**: Next.js with TypeScript
- **Authentication**: NextAuth.js with Google provider
- **Real-time Communication**: WebSockets
- **Real-time Voice Communication**: WebRTC
- **Database**: PostgreSQL with Prisma ORM
- **Canvas Manipulation**: HTML5 Canvas API

## Getting Started

### Prerequisites

- Node.js (v22 or later)
- pnpm
- PostgreSQL database

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/fal4782/Drawr.git
   cd Drawr
   ```

2. Set up environment variables

   Create `.env` files based on the provided examples:

   - Root directory:
     ```
     # Copy from .env.example
     JWT_SECRET = "your_jwt_secret_here"
     ```
   - In `packages/db/`:
     ```
     # Copy from packages/db/.env.example
     DATABASE_URL = "your_postgres_db_url_here"
     ```
   - In `apps/drawr-fe/`:
     ```
     # Copy from apps/drawr-fe/.env.example
     NEXTAUTH_SECRET=JWTSECRET
     NEXTAUTH_URL=URLWhereThisFEisRunning
     NEXT_PUBLIC_HTTP_BACKEND=HTTPBackendURL
     NEXT_PUBLIC_WS_BACKEND=WebSocketServerURL
     GOOGLE_CLIENT_ID=GoogleClientID
     GOOGLE_CLIENT_SECRET=GoogleClientSecret
     ```

3. Install dependencies

   ```bash
   pnpm i
   ```

4. Generate Prisma client

   ```bash
   cd packages/db
   pnpm exec prisma generate
   ```

5. Start the development server

   ```bash
   cd ../..
   pnpm dev
   ```

6. Open your browser and navigate to the URL specified in your NEXTAUTH_URL

## Usage

1. Sign in using Google authentication or continue as a guest
2. Create or join a drawing room
3. Use the drawing tools to create shapes
4. Collaborate in real-time with other users in the same room
5. Pan around the canvas by dragging with the mouse
6. Zoom in and out using the scroll wheel (if enabled), otherwise use the zoom buttons
7. View currently active users in the room through the avatar indicators in the bottom-right corner
8. Join voice calls with other users in the room to communicate while drawing
## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.