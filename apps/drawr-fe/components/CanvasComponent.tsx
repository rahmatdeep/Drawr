import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import {
  CircleIcon,
  EraserIcon,
  PencilIcon,
  BaselineIcon,
  RectangleHorizontalIcon,
  SlashIcon,
} from "lucide-react";
import { Game } from "@/draw/game";
import { usePageSize } from "@/hooks/usePagesize";

type Tool = "circle" | "rectangle" | "line" | "eraser" | "pencil" | "text";

export function CanvasComponent({
  roomId,
  socket,
}: {
  roomId: string;
  socket: WebSocket;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const pageSize = usePageSize();

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Create a temporary canvas to store the current content
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) return;

    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Copy the old drawing to the temporary canvas
    tempCtx.drawImage(canvas, 0, 0);

    // Resize the main canvas
    const newWidth = pageSize.width;
    const newHeight = pageSize.height;

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Restore the drawing to the resized canvas
    ctx.drawImage(tempCanvas, 0, 0);

    // Redraw game elements if necessary
    game?.clearCanvas();
  }, [pageSize]); // Runs whenever window resizes

  const [selectedTool, setSelectedTool] = useState<Tool>("pencil");
  const [textInput, setTextInput] = useState({
    isVisible: false,
    x: 0,
    y: 0,
  });

  const toolDescriptions: Record<Tool, string> = {
    pencil: "Click and drag, release when you're finished",
    line: "Click and drag",
    rectangle: "Click and drag to set size",
    circle: "Click and drag to set size",
    text: "Click anywhere to add text",
    eraser: "Click to erase",
  };

  // Add text input component
  const FloatingTextInput = () => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, [textInput.isVisible]);

    return textInput.isVisible ? (
      <input
        ref={inputRef}
        className="fixed bg-transparent text-white outline-none text-lg"
        style={{ left: textInput.x, top: textInput.y - 10, fontSize: "20px" }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value) {
            game?.addText(e.currentTarget.value, textInput.x, textInput.y);
            setTextInput({ ...textInput, isVisible: false });
            document.body.style.cursor = "default";
          }
          if (e.key === "Escape") {
            setTextInput({ ...textInput, isVisible: false });
            document.body.style.cursor = "default";
          }
        }}
        onBlur={() => setTextInput({ ...textInput, isVisible: false })}
      />
    ) : null;
  };

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "1":
          setSelectedTool("pencil");
          break;
        case "2":
          setSelectedTool("line");
          break;
        case "3":
          setSelectedTool("rectangle");
          break;
        case "4":
          setSelectedTool("circle");
          break;
        case "5":
          setSelectedTool("text");
          document.body.style.cursor = "text";
          break;
        case "6":
          setSelectedTool("eraser");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="overflow-hidden h-screen">
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          if (selectedTool === "text") {
            setTextInput({
              isVisible: true,
              x: e.clientX,
              y: e.clientY,
            });
          }
        }}
      ></canvas>
      <FloatingTextInput />
      <Topbar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
      <div className="fixed top-[5.5rem] left-1/2 -translate-x-1/2 text-white/50 text-sm">
        {toolDescriptions[selectedTool]}
      </div>
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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 flex gap-4 bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 transition-all duration-300">
      <IconButton
        isActivated={selectedTool === "pencil"}
        icon={<PencilIcon />}
        onClick={() => {
          setSelectedTool("pencil");
          document.body.style.cursor = "default";
        }}
        keybind="1"
        title="Pencil — 1"
      />
      <IconButton
        isActivated={selectedTool === "line"}
        icon={<SlashIcon />}
        onClick={() => {
          setSelectedTool("line");
          document.body.style.cursor = "default";
        }}
        keybind="2"
        title="Line — 2"
      />
      <IconButton
        isActivated={selectedTool === "rectangle"}
        icon={<RectangleHorizontalIcon />}
        onClick={() => {
          setSelectedTool("rectangle");
          document.body.style.cursor = "default";
        }}
        keybind="3"
        title="Rectangle — 3"
      />
      <IconButton
        isActivated={selectedTool === "circle"}
        icon={<CircleIcon />}
        onClick={() => {
          setSelectedTool("circle");
          document.body.style.cursor = "default";
        }}
        keybind="4"
        title="Circle — 4"
      />
      <IconButton
        isActivated={selectedTool === "text"}
        icon={<BaselineIcon />}
        onClick={() => {
          setSelectedTool("text");
          document.body.style.cursor = "text";
        }}
        keybind="5"
        title="Text — 5"
      />
      <IconButton
        isActivated={selectedTool === "eraser"}
        icon={<EraserIcon />}
        onClick={() => {
          setSelectedTool("eraser");
          document.body.style.cursor = "default";
        }}
        keybind="6"
        title="Eraser — 6"
      />
    </div>
  );
}
