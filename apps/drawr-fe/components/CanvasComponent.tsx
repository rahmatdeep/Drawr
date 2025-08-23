/* eslint-disable @typescript-eslint/no-unused-vars */
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
  FullscreenIcon,
  Undo2Icon,
  Redo2Icon,
  ArrowLeftIcon,
  XIcon,
  ShareIcon,
  PointerIcon,
} from "lucide-react";
import { Game, Shape } from "@/draw/game";
import { usePageSize } from "@/hooks/usePagesize";
import { useRouter } from "next/navigation";
import { GuestUser } from "@/utils/guestUser";

type Tool =
  | "circle"
  | "rectangle"
  | "line"
  | "eraser"
  | "pencil"
  | "text"
  | "pan"
  | "select";

export function CanvasComponent({
  roomId,
  socket,
  isGuestMode = false,
  guestUser = null,
}: {
  roomId: string;
  socket: WebSocket | null;
  isGuestMode?: boolean;
  guestUser?: GuestUser | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const pageSize = usePageSize();
  const [selectedColor, setSelectedColor] = useState<string>("white");
  const zoomOnScroll = false; // Set to true to set zoom on scroll
  const router = useRouter();
  const [gameInitialized, setGameInitialized] = useState(false);
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("pencil" as Tool);
  const [strokeWidth, setStrokeWidth] = useState<number>(1);
  const [fontSize, setFontSize] = useState<
    "small" | "medium" | "large" | "xlarge"
  >("medium");
  const [backgroundColor, setBackgroundColor] = useState<string | undefined>(
    undefined
  );
  const [fillPattern, setFillPattern] = useState<
    "solid" | "hachure" | "cross-hatch"
  >("solid");
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
    select: "Click to select a shape, drag to move it",
  };
  useEffect(() => {
    gameRef.current?.setStrokeColor(selectedColor);
  }, [selectedColor]);

  useEffect(() => {
    gameRef.current?.setStrokeWidth(strokeWidth);
  }, [strokeWidth]);

  useEffect(() => {
    gameRef.current?.setBackgroundColor(backgroundColor);
  }, [backgroundColor]);

  useEffect(() => {
    gameRef.current?.setFillPattern(fillPattern);
  }, [fillPattern]);
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

  // tool sync and selection changes
  useEffect(() => {
    const handleCanvasEvents = (event: MouseEvent) => {
      if (!gameRef.current || !gameInitialized) return;

      // Sync the tool state
      const currentGameTool = gameRef.current.getTool();
      if (currentGameTool !== selectedTool) {
        setSelectedTool(currentGameTool);
      }

      // Handle selection changes
      const shape = gameRef.current.getSelectedShape();
      if (shape) {
        setSelectedShapeId(shape.id || null);
        // Update UI based on selected shape properties
        setSelectedColor(shape.shape.strokeColor);

        if (shape.shape.type === "text" && shape.shape.fontSize) {
          setFontSize(shape.shape.fontSize);
        } else if (shape.shape.type !== "text" && shape.shape.strokeWidth) {
          setStrokeWidth(shape.shape.strokeWidth);
        }

        if (shape.shape.type === "rectangle" || shape.shape.type === "circle") {
          setBackgroundColor(shape.shape.backgroundColor);
          if (shape.shape.fillPattern) {
            setFillPattern(shape.shape.fillPattern);
          } else {
            setFillPattern("solid");
          }
        } else {
          setBackgroundColor(undefined);
          setFillPattern("solid");
        }

        if (shape.shape.type !== "text" && shape.shape.strokeWidth) {
          setStrokeWidth(shape.shape.strokeWidth);
        }
      } else {
        setSelectedShapeId(null);
      }
    };

    // Add event listeners to canvas for mouse events
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("mousedown", handleCanvasEvents);
      canvas.addEventListener("mouseup", handleCanvasEvents);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener("mousedown", handleCanvasEvents);
        canvas.removeEventListener("mouseup", handleCanvasEvents);
      }
    };
  }, [gameInitialized, selectedTool]);

  const FloatingTextInput = () => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const fontSizeMap = {
      small: 14,
      medium: 20,
      large: 28,
      xlarge: 36,
    };
    const fontSizePx = fontSizeMap[fontSize];

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
          fontSize: `${fontSizePx * gameRef.current!.getScale()}px`,
          color: selectedColor,
          width: "50%",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.currentTarget.value) {
            gameRef.current?.addText(
              e.currentTarget.value,
              textInput.x,
              textInput.y,
              fontSize
            );
            setTextInput({ ...textInput, isVisible: false });
            setSelectedTool("select");
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
              textInput.y,
              fontSize
            );
          }
          setTextInput({ ...textInput, isVisible: false });
          setSelectedTool("select");
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
    else if (selectedTool === "select") document.body.style.cursor = "pointer";
    else document.body.style.cursor = "crosshair";
  }, [selectedTool]);

  useEffect(() => {
    if (canvasRef.current && roomId) {
      gameRef.current = new Game(
        canvasRef.current,
        roomId,
        socket,
        zoomOnScroll,
        isGuestMode
      );
      // Set the callback for property changes
      gameRef.current.setOnShapePropertyChange(() => {
        const shape = gameRef.current?.getSelectedShape();
        if (shape) {
          // Update toolbar states based on the shape properties
          setSelectedColor(shape.shape.strokeColor);

          if (shape.shape.type === "text" && shape.shape.fontSize) {
            setFontSize(shape.shape.fontSize);
          }

          if (shape.shape.type !== "text" && shape.shape.strokeWidth) {
            setStrokeWidth(shape.shape.strokeWidth);
          }

          if (
            shape.shape.type === "rectangle" ||
            shape.shape.type === "circle"
          ) {
            setBackgroundColor(shape.shape.backgroundColor);
            if (shape.shape.fillPattern) {
              setFillPattern(shape.shape.fillPattern);
            }
          }
        }
      });
      // Set the initialized state to true
      setGameInitialized(true);
    }
    return () => {
      gameRef.current?.destroy();
    };
  }, [roomId, socket, zoomOnScroll, isGuestMode]);

  const SignupPrompt = () => {
    if (!showSignupPrompt) return null;

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm cursor-default">
        <div className="bg-black/90 p-8 rounded-2xl max-w-md w-full border border-gray-800 shadow-xl relative">
          <button
            onClick={() => setShowSignupPrompt(false)}
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>

          <h2 className="text-2xl font-medium text-white mb-4">
            Share your drawing
          </h2>
          <p className="text-white/60 mb-8 leading-relaxed">
            You are currently drawing as{" "}
            <strong className="text-white/90">
              {guestUser?.username || "Guest"}
            </strong>
            . To share your drawing with others or save it to your account, you
            will need to sign up. Your drawing will be preserved.
          </p>
          <div className="flex gap-4">
            <a
              href="/signup?from=guest"
              className="bg-white text-black px-5 py-3 rounded-xl font-medium flex-1 hover:bg-gray-200 transition-all text-center"
            >
              Sign Up
            </a>
            <a
              href="/signin?from=guest"
              className="bg-transparent border border-gray-700 text-white/90 px-5 py-3 rounded-xl flex-1 hover:bg-white/5 transition-all text-center"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  };

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
          setSelectedTool("select");
          break;
        case "7":
          setSelectedTool("eraser");
          break;
        case "8":
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
        // Send leave_room message before navigating
        if (gameRef.current) {
          socket?.send(
            JSON.stringify({
              type: "leave_room",
              roomId: Number(roomId),
            })
          );
        }
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
      // Handle Esc for clear selection
      if (e.key === "Escape" && selectedTool === "select") {
        gameRef.current?.clearSelection();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [textInput.isVisible, selectedTool]);

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
      />
      <div className="fixed top-[5.5rem] left-1/2 -translate-x-1/2 text-white/50 text-sm">
        {toolDescriptions[selectedTool]}
      </div>
      {/* Dashboard Navigation */}
      <div className="fixed top-4 left-4 z-10">
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/20 transition-all duration-300 hover:bg-white/10">
          <IconButton
            icon={<ArrowLeftIcon size={20} />}
            onClick={() => {
              // Send leave_room message before navigating
              if (gameRef) {
                socket?.send(
                  JSON.stringify({
                    type: "leave_room",
                    roomId: Number(roomId),
                  })
                );
              }
              router.push("/dashboard");
              document.body.style.cursor = "default";
            }}
            title="Back to Dashboard — Ctrl+H"
          />
        </div>
      </div>
      {/* Share Button (only in guest mode) */}
      {isGuestMode && (
        <div className="fixed top-4 right-4 z-10 cursor-default">
          <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/20 transition-all duration-300 hover:bg-white/10 flex items-center h-10">
            <div className="flex items-center px-3 py-2 text-white/70">
              <span className="text-sm mr-1">
                Drawing as <strong>{guestUser?.username || "Guest"}</strong>
              </span>
            </div>
            <div className="h-full border-l border-white/10">
              <IconButton
                icon={<ShareIcon size={18} />}
                onClick={() => setShowSignupPrompt(true)}
                title="Share your drawing"
              />
            </div>
          </div>
        </div>
      )}
      {isGuestMode && <SignupPrompt />}
      {shouldShowColorBar(
        selectedTool,
        gameRef.current?.getSelectedShape() || null
      ) && (
        <DrawingToolbar
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          game={gameRef.current}
          selectedTool={selectedTool}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          fontSize={fontSize}
          setFontSize={setFontSize}
          backgroundColor={backgroundColor}
          setBackgroundColor={setBackgroundColor}
          fillPattern={fillPattern}
          setFillPattern={setFillPattern}
        />
      )}
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
}: {
  selectedTool: Tool;
  setSelectedTool: (shape: Tool) => void;
  handleDownload: () => void;
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
        isActivated={selectedTool === "select"}
        icon={<PointerIcon />}
        onClick={() => {
          setSelectedTool("select");
        }}
        keybind="6"
        title="Select — 6"
      />
      <IconButton
        isActivated={selectedTool === "eraser"}
        icon={<EraserIcon />}
        onClick={() => {
          setSelectedTool("eraser");
        }}
        keybind="7"
        title="Eraser — 7"
      />
      <IconButton
        isActivated={selectedTool === "pan"}
        icon={<HandIcon />}
        onClick={() => {
          setSelectedTool("pan");
        }}
        keybind="8"
        title="Pan Tool — 8"
      />
      <IconButton
        icon={<FullscreenIcon />}
        onClick={handleDownload}
        keybind="^S"
        title="Save current view as PNG — Ctrl+S"
      />
    </div>
  );
}

