import { generateId } from "@/utils/generateId";
import { getExistingShapes } from "./http";
import { pointToLineDistance } from "@/utils/pointToLineDistance";

type Tool =
  | "circle"
  | "rectangle"
  | "line"
  | "eraser"
  | "pencil"
  | "text"
  | "pan";

export type Shape =
  | {
      id?: number;
      shape: {
        type: "rectangle";
        strokeColor: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }
  | {
      id?: number;
      shape: {
        strokeColor: string;
        type: "circle";
        centerX: number;
        centerY: number;
        radius: number;
      };
    }
  | {
      id?: number;
      shape: {
        strokeColor: string;
        type: "line";
        startX: number;
        startY: number;
        endX: number;
        endY: number;
      };
    }
  | {
      id?: number;
      shape: {
        strokeColor: string;
        type: "pencil";
        points: { x: number; y: number }[];
      };
    }
  | {
      id?: number;
      shape: {
        strokeColor: string;
        type: "text";
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private existingShapes: Shape[];
  private roomId: string;
  private socket: WebSocket | null;
  private clicked: boolean;
  private startX: number = 0;
  private startY: number = 0;
  private selectedTool = "pencil";
  private currentPath: { x: number; y: number }[] = [];
  private strokeColor: string = "white";
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private isDragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private redoStack: { type: "add" | "delete"; shapes: Shape[] }[] = [];
  private operationsStack: { type: "add" | "delete"; shapes: Shape[] }[] = [];
  private guestMode: boolean = false;
  constructor(
    canvas: HTMLCanvasElement,
    roomId: string,
    socket: WebSocket | null,
    zoomOnScroll: boolean = false,
    guestMode: boolean = false
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.existingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.clicked = false;
    this.guestMode = guestMode;
    this.init();
    this.initHandlers();
    if (zoomOnScroll) {
      this.initZoomHandler();
    }
    this.initMouseHandlers();
  }

  setTool(tool: Tool) {
    this.selectedTool = tool;
  }

  addText(text: string, x: number, y: number) {
    const newShape: Shape = {
      id: generateId(),
      shape: {
        type: "text",
        strokeColor: this.strokeColor,
        text,
        x,
        y: y + 10,
        width: this.ctx.measureText(text).width + 20,
        height: 30,
      },
    };
    this.existingShapes.push(newShape);
    this.operationsStack.push({
      type: "add",
      shapes: [newShape],
    });

    this.clearRedoStack(); // Clear redo stack when new text is added
    if (!this.guestMode && this.socket) {
      // Only send to server if not in guest mode
      this.socket.send(
        JSON.stringify({
          type: "chat",
          message: JSON.stringify(newShape),
          roomId: Number(this.roomId),
        })
      );
    } else if (this.guestMode) {
      this.saveGuestCanvasData(); // Save to localStorage in guest mode
    }
    this.clearCanvas();
  }

  async init() {
    if (!this.guestMode) {
      this.existingShapes = await getExistingShapes(this.roomId);
    } else {
      const savedData = localStorage.getItem("guestCanvasData");
      if (savedData) {
        try {
          this.existingShapes = JSON.parse(savedData);
        } catch (e) {
          console.error("Failed to parse saved guest canvas data", e);
          this.existingShapes = [];
        }
      }
    }
    this.clearCanvas();
  }

  initHandlers() {
    if (!this.guestMode && this.socket) {
      this.socket.addEventListener("message", this.messageHandler);
    }
  }

  messageHandler = (event: MessageEvent) => {
    if (this.guestMode) return; // Skip in guest mode
    const message = JSON.parse(event.data);
    if (message.type === "chat") {
      const parsedShape = JSON.parse(message.message);
      this.existingShapes.push(parsedShape);
      this.clearCanvas();
    }
    if (message.type === "delete_message") {
      this.existingShapes = this.existingShapes.filter(
        (shape) => shape.id !== message.messageId
      );
      this.clearCanvas();
    }
  };
  setStrokeColor(color: string) {
    this.strokeColor = color;
  }
  clearCanvas() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgba(0,0,0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "white";
    // Apply transformations
    this.ctx.setTransform(
      this.scale,
      0,
      0,
      this.scale,
      this.offsetX,
      this.offsetY
    );
    this.existingShapes.map((element) => {
      if (element.shape.type === "rectangle") {
        this.ctx.strokeStyle = element.shape.strokeColor || "white";
        this.ctx.strokeRect(
          element.shape.x,
          element.shape.y,
          element.shape.width,
          element.shape.height
        );
      } else if (element.shape.type === "circle") {
        this.ctx.strokeStyle = element.shape.strokeColor || "white";
        this.ctx.beginPath();
        this.ctx.arc(
          element.shape.centerX,
          element.shape.centerY,
          element.shape.radius,
          0,
          Math.PI * 2
        );
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (element.shape.type === "line") {
        this.ctx.strokeStyle = element.shape.strokeColor || "white";
        this.ctx.beginPath();
        this.ctx.moveTo(element.shape.startX, element.shape.startY);
        this.ctx.lineTo(element.shape.endX, element.shape.endY);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (
        element.shape.type === "pencil" &&
        element.shape.points?.length > 0
      ) {
        this.ctx.strokeStyle = element.shape.strokeColor || "white";
        this.ctx.beginPath();
        this.ctx.moveTo(element.shape.points[0].x, element.shape.points[0].y);
        for (const point of element.shape.points) {
          this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (element.shape.type === "text") {
        this.ctx.fillStyle = element.shape.strokeColor || "white";
        this.ctx.font = "20px Arial";
        this.ctx.fillText(element.shape.text, element.shape.x, element.shape.y);
      }
    });
  }

  private initZoomHandler() {
    this.canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.scale *= delta;
      this.scale = Math.min(Math.max(0.1, this.scale), 10);
      this.clearCanvas();
    });
  }

  getScale() {
    return this.scale;
  }

  getOffsetX() {
    return this.offsetX;
  }

  getOffsetY() {
    return this.offsetY;
  }

  zoomIn() {
    this.scale += 0.1;
    this.scale = Math.min(this.scale, 10);
    this.clearCanvas();
  }

  zoomOut() {
    this.scale -= 0.1;
    this.scale = Math.max(this.scale, 0.1);
    this.clearCanvas();
  }
  exportAsPNG(): string {
    // Create a temporary canvas with the same dimensions
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d")!;

    // Set the temp canvas to the same size
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;

    tempCtx.fillStyle = "black";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage(this.canvas, 0, 0); // Draw the current canvas content onto the temp canvas

    return tempCanvas.toDataURL("image/png");
  }

  undo() {
    if (this.operationsStack.length === 0) return;

    const lastOperation = this.operationsStack.pop();
    if (!lastOperation) return;

    if (lastOperation.type === "add") {
      // Remove the added shapes
      lastOperation.shapes.forEach((shape) => {
        const index = this.existingShapes.findIndex((s) => s.id === shape.id);
        if (index >= 0) {
          this.existingShapes.splice(index, 1);
          // Send delete message to server
          if (shape.id) {
            this.socket?.send(
              JSON.stringify({
                type: "delete_message",
                roomId: Number(this.roomId),
                messageId: shape.id,
              })
            );
          }
        }
      });
    } else if (lastOperation.type === "delete") {
      // Add back the deleted shapes
      lastOperation.shapes.forEach((shape) => {
        this.existingShapes.push(shape);
        // Send add message to server
        if (shape.id && !this.guestMode && this.socket) {
          // Only send to server if not in guest mode
          this.socket.send(
            JSON.stringify({
              type: "chat",
              message: JSON.stringify(shape),
              roomId: Number(this.roomId),
            })
          );
        } else if (this.guestMode) {
          this.saveGuestCanvasData(); // Save to localStorage in guest mode
        }
      });
    }
    this.redoStack.push(lastOperation);
    if (this.guestMode) {
      this.saveGuestCanvasData();
    }
    this.clearCanvas();
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const operationToRedo = this.redoStack.pop();
    if (!operationToRedo) return;

    if (operationToRedo.type === "add") {
      // Re-add the shapes
      operationToRedo.shapes.forEach((shape) => {
        this.existingShapes.push(shape);
        // Send add message to server
        if (shape.id && !this.guestMode && this.socket) {
          // Only send to server if not in guest mode
          this.socket.send(
            JSON.stringify({
              type: "chat",
              message: JSON.stringify(shape),
              roomId: Number(this.roomId),
            })
          );
        } else if (this.guestMode) {
          this.saveGuestCanvasData(); // Save to localStorage in guest mode
        }
      });
    } else if (operationToRedo.type === "delete") {
      // Re-delete the shapes
      operationToRedo.shapes.forEach((shape) => {
        const index = this.existingShapes.findIndex((s) => s.id === shape.id);
        if (index >= 0) {
          this.existingShapes.splice(index, 1);
          // Send delete message to server
          if (shape.id && !this.guestMode && this.socket) {
            this.socket.send(
              JSON.stringify({
                type: "delete_message",
                roomId: Number(this.roomId),
                messageId: shape.id,
              })
            );
          }
        }
      });
    }

    this.operationsStack.push(operationToRedo);

    if (this.guestMode) {
      this.saveGuestCanvasData();
    }

    this.clearCanvas();
  }

  canUndo(): boolean {
    return this.operationsStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clearRedoStack() {
    this.redoStack = [];
  }

  saveGuestCanvasData() {
    if (this.guestMode) {
      localStorage.setItem(
        "guestCanvasData",
        JSON.stringify(this.existingShapes)
      );
    }
  }

  mouseDownHandler = (e: MouseEvent) => {
    // Only proceed with left click (button 0) for most tools
    // or middle click (button 1) for panning
    if (e.button !== 0 && e.button !== 1 && this.selectedTool !== "pan") {
      return;
    }

    // For middle mouse button (wheel),disable panning only on right click
    const isPanning =
      (e.button !== 2 && this.selectedTool === "pan") || e.button === 1;
    this.clicked = true;
    this.startX = (e.clientX - this.offsetX) / this.scale;
    this.startY = (e.clientY - this.offsetY) / this.scale;

    if (isPanning) {
      console.log("Middle mouse button clicked and panning now");

      this.isDragging = true;
      document.body.style.cursor = "grabbing";
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      return;
    }

    if (this.selectedTool === "eraser") {
      const eraserRadius = 8;
      const transformedX = (e.clientX - this.offsetX) / this.scale;
      const transformedY = (e.clientY - this.offsetY) / this.scale;
      const eraserX = transformedX + eraserRadius; // Adjust the x-coordinate to center the eraser
      const eraserY = transformedY + eraserRadius; // Adjust the y-coordinate to center the eraser
      const shapesToDelete: Shape[] = [];
      this.existingShapes = this.existingShapes.filter((element) => {
        let shouldKeep = true;

        if (element.shape.type === "rectangle") {
          const rect = element.shape;
          const tolerance = 5;

          const distToTop = pointToLineDistance(
            eraserX,
            eraserY,
            rect.x,
            rect.y,
            rect.x + rect.width,
            rect.y
          );

          const distToRight = pointToLineDistance(
            eraserX,
            eraserY,
            rect.x + rect.width,
            rect.y,
            rect.x + rect.width,
            rect.y + rect.height
          );

          const distToBottom = pointToLineDistance(
            eraserX,
            eraserY,
            rect.x,
            rect.y + rect.height,
            rect.x + rect.width,
            rect.y + rect.height
          );

          const distToLeft = pointToLineDistance(
            eraserX,
            eraserY,
            rect.x,
            rect.y,
            rect.x,
            rect.y + rect.height
          );

          shouldKeep = !(
            distToTop <= tolerance ||
            distToRight <= tolerance ||
            distToBottom <= tolerance ||
            distToLeft <= tolerance
          );
        } else if (element.shape.type === "circle") {
          const dist = Math.sqrt(
            (eraserX - element.shape.centerX) ** 2 +
              (eraserY - element.shape.centerY) ** 2
          );
          const distanceFromPerimeter = Math.abs(dist - element.shape.radius);
          const tolerance = 5;
          shouldKeep = distanceFromPerimeter > tolerance;
        } else if (element.shape.type === "line") {
          const distance = pointToLineDistance(
            eraserX,
            eraserY,
            element.shape.startX,
            element.shape.startY,
            element.shape.endX,
            element.shape.endY
          );

          shouldKeep = distance > 5;
        } else if (element.shape.type === "pencil") {
          const isPointInPoints = element.shape.points.some(
            (point) =>
              (point.x === eraserX && point.y === eraserY) ||
              (Math.abs(point.x - eraserX) < 10 &&
                Math.abs(point.y - eraserY) < 10)
          );
          shouldKeep = !isPointInPoints;
        } else if (element.shape.type === "text") {
          shouldKeep = !(
            eraserX >= element.shape.x &&
            eraserX <= element.shape.x + element.shape.width &&
            eraserY >= element.shape.y - element.shape.height && // Adjust for text baseline
            eraserY <= element.shape.y
          );
        }

        if (!shouldKeep) {
          shapesToDelete.push(element);
          if (!this.guestMode && this.socket) {
            this.socket.send(
              JSON.stringify({
                type: "delete_message",
                roomId: Number(this.roomId),
                messageId: element.id,
              })
            );
          }
        }
        return shouldKeep;
      });

      // Add the delete operation to the operations stack
      if (shapesToDelete.length > 0) {
        this.operationsStack.push({
          type: "delete",
          shapes: shapesToDelete,
        });

        this.clearRedoStack();

        if (this.guestMode) {
          this.saveGuestCanvasData();
        }
      }
      this.clearCanvas();
      return;
    }
  };
  mouseUpHandler = (e: MouseEvent) => {
    // Only handle left or middle mouse button releases
    if (e.button !== 0 && e.button !== 1) {
      return;
    }
    this.isDragging = false;
    this.clicked = false;

    // If it was a middle mouse button (wheel) for panning, just reset cursor
    if (e.button === 1) {
      // Reset cursor based on the currently selected tool
      if (this.selectedTool === "text") {
        document.body.style.cursor = "text";
      } else if (this.selectedTool === "eraser") {
        document.body.style.cursor = "url('/circle.png'), auto";
      } else if (this.selectedTool === "pan") {
        document.body.style.cursor = "grab";
      } else {
        document.body.style.cursor = "crosshair";
      }
      return;
    }

    const transformedX = (e.clientX - this.offsetX) / this.scale;
    const transformedY = (e.clientY - this.offsetY) / this.scale;

    const width = transformedX - this.startX;
    const height = transformedY - this.startY;

    const selectedTool = this.selectedTool;
    let newShape: Shape | null = null;
    if (selectedTool === "rectangle") {
      newShape = {
        id: generateId(),
        shape: {
          type: "rectangle",
          strokeColor: this.strokeColor,
          x: Math.min(this.startX, transformedX),
          y: Math.min(this.startY, transformedY),
          height: Math.abs(height),
          width: Math.abs(width),
        },
      };
    } else if (selectedTool === "circle") {
      const radius = Math.sqrt(height ** 2 + width ** 2) / 2;
      newShape = {
        id: generateId(),
        shape: {
          type: "circle",
          strokeColor: this.strokeColor,
          radius,
          centerX: this.startX + width / 2,
          centerY: this.startY + height / 2,
        },
      };
    } else if (selectedTool === "line") {
      newShape = {
        id: generateId(),
        shape: {
          type: "line",
          strokeColor: this.strokeColor,
          startX: this.startX,
          startY: this.startY,
          endX: transformedX,
          endY: transformedY,
        },
      };
    } else if (selectedTool === "pencil" && this.currentPath.length > 0) {
      newShape = {
        id: generateId(),
        shape: {
          type: "pencil",
          strokeColor: this.strokeColor,
          points: this.currentPath,
        },
      };
      this.currentPath = []; // Reset path after creating shape
      this.existingShapes.push(newShape);
      this.operationsStack.push({
        type: "add",
        shapes: [newShape],
      });
      this.clearRedoStack(); // Clear redo stack when new shape is added
      if (!this.guestMode && this.socket) {
        // Only send to server if not in guest mode
        this.socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify(newShape),
            roomId: Number(this.roomId),
          })
        );
      } else if (this.guestMode) {
        this.saveGuestCanvasData(); // Save to localStorage in guest mode
      }
      return; // Exit early for pencil tool
    } else if (selectedTool === "pan") {
      document.body.style.cursor = "grab";
    }
    if (!newShape) {
      return;
    }
    this.existingShapes.push(newShape);
    this.operationsStack.push({
      type: "add",
      shapes: [newShape],
    });

    this.clearRedoStack();

    if (!this.guestMode && this.socket) {
      // Only send to server if not in guest mode
      this.socket.send(
        JSON.stringify({
          type: "chat",
          message: JSON.stringify(newShape),
          roomId: Number(this.roomId),
        })
      );
    } else if (this.guestMode) {
      this.saveGuestCanvasData(); // Save to localStorage in guest mode
    }

    this.clearCanvas();
  };
  mouseMoveHandler = (e: MouseEvent) => {
    if (this.isDragging) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.clearCanvas();
      return;
    }
    if (this.clicked) {
      const transformedX = (e.clientX - this.offsetX) / this.scale;
      const transformedY = (e.clientY - this.offsetY) / this.scale;
      const width = transformedX - this.startX;
      const height = transformedY - this.startY;

      this.clearCanvas();
      this.ctx.strokeStyle = this.strokeColor || "rgba(255, 255, 255)";

      if (this.selectedTool === "rectangle") {
        this.ctx.strokeRect(
          Math.min(this.startX, transformedX),
          Math.min(this.startY, transformedY),
          Math.abs(width),
          Math.abs(height)
        );
      } else if (this.selectedTool === "circle") {
        const radius = Math.sqrt(width ** 2 + height ** 2) / 2;
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (this.selectedTool === "line") {
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(transformedX, transformedY);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (this.selectedTool === "pencil") {
        this.currentPath.push({ x: transformedX, y: transformedY });
        this.clearCanvas();
        // Draw the current path
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.strokeColor; // Add this line
        this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
        for (const point of this.currentPath) {
          this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.stroke();
      }
    }
  };

  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault()); // Prevent right-click context menu
  }

  destroy() {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    this.socket?.removeEventListener("message", this.messageHandler);
    // Save guest data when destroying
    if (this.guestMode) {
      this.saveGuestCanvasData();
    }
  }
}
