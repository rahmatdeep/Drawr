import { initDraw } from "@/draw";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { CircleIcon, PencilIcon, RectangleHorizontalIcon } from "lucide-react";

enum Shapes {
  Circle = "circle",
  Rectangle = "rectangle",
  Pencil = "pencil",
}

export function CanvasComponent({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<Shapes>(Shapes.Circle);

  useEffect(() => {
    if (canvasRef.current && roomId) {
      initDraw(canvasRef.current, roomId, socket);
    }
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
  selectedTool: Shapes;
  setSelectedTool: (shape: Shapes) => void;
}) {
  return (
    <div className="fixed top-3 left-3 flex gap-2">
      <IconButton
        isActivated={selectedTool === Shapes.Pencil}
        icon={<PencilIcon />}
        onClick={() => {
          setSelectedTool(Shapes.Pencil);
        }}
      />
      <IconButton
        isActivated={selectedTool === Shapes.Rectangle}
        icon={<RectangleHorizontalIcon />}
        onClick={() => {
          setSelectedTool(Shapes.Rectangle);
        }}
      />
      <IconButton
        isActivated={selectedTool === Shapes.Circle}
        icon={<CircleIcon />}
        onClick={() => {
          setSelectedTool(Shapes.Circle);
        }}
      />
    </div>
  );
}
