import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { CircleIcon, PencilIcon, RectangleHorizontalIcon } from "lucide-react";
import { Game } from "@/draw/game";

type Tool = "circle" | "rectangle" | "pencil";

export function CanvasComponent({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("circle");

  useEffect(() => {
    game?.setTool(selectedTool);
  }, [selectedTool, game]);

  useEffect(() => {
    if (canvasRef.current && roomId) {
      const g = new Game(canvasRef.current, roomId, socket);
      setGame(g);
    }

    return () => {
      game?.destroy();
    };
  }, [roomId, socket]);

  return (
    <div className="overflow-hidden h-screen">
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
      ></canvas>
      <Topbar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
}: {
  selectedTool: Tool;
  setSelectedTool: (shape: Tool) => void;
}) {
  return (
    <div className="fixed top-3 left-3 flex gap-2">
      <IconButton
        isActivated={selectedTool === "pencil"}
        icon={<PencilIcon />}
        onClick={() => {
          setSelectedTool("pencil");
        }}
      />
      <IconButton
        isActivated={selectedTool === "rectangle"}
        icon={<RectangleHorizontalIcon />}
        onClick={() => {
          setSelectedTool("rectangle");
        }}
      />
      <IconButton
        isActivated={selectedTool === "circle"}
        icon={<CircleIcon />}
        onClick={() => {
          setSelectedTool("circle");
        }}
      />
    </div>
  );
}
