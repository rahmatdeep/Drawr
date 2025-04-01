import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import {
  CircleIcon,
  EraserIcon,
  PencilIcon,
  BaselineIcon,
  RectangleHorizontalIcon,
  SlashIcon,
  HandIcon,
  MinusIcon,
  PlusIcon,
  HouseIcon,
  FullscreenIcon,
  Undo2Icon,
  Redo2Icon,
} from "lucide-react";
import { Game } from "@/draw/game";
import { usePageSize } from "@/hooks/usePagesize";
import { useRouter } from "next/navigation";

type Tool =
  | "circle"
  | "rectangle"
  | "line"
  | "eraser"
  | "pencil"
  | "text"
  | "pan";

export function CanvasComponent({
  roomId,
  socket,
  currentUserId
}: {
  roomId: string;
  socket: WebSocket;
  currentUserId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const pageSize = usePageSize();
  const [selectedColor, setSelectedColor] = useState<string>("white");
  const zoomOnScroll = false; // Set to true to set zoom on scroll
  const router = useRouter();
  const [gameInitialized, setGameInitialized] = useState(false);

  useEffect(() => {
    gameRef.current?.setStrokeColor(selectedColor);
  }, [selectedColor]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    if (!tempCtx) return;

    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    tempCtx.drawImage(canvas, 0, 0);

    const newWidth = pageSize.width;
    const newHeight = pageSize.height;

    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.drawImage(tempCanvas, 0, 0);

    gameRef.current?.clearCanvas();
  }, [pageSize]);

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
    pan: "Click and drag to move around",
  };

  const FloatingTextInput = () => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []);

    return textInput.isVisible ? (
      <input
        ref={inputRef}
        className="fixed bg-transparent text-white outline-none text-lg"
        style={{
          left:
            textInput.x * gameRef.current!.getScale() +
            gameRef.current!.getOffsetX(),
          top:
            textInput.y * gameRef.current!.getScale() +
            gameRef.current!.getOffsetY() -
            10,
          fontSize: `${20 * gameRef.current!.getScale()}px`,
          color: selectedColor,
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value) {
            gameRef.current?.addText(
              e.currentTarget.value,
              textInput.x,
              textInput.y
            );
            setTextInput({ ...textInput, isVisible: false });
            document.body.style.cursor = "crosshair";
          }
          if (e.key === "Escape") {
            setTextInput({ ...textInput, isVisible: false });
            document.body.style.cursor = "crosshair";
          }
        }}
        onBlur={(e) => {
          if (e.currentTarget.value) {
            gameRef.current?.addText(
              e.currentTarget.value,
              textInput.x,
              textInput.y
            );
          }
          setTextInput({ ...textInput, isVisible: false });
          document.body.style.cursor = "crosshair";
        }}
      />
    ) : null;
  };

  useEffect(() => {
    gameRef.current?.setTool(selectedTool);
    if (selectedTool === "text") document.body.style.cursor = "text";
    else if (selectedTool === "eraser")
      document.body.style.cursor = "url('/circle.png'), auto";
    else if (selectedTool === "pan") document.body.style.cursor = "grab";
    else document.body.style.cursor = "crosshair";
  }, [selectedTool]);

  useEffect(() => {
    if (canvasRef.current && roomId) {
      gameRef.current = new Game(
        canvasRef.current,
        roomId,
        socket,
        currentUserId,
        zoomOnScroll
      );
      // Set the initialized state to true
      setGameInitialized(true);
    }
    return () => {
      gameRef.current?.destroy();
    };
  }, [roomId, socket, zoomOnScroll, currentUserId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in text input
      if (textInput.isVisible) return;

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
          break;
        case "6":
          setSelectedTool("eraser");
          break;
        case "7":
          setSelectedTool("pan");
          break;
      }
      // Handle Ctrl+S for download
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleDownload();
        return;
      }
      // Handle Ctrl+H for back to dashboard
      if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        router.push("/dashboard");
        document.body.style.cursor = "default";
        return;
      }
      // Handle Ctrl+Z for undo
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        gameRef.current?.undo();
        return;
      }

      // Handle Ctrl+Y for redo
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        gameRef.current?.redo();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [textInput.isVisible]);

  const handleDownload = () => {
    if (!gameRef.current) return;

    // Get the data URL from the game
    const dataUrl = gameRef.current.exportAsPNG();

    // Get current date and time
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const timeStr = today
      .toTimeString()
      .split(" ")[0]
      .replace(/:/g, "")
      .substring(0, 6); // HHMMSS

    // Create a temporary link element
    const link = document.createElement("a");
    link.download = `drawr-room${roomId}-${dateStr}${timeStr}.png`;
    link.href = dataUrl;

    // Append to the document, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="overflow-hidden h-screen">
      <canvas
        ref={canvasRef}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          if (selectedTool === "text") {
            const transformedX =
              (e.clientX - gameRef.current!.getOffsetX()) /
              gameRef.current!.getScale();
            const transformedY =
              (e.clientY - gameRef.current!.getOffsetY()) /
              gameRef.current!.getScale();
            setTextInput({
              isVisible: true,
              x: transformedX,
              y: transformedY,
            });
          }
        }}
      ></canvas>
      <FloatingTextInput />
      <Topbar
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        handleDownload={handleDownload}
        router={router}
      />
      <div className="fixed top-[5.5rem] left-1/2 -translate-x-1/2 text-white/50 text-sm">
        {toolDescriptions[selectedTool]}
      </div>
      <ColorBar
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
      />
      {gameInitialized && (
        <div className="fixed bottom-4 left-4 flex gap-2">
          <ZoomBar game={gameRef.current} />
          <UndoRedoBar game={gameRef.current} />
        </div>
      )}
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
  handleDownload,
  router,
}: {
  selectedTool: Tool;
  setSelectedTool: (shape: Tool) => void;
  handleDownload: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 flex gap-4 items-center bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 transition-all duration-300 cursor-default">
      <IconButton
        isActivated={selectedTool === "pencil"}
        icon={<PencilIcon />}
        onClick={() => {
          setSelectedTool("pencil");
        }}
        keybind="1"
        title="Pencil — 1"
      />
      <IconButton
        isActivated={selectedTool === "line"}
        icon={<SlashIcon />}
        onClick={() => {
          setSelectedTool("line");
        }}
        keybind="2"
        title="Line — 2"
      />
      <IconButton
        isActivated={selectedTool === "rectangle"}
        icon={<RectangleHorizontalIcon />}
        onClick={() => {
          setSelectedTool("rectangle");
        }}
        keybind="3"
        title="Rectangle — 3"
      />
      <IconButton
        isActivated={selectedTool === "circle"}
        icon={<CircleIcon />}
        onClick={() => {
          setSelectedTool("circle");
        }}
        keybind="4"
        title="Circle — 4"
      />
      <IconButton
        isActivated={selectedTool === "text"}
        icon={<BaselineIcon />}
        onClick={() => {
          setSelectedTool("text");
        }}
        keybind="5"
        title="Text — 5"
      />
      <div className="w-px h-8 bg-white/20" /> {/* Divider */}
      <IconButton
        isActivated={selectedTool === "eraser"}
        icon={<EraserIcon />}
        onClick={() => {
          setSelectedTool("eraser");
        }}
        keybind="6"
        title="Eraser — 6"
      />
      <IconButton
        isActivated={selectedTool === "pan"}
        icon={<HandIcon />}
        onClick={() => {
          setSelectedTool("pan");
        }}
        keybind="7"
        title="Pan Tool — 7"
      />
      <IconButton
        icon={<FullscreenIcon />}
        onClick={handleDownload}
        keybind="^S"
        title="Save current view as PNG — Ctrl+S"
      />
      <IconButton
        icon={<HouseIcon />}
        onClick={() => {
          router.push("/dashboard");
          document.body.style.cursor = "default";
        }}
        keybind="^H"
        title="Back to Dashboard — Ctrl+H"
      />
    </div>
  );
}