function DrawingToolbar({
  selectedColor,
  setSelectedColor,
  game,
  selectedTool,
  strokeWidth,
  setStrokeWidth,
  fontSize,
  setFontSize,
  backgroundColor,
  setBackgroundColor,
  fillPattern,
  setFillPattern,
}: {
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  game: Game | null;
  selectedTool: Tool;
  strokeWidth: number;
  setStrokeWidth: (width: number) => void;
  fontSize: "small" | "medium" | "large" | "xlarge";
  setFontSize: (size: "small" | "medium" | "large" | "xlarge") => void;
  backgroundColor: string | undefined;
  setBackgroundColor: (color: string | undefined) => void;
  fillPattern: "solid" | "hachure" | "cross-hatch";
  setFillPattern: (pattern: "solid" | "hachure" | "cross-hatch") => void;
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

  const selectedShape = game?.getSelectedShape();
  const isShapeSelected = !!selectedShape;

  // Determine if we should show background and fill options
  const showBackgroundOptions =
    // Show for rectangle and circle tools
    selectedTool === "rectangle" ||
    selectedTool === "circle" ||
    // Show when a rectangle or circle is selected
    (selectedTool === "select" &&
      isShapeSelected &&
      (selectedShape.shape.type === "rectangle" ||
        selectedShape.shape.type === "circle"));

  // Determine if we should show stroke width (for all except text)
  const showStrokeWidth =
    // Don't show for text tool or when a text shape is selected
    selectedTool !== "text" &&
    selectedTool !== "eraser" &&
    selectedTool !== "pan" &&
    !(
      selectedTool === "select" &&
      isShapeSelected &&
      selectedShape.shape.type === "text"
    );

  // Determine if we should show font size (only for text)
  const showFontSize =
    // Show for text tool
    selectedTool === "text" ||
    // Show when a text shape is selected
    (selectedTool === "select" &&
      isShapeSelected &&
      selectedShape.shape.type === "text");

  const isRectOrCircle =
    isShapeSelected &&
    (selectedShape.shape.type === "rectangle" ||
      selectedShape.shape.type === "circle");

  // Get current properties of the selected shape
  const currentStrokeColor = isShapeSelected
    ? selectedShape.shape.strokeColor
    : selectedColor;

  // Get current stroke width
  const currentStrokeWidth =
    isShapeSelected && selectedShape.shape.type !== "text"
      ? selectedShape.shape.strokeWidth || 1
      : strokeWidth;

  // Get current font size
  const currentFontSize =
    isShapeSelected && selectedShape.shape.type === "text"
      ? selectedShape.shape.fontSize || "medium"
      : fontSize;

  const currentBgColor =
    showBackgroundOptions &&
    isShapeSelected &&
    (selectedShape.shape.type === "rectangle" ||
      selectedShape.shape.type === "circle")
      ? selectedShape.shape.backgroundColor || "transparent"
      : backgroundColor || "transparent";

  const currentFillPattern = isRectOrCircle
    ? selectedShape.shape.type === "rectangle" ||
      selectedShape.shape.type === "circle"
      ? selectedShape.shape.fillPattern || "solid"
      : "solid"
    : fillPattern;

  // Handle stroke color change
  const handleStrokeColorChange = (color: string) => {
    if (isShapeSelected) {
      game?.updateSelectedShapeStrokeColor(color);
    } else {
      setSelectedColor(color);
    }
  };

  // Handle stroke width change
  const handleStrokeWidthChange = (width: number) => {
    if (isShapeSelected && selectedShape.shape.type !== "text") {
      game?.updateSelectedShapeStrokeWidth(width);
    } else {
      setStrokeWidth(width);
    }
  };

  // Handle font size change
  const handleFontSizeChange = (
    size: "small" | "medium" | "large" | "xlarge"
  ) => {
    if (isShapeSelected && selectedShape.shape.type === "text") {
      game?.updateSelectedTextFontSize(size);
    } else {
      setFontSize(size);
    }
  };

  // Handle background color change
  const handleBgColorChange = (color: string | undefined) => {
    if (
      isShapeSelected &&
      (selectedShape.shape.type === "rectangle" ||
        selectedShape.shape.type === "circle")
    ) {
      game?.updateSelectedShapeBackgroundColor(color);
    } else {
      setBackgroundColor(color);
    }
  };

  // Handle fill pattern change
  const handleFillPatternChange = (
    pattern: "solid" | "hachure" | "cross-hatch"
  ) => {
    if (
      isShapeSelected &&
      (selectedShape.shape.type === "rectangle" ||
        selectedShape.shape.type === "circle")
    ) {
      game?.updateSelectedShapeFillPattern(pattern);
    } else {
      setFillPattern(pattern);
    }
  };

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col bg-white/5 backdrop-blur-md p-5 rounded-xl border border-white/20 w-52 cursor-default">
      {/* Stroke color section */}
      <div className="mb-3">
        <div className="text-white/80 text-xs font-medium mb-2.5">
          <span>Stroke</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {colors.map((color) => (
            <button
              key={`stroke-${color}`}
              onClick={() => handleStrokeColorChange(color)}
              style={{ backgroundColor: color }}
              className={`w-9 h-9 rounded-md transition-all duration-200 ${
                currentStrokeColor === color
                  ? "ring-2 ring-white/70 shadow-md"
                  : "hover:scale-105 hover:ring-1 hover:ring-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stroke width section - for all shapes except text */}
      {showStrokeWidth && (
        <>
          <div className="w-full h-px bg-white/10 my-2"></div>

          <div className="mb-3">
            <div className="text-white/80 text-xs font-medium mb-2.5">
              <span>Stroke Width</span>
            </div>

            <div className="flex justify-between gap-2">
              {[1, 2, 4, 6].map((width) => (
                <button
                  key={`width-${width}`}
                  onClick={() => handleStrokeWidthChange(width)}
                  className={`flex-1 py-2 rounded-lg transition-all duration-200 ${
                    currentStrokeWidth === width
                      ? "bg-white/20 ring-2 ring-white/50"
                      : "bg-white/5 hover:bg-white/10"
                  } flex items-center justify-center`}
                  title={`${width}px`}
                >
                  <div
                    className="bg-white/70 rounded-full"
                    style={{
                      height: `${width}px`,
                      width: "60%",
                    }}
                  ></div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Font size section - only for text */}
      {showFontSize && (
        <>
          <div className="w-full h-px bg-white/10 my-2"></div>

          <div className="mb-3">
            <div className="text-white/80 text-xs font-medium mb-2.5">
              <span>Font Size</span>
            </div>

            <div className="flex justify-between gap-2">
              {[
                { size: "small", label: "S" },
                { size: "medium", label: "M" },
                { size: "large", label: "L" },
                { size: "xlarge", label: "XL" },
              ].map((option) => (
                <button
                  key={`font-${option.size}`}
                  onClick={() =>
                    handleFontSizeChange(
                      option.size as "small" | "medium" | "large" | "xlarge"
                    )
                  }
                  className={`flex-1 py-2 rounded-lg transition-all duration-200 ${
                    currentFontSize === option.size
                      ? "bg-white/20 ring-2 ring-white/50"
                      : "bg-white/5 hover:bg-white/10"
                  } flex items-center justify-center`}
                  title={`${option.size} font`}
                >
                  <span className="text-white/90 font-medium">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Background options - only for rectangle and circle */}
      {showBackgroundOptions && (
        <>
          <div className="w-full h-px bg-white/10 my-2"></div>

          <div className="my-3">
            <div className="text-white/80 text-xs font-medium mb-2.5">
              <span>Background</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {/* Transparent option */}
              <button
                onClick={() => handleBgColorChange(undefined)}
                className={`w-9 h-9 rounded-md transition-all duration-200 bg-transparent ${
                  currentBgColor === "transparent"
                    ? "ring-2 ring-white/70 shadow-md"
                    : "ring-1 ring-white/20 hover:ring-white/40"
                } flex items-center justify-center`}
              >
                <XIcon size={14} className="text-white/80" />
              </button>

              {/* Color options */}
              {colors.slice(0, 7).map((color) => (
                <button
                  key={`bg-${color}`}
                  onClick={() => handleBgColorChange(color)}
                  style={{ backgroundColor: color }}
                  className={`w-9 h-9 rounded-md transition-all duration-200 ${
                    currentBgColor === color
                      ? "ring-2 ring-white/70 shadow-md"
                      : "hover:scale-105 hover:ring-1 hover:ring-white/40"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="w-full h-px bg-white/10 my-2"></div>

          <div className="mt-3">
            <div className="text-white/80 text-xs font-medium mb-2.5">
              <span>Fill Style</span>
            </div>

            <div className="flex justify-between gap-2">
              {/* Fill pattern options */}
              <button
                onClick={() => handleFillPatternChange("solid")}
                className={`flex-1 py-2 rounded-lg transition-all duration-200 ${
                  currentFillPattern === "solid"
                    ? "bg-white/20 ring-2 ring-white/50"
                    : "bg-white/5 hover:bg-white/10"
                } flex items-center justify-center`}
                title="Solid Fill"
              >
                <div className="w-6 h-6 bg-white/70 rounded-sm"></div>
              </button>

              <button
                onClick={() => handleFillPatternChange("hachure")}
                className={`flex-1 py-2 rounded-lg transition-all duration-200 ${
                  currentFillPattern === "hachure"
                    ? "bg-white/20 ring-2 ring-white/50"
                    : "bg-white/5 hover:bg-white/10"
                } flex items-center justify-center`}
                title="Diagonal Lines"
              >
                <div
                  className="w-6 h-6 bg-white/70 rounded-sm"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)",
                  }}
                ></div>
              </button>

              <button
                onClick={() => handleFillPatternChange("cross-hatch")}
                className={`flex-1 py-2 rounded-lg transition-all duration-200 ${
                  currentFillPattern === "cross-hatch"
                    ? "bg-white/20 ring-2 ring-white/50"
                    : "bg-white/5 hover:bg-white/10"
                } flex items-center justify-center`}
                title="Cross-Hatch"
              >
                <div
                  className="w-6 h-6 bg-white/70 rounded-sm"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px), repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)",
                  }}
                ></div>
              </button>
            </div>
          </div>
        </>
      )}
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

// Function to determine if the color bar should be shown
function shouldShowColorBar(tool: Tool, selectedShape: Shape | null): boolean {
  // Always show for drawing tools
  if (
    tool === "rectangle" ||
    tool === "circle" ||
    tool === "line" ||
    tool === "pencil" ||
    tool === "text"
  ) {
    return true;
  }

  // Show when a shape is selected with the select tool
  if (tool === "select" && selectedShape) {
    return true;
  }

  // Hide for pan and eraser tools
  return false;
}