function ColorBar({
  selectedColor,
  setSelectedColor,
}: {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
}) {
  const colors = [
    "#FFFFFF",
    "#F43F5E",
    "#22D3EE",
    "#A3E635",
    "#FDE047",
    "#D946EF",
    "#FB923C",
    "#F472B6",
  ];

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 bg-white/5 backdrop-blur-md p-3 rounded-2xl border border-white/20 cursor-default">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => setSelectedColor(color)}
          style={{ backgroundColor: color }}
          className={`w-8 h-8 rounded-full transition-all duration-300 shadow-md
            ${
              selectedColor === color
                ? "scale-125 ring-2 ring-white/50 shadow-lg"
                : "hover:scale-110 hover:ring-2 hover:ring-white/30"
            }`}
        />
      ))}
    </div>
  );
}

function ZoomBar({ game }: { game: Game | null }) {
  const [scale, setScale] = useState(() => game?.getScale() || 1);
  useEffect(() => {
    if (game) {
      setScale(game.getScale());
    }
  }, [game]);

  const handleZoom = (zoomType: "in" | "out") => {
    if (!game) return;

    if (zoomType === "in") {
      game.zoomIn();
    } else {
      game.zoomOut();
    }

    // Update scale after zoom operation
    setScale(game.getScale());
  };

  return (
    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 cursor-default">
      <IconButton
        icon={<MinusIcon />}
        onClick={() => handleZoom("out")}
        title="Zoom Out"
      />
      <span className="text-white/70 text-sm min-w-[3rem] text-center">
        {Math.round(scale * 100)}%{" "}
      </span>
      <IconButton
        icon={<PlusIcon />}
        onClick={() => handleZoom("in")}
        title="Zoom In"
      />
    </div>
  );
}

function UndoRedoBar({ game }: { game: Game | null }) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    if (game) {
      // Initial check
      setCanUndo(game.canUndo());
      setCanRedo(game.canRedo());

      // Set up an interval to periodically check
      const intervalId = setInterval(() => {
        setCanUndo(game.canUndo());
        setCanRedo(game.canRedo());
      }, 500);

      return () => clearInterval(intervalId);
    }
  }, [game]);

  const handleUndo = () => {
    if (!game || !canUndo) return;
    game.undo();
    setCanUndo(game.canUndo());
    setCanRedo(game.canRedo());
  };

  const handleRedo = () => {
    if (!game || !canRedo) return;
    game.redo();
    setCanUndo(game.canUndo());
    setCanRedo(game.canRedo());
  };

  return (
    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-3 py-2 rounded-xl border border-white/20 cursor-default">
      <IconButton
        icon={<Undo2Icon />}
        onClick={handleUndo}
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
      />
      <IconButton
        icon={<Redo2Icon />}
        onClick={handleRedo}
        title="Redo (Ctrl+Y)"
        disabled={!canRedo}
      />
    </div>
  );
}