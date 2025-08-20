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
  | "pan"
  | "select";

export type Shape =
  | {
      id?: number;
      shape: {
        type: "rectangle";
        strokeColor: string;
        strokeWidth?: number;
        backgroundColor?: string;
        fillPattern?: "solid" | "hachure" | "cross-hatch";
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
        strokeWidth?: number;
        type: "circle";
        backgroundColor?: string;
        fillPattern?: "solid" | "hachure" | "cross-hatch";
        centerX: number;
        centerY: number;
        radius: number;
      };
    }
  | {
      id?: number;
      shape: {
        strokeColor: string;
        strokeWidth?: number;
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
        strokeWidth?: number;
        type: "pencil";
        points: { x: number; y: number }[];
      };
    }
  | {
      id?: number;
      shape: {
        strokeColor: string;
        fontSize?: "small" | "medium" | "large" | "xlarge";
        type: "text";
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
type Operation =
  | { type: "add"; shapes: Shape[] }
  | { type: "delete"; shapes: Shape[] }
  | { type: "move"; originalShape: Shape; newShape: Shape; index: number }
  | {
      type: "propertyChange";
      originalShape: Shape;
      newShape: Shape;
      index: number;
      property:
        | "strokeColor"
        | "strokeWidth"
        | "backgroundColor"
        | "fillPattern"
        | "fontSize";
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
  private selectedTool: Tool = "pencil";
  private currentPath: { x: number; y: number }[] = [];
  private strokeColor: string = "white";
  private strokeWidth: number = 1;
  private backgroundColor: string | undefined = undefined;
  private fillPattern: "solid" | "hachure" | "cross-hatch" = "solid";
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private isDragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private redoStack: Operation[] = [];
  private operationsStack: Operation[] = [];
  private guestMode: boolean = false;

  // select and move related properties
  private selectedShape: Shape | null = null;
  private selectedShapeIndex: number = -1;
  private isMovingShape: boolean = false;
  private moveStartX: number = 0;
  private moveStartY: number = 0;
  private originalShapeBeforeMove: Shape | null = null;
  private onShapePropertyChange: (() => void) | null = null;

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

  getTool(): Tool {
    return this.selectedTool;
  }
  setTool(tool: Tool) {
    if (this.selectedTool === "select" && tool !== "select") {
      this.clearSelection();
    }
    this.selectedTool = tool;
  }

  addText(
    text: string,
    x: number,
    y: number,
    fontSize: "small" | "medium" | "large" | "xlarge" = "medium"
  ) {
    let fontSizePx = 20;
    let heightPx = 30;

    if (fontSize === "small") {
      fontSizePx = 14;
      heightPx = 20;
    } else if (fontSize === "medium") {
      fontSizePx = 20;
      heightPx = 30;
    } else if (fontSize === "large") {
      fontSizePx = 28;
      heightPx = 40;
    } else if (fontSize === "xlarge") {
      fontSizePx = 36;
      heightPx = 50;
    }

    // Set font for measuring text width
    this.ctx.font = `${fontSizePx}px Arial`;
    const newShape: Shape = {
      id: generateId(),
      shape: {
        type: "text",
        strokeColor: this.strokeColor,
        fontSize: fontSize,
        text,
        x,
        y: y + fontSizePx / 2, // Adjust y position based on font size
        width: this.ctx.measureText(text).width + 20,
        height: heightPx,
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
    this.selectedShape = newShape;
    this.selectedShapeIndex = this.existingShapes.length - 1;
    document.body.style.cursor = "pointer";
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
  setStrokeWidth(width: number) {
    this.strokeWidth = width;
  }
  setBackgroundColor(color: string | undefined) {
    this.backgroundColor = color;
  }

  setFillPattern(pattern: "solid" | "hachure" | "cross-hatch") {
    this.fillPattern = pattern;
  }

  setOnShapePropertyChange(callback: () => void) {
    this.onShapePropertyChange = callback;
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
        // Draw background if it exists
        if (element.shape.backgroundColor) {
          this.ctx.fillStyle = element.shape.backgroundColor;
          // Apply fill pattern if specified
          if (element.shape.fillPattern) {
            this.applyFillPattern(
              element.shape.x,
              element.shape.y,
              element.shape.width,
              element.shape.height,
              element.shape.fillPattern,
              element.shape.backgroundColor
            );
          } else {
            // Simple fill
            this.ctx.fillRect(
              element.shape.x,
              element.shape.y,
              element.shape.width,
              element.shape.height
            );
          }
        }
        // Draw stroke
        this.ctx.strokeStyle = element.shape.strokeColor || "white";
        this.ctx.lineWidth = element.shape.strokeWidth || 1;
        this.ctx.strokeRect(
          element.shape.x,
          element.shape.y,
          element.shape.width,
          element.shape.height
        );
      } else if (element.shape.type === "circle") {
        // Draw background if it exists
        if (element.shape.backgroundColor) {
          this.ctx.fillStyle = element.shape.backgroundColor;
          this.ctx.beginPath();
          this.ctx.arc(
            element.shape.centerX,
            element.shape.centerY,
            element.shape.radius,
            0,
            Math.PI * 2
          );

          // Apply fill pattern if specified
          if (element.shape.fillPattern) {
            this.applyCircleFillPattern(
              element.shape.centerX,
              element.shape.centerY,
              element.shape.radius,
              element.shape.fillPattern,
              element.shape.backgroundColor
            );
          } else {
            // Simple fill
            this.ctx.fill();
          }
        }

        // Draw stroke
        this.ctx.strokeStyle = element.shape.strokeColor || "white";
        this.ctx.lineWidth = element.shape.strokeWidth || 1;
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
        this.ctx.lineWidth = element.shape.strokeWidth || 1;
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
        this.ctx.lineWidth = element.shape.strokeWidth || 1;
        this.ctx.beginPath();
        this.ctx.moveTo(element.shape.points[0].x, element.shape.points[0].y);
        for (const point of element.shape.points) {
          this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (element.shape.type === "text") {
        this.ctx.fillStyle = element.shape.strokeColor || "white";
        let fontSizePx = 20;
        if (element.shape.fontSize === "small") fontSizePx = 14;
        else if (element.shape.fontSize === "medium") fontSizePx = 20;
        else if (element.shape.fontSize === "large") fontSizePx = 28;
        else if (element.shape.fontSize === "xlarge") fontSizePx = 36;

        this.ctx.font = `${fontSizePx}px Arial`;
        this.ctx.fillText(element.shape.text, element.shape.x, element.shape.y);
      }
      // Reset line width to default after drawing
      this.ctx.lineWidth = 1;
    });

    if (this.selectedShape) {
      this.drawSelectionOutline();
    }
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

  getSelectedShape() {
    return this.selectedShape;
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
    } else if (
      lastOperation.type === "move" ||
      lastOperation.type === "propertyChange"
    ) {
      // Undo the operation by restoring the original shape
      if (
        lastOperation.index >= 0 &&
        lastOperation.index < this.existingShapes.length
      ) {
        // Replace the current shape with the original shape
        this.existingShapes[lastOperation.index] = lastOperation.originalShape;

        // If not in guest mode, update the server
        if (!this.guestMode && this.socket) {
          // Delete the modified shape
          if (lastOperation.newShape.id) {
            this.socket.send(
              JSON.stringify({
                type: "delete_message",
                roomId: Number(this.roomId),
                messageId: lastOperation.newShape.id,
              })
            );
          }

          // Send the original shape
          this.socket.send(
            JSON.stringify({
              type: "chat",
              message: JSON.stringify(lastOperation.originalShape),
              roomId: Number(this.roomId),
            })
          );
        }

        // Update selection to point to the restored shape
        if (
          this.selectedShape &&
          this.selectedShape.id === lastOperation.newShape.id
        ) {
          this.selectedShape = lastOperation.originalShape;
        }
      }
    }

    this.redoStack.push(lastOperation);
    if (this.guestMode) {
      this.saveGuestCanvasData();
    }
    this.clearSelection();
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
    } else if (
      operationToRedo.type === "move" ||
      operationToRedo.type === "propertyChange"
    ) {
      // Redo a move or property change operation by applying the new shape
      if (
        operationToRedo.index >= 0 &&
        operationToRedo.index < this.existingShapes.length
      ) {
        // Replace the current shape with the modified shape
        this.existingShapes[operationToRedo.index] = operationToRedo.newShape;

        // If not in guest mode, update the server
        if (!this.guestMode && this.socket) {
          // Delete the original shape
          if (operationToRedo.originalShape.id) {
            this.socket.send(
              JSON.stringify({
                type: "delete_message",
                roomId: Number(this.roomId),
                messageId: operationToRedo.originalShape.id,
              })
            );
          }

          // Send the modified shape
          this.socket.send(
            JSON.stringify({
              type: "chat",
              message: JSON.stringify(operationToRedo.newShape),
              roomId: Number(this.roomId),
            })
          );
        }

        // Update selection to point to the modified shape
        if (
          this.selectedShape &&
          this.selectedShape.id === operationToRedo.originalShape.id
        ) {
          this.selectedShape = operationToRedo.newShape;
        }
      }
    }

    this.operationsStack.push(operationToRedo);

    if (this.guestMode) {
      this.saveGuestCanvasData();
    }
    this.clearSelection();
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

  // Find the shape at the given position
  private findShapeAtPosition(
    x: number,
    y: number
  ): { shape: Shape; index: number } | null {
    // Check shapes in reverse order (top-most first)
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      const element = this.existingShapes[i];

      if (element.shape.type === "rectangle") {
        const rect = element.shape;
        const tolerance = 5; // 5px tolerance for selection

        // Check if the point is near any of the four edges
        const distToTop = pointToLineDistance(
          x,
          y,
          rect.x,
          rect.y,
          rect.x + rect.width,
          rect.y
        );

        const distToRight = pointToLineDistance(
          x,
          y,
          rect.x + rect.width,
          rect.y,
          rect.x + rect.width,
          rect.y + rect.height
        );

        const distToBottom = pointToLineDistance(
          x,
          y,
          rect.x,
          rect.y + rect.height,
          rect.x + rect.width,
          rect.y + rect.height
        );

        const distToLeft = pointToLineDistance(
          x,
          y,
          rect.x,
          rect.y,
          rect.x,
          rect.y + rect.height
        );

        // If the point is close to any edge, select the rectangle
        if (
          distToTop <= tolerance ||
          distToRight <= tolerance ||
          distToBottom <= tolerance ||
          distToLeft <= tolerance
        ) {
          return { shape: element, index: i };
        }
      } else if (element.shape.type === "circle") {
        const circle = element.shape;
        const dist = Math.sqrt(
          (x - circle.centerX) ** 2 + (y - circle.centerY) ** 2
        );

        // Check if the point is near the circumference
        const distanceFromPerimeter = Math.abs(dist - circle.radius);
        const tolerance = 5; // 5px tolerance

        if (distanceFromPerimeter <= tolerance) {
          return { shape: element, index: i };
        }
      } else if (element.shape.type === "line") {
        const line = element.shape;
        const distance = pointToLineDistance(
          x,
          y,
          line.startX,
          line.startY,
          line.endX,
          line.endY
        );

        if (distance <= 5) {
          // 5px tolerance
          return { shape: element, index: i };
        }
      } else if (element.shape.type === "pencil") {
        // For pencil, check if any point is close to the cursor
        for (let j = 0; j < element.shape.points.length - 1; j++) {
          const point1 = element.shape.points[j];
          const point2 = element.shape.points[j + 1];

          // Check distance to the line segment between consecutive points
          const distance = pointToLineDistance(
            x,
            y,
            point1.x,
            point1.y,
            point2.x,
            point2.y
          );

          if (distance <= 5) {
            // 5px tolerance
            return { shape: element, index: i };
          }
        }
      } else if (element.shape.type === "text") {
        const textTop = element.shape.y - element.shape.height;

        if (
          x >= element.shape.x - 5 &&
          x <= element.shape.x + element.shape.width + 5 &&
          y >= textTop - 5 &&
          y <= element.shape.y + 5
        ) {
          return { shape: element, index: i };
        }
      }
    }
    return null;
  }

  // Draw the selection outline around the selected shape
  private drawSelectionOutline() {
    if (!this.selectedShape) return;

    this.ctx.setLineDash([5, 5]); // Dashed line
    this.ctx.strokeStyle = "#00AAFF"; // Bright blue for selection
    this.ctx.lineWidth = 2;

    const shape = this.selectedShape.shape;

    if (shape.type === "rectangle") {
      this.ctx.strokeRect(
        shape.x - 5,
        shape.y - 5,
        shape.width + 10,
        shape.height + 10
      );
    } else if (shape.type === "circle") {
      this.ctx.beginPath();
      this.ctx.arc(
        shape.centerX,
        shape.centerY,
        shape.radius + 5,
        0,
        Math.PI * 2
      );
      this.ctx.stroke();
    } else if (shape.type === "line") {
      // Draw a slightly larger line
      this.ctx.beginPath();
      this.ctx.moveTo(shape.startX, shape.startY);
      this.ctx.lineTo(shape.endX, shape.endY);
      this.ctx.stroke();

      // Draw handles at the endpoints
      this.ctx.fillStyle = "#00AAFF";
      this.ctx.beginPath();
      this.ctx.arc(shape.startX, shape.startY, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(shape.endX, shape.endY, 5, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (shape.type === "pencil") {
      // Draw a bounding box around the pencil path
      let minX = Infinity,
        minY = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity;

      for (const point of shape.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }

      this.ctx.strokeRect(
        minX - 5,
        minY - 5,
        maxX - minX + 10,
        maxY - minY + 10
      );
    } else if (shape.type === "text") {
      this.ctx.strokeRect(
        shape.x,
        shape.y - shape.height + 10, // Adjust this value to position the box correctly
        shape.width - 20, // Adjust this value to position the box correctly
        shape.height - 5 // Adjust this value to position the box correctly
      );
    }

    // Reset line style
    this.ctx.setLineDash([]);
    this.ctx.lineWidth = 1;
  }

  // clear the selection
  clearSelection() {
    this.selectedShape = null;
    this.selectedShapeIndex = -1;
    this.isMovingShape = false;
    this.clearCanvas(); // Redraw without selection outline
  }

  // Helper method to apply fill patterns
  private applyFillPattern(
    x: number,
    y: number,
    width: number,
    height: number,
    pattern: "solid" | "hachure" | "cross-hatch",
    color: string
  ) {
    if (pattern === "solid") {
      this.ctx.fillRect(x, y, width, height);
      return;
    }

    // Save current state
    this.ctx.save();

    // Create clipping region
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    this.ctx.clip();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;

    const spacing = 8; // Spacing between lines

    if (pattern === "hachure" || pattern === "cross-hatch") {
      // Draw diagonal lines (/)
      for (let i = -height; i < width + height; i += spacing) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + i, y);
        this.ctx.lineTo(x + i + height, y + height);
        this.ctx.stroke();
      }
    }

    if (pattern === "cross-hatch") {
      // Draw diagonal lines in the other direction (\)
      for (let i = -height; i < width + height; i += spacing) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + i, y + height);
        this.ctx.lineTo(x + i + height, y);
        this.ctx.stroke();
      }
    }

    // Restore context
    this.ctx.restore();
  }

  // Helper method to apply fill patterns to circles
  private applyCircleFillPattern(
    centerX: number,
    centerY: number,
    radius: number,
    pattern: "solid" | "hachure" | "cross-hatch",
    color: string
  ) {
    if (pattern === "solid") {
      this.ctx.fill();
      return;
    }

    // Save current state
    this.ctx.save();

    // Create clipping region (circle)
    this.ctx.clip();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;

    const spacing = 8; // Spacing between lines
    const diameter = radius * 2;
    const x = centerX - radius;
    const y = centerY - radius;

    if (pattern === "hachure" || pattern === "cross-hatch") {
      // Draw diagonal lines (/)
      for (let i = -diameter; i < diameter * 2; i += spacing) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + i, y);
        this.ctx.lineTo(x + i + diameter, y + diameter);
        this.ctx.stroke();
      }
    }

    if (pattern === "cross-hatch") {
      // Draw diagonal lines in the other direction (\)
      for (let i = -diameter; i < diameter * 2; i += spacing) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + i, y + diameter);
        this.ctx.lineTo(x + i + diameter, y);
        this.ctx.stroke();
      }
    }

    // Restore context
    this.ctx.restore();
  }

  // Update the stroke color of the selected shape
  updateSelectedShapeStrokeColor(color: string) {
    if (!this.selectedShape) return;

    const originalShape = JSON.parse(JSON.stringify(this.selectedShape));

    this.selectedShape.shape.strokeColor = color;

    // Update the shape in the array
    if (this.selectedShapeIndex >= 0) {
      this.existingShapes[this.selectedShapeIndex] = this.selectedShape;
    }

    // Add to operations stack
    this.operationsStack.push({
      type: "propertyChange",
      originalShape: originalShape,
      newShape: JSON.parse(JSON.stringify(this.selectedShape)),
      index: this.selectedShapeIndex,
      property: "strokeColor",
    });

    this.clearRedoStack();

    // Send the updated shape to the server if not in guest mode
    if (!this.guestMode && this.socket && this.selectedShape.id) {
      this.socket.send(
        JSON.stringify({
          type: "delete_message",
          roomId: Number(this.roomId),
          messageId: this.selectedShape.id,
        })
      );

      this.socket.send(
        JSON.stringify({
          type: "chat",
          message: JSON.stringify(this.selectedShape),
          roomId: Number(this.roomId),
        })
      );
    } else if (this.guestMode) {
      this.saveGuestCanvasData();
    }

    if (this.onShapePropertyChange) {
      this.onShapePropertyChange();
    }

    this.clearCanvas();
  }

  // Update the background color of the selected shape
  updateSelectedShapeBackgroundColor(color: string | undefined) {
    if (!this.selectedShape) return;

    // Only apply to rectangle and circle
    if (
      this.selectedShape.shape.type === "rectangle" ||
      this.selectedShape.shape.type === "circle"
    ) {
      const originalShape = JSON.parse(JSON.stringify(this.selectedShape));

      this.selectedShape.shape.backgroundColor = color;

      // Update the shape in the array
      if (this.selectedShapeIndex >= 0) {
        this.existingShapes[this.selectedShapeIndex] = this.selectedShape;
      }

      // Add to operations stack
      this.operationsStack.push({
        type: "propertyChange",
        originalShape: originalShape,
        newShape: JSON.parse(JSON.stringify(this.selectedShape)),
        index: this.selectedShapeIndex,
        property: "backgroundColor",
      });

      this.clearRedoStack();

      // Send the updated shape to the server if not in guest mode
      if (!this.guestMode && this.socket && this.selectedShape.id) {
        this.socket.send(
          JSON.stringify({
            type: "delete_message",
            roomId: Number(this.roomId),
            messageId: this.selectedShape.id,
          })
        );

        this.socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify(this.selectedShape),
            roomId: Number(this.roomId),
          })
        );
      } else if (this.guestMode) {
        this.saveGuestCanvasData();
      }
      if (this.onShapePropertyChange) {
        this.onShapePropertyChange();
      }

      this.clearCanvas();
    }
  }

  // Update the fill pattern of the selected shape
  updateSelectedShapeFillPattern(pattern: "solid" | "hachure" | "cross-hatch") {
    if (!this.selectedShape) return;

    // Only apply to rectangle and circle
    if (
      this.selectedShape.shape.type === "rectangle" ||
      this.selectedShape.shape.type === "circle"
    ) {
      const originalShape = JSON.parse(JSON.stringify(this.selectedShape));

      this.selectedShape.shape.fillPattern = pattern;

      // Update the shape in the array
      if (this.selectedShapeIndex >= 0) {
        this.existingShapes[this.selectedShapeIndex] = this.selectedShape;
      }

      // Add to operations stack
      this.operationsStack.push({
        type: "propertyChange",
        originalShape: originalShape,
        newShape: JSON.parse(JSON.stringify(this.selectedShape)),
        index: this.selectedShapeIndex,
        property: "fillPattern",
      });

      this.clearRedoStack();

      // Send the updated shape to the server if not in guest mode
      if (!this.guestMode && this.socket && this.selectedShape.id) {
        this.socket.send(
          JSON.stringify({
            type: "delete_message",
            roomId: Number(this.roomId),
            messageId: this.selectedShape.id,
          })
        );

        this.socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify(this.selectedShape),
            roomId: Number(this.roomId),
          })
        );
      } else if (this.guestMode) {
        this.saveGuestCanvasData();
      }

      if (this.onShapePropertyChange) {
        this.onShapePropertyChange();
      }

      this.clearCanvas();
    }
  }

  // Update the stroke width of the selected shape
  updateSelectedShapeStrokeWidth(width: number) {
    if (!this.selectedShape) return;

    // Don't apply to text
    if (this.selectedShape.shape.type !== "text") {
      const originalShape = JSON.parse(JSON.stringify(this.selectedShape));

      this.selectedShape.shape.strokeWidth = width;

      // Update the shape in the array
      if (this.selectedShapeIndex >= 0) {
        this.existingShapes[this.selectedShapeIndex] = this.selectedShape;
      }

      // Add to operations stack
      this.operationsStack.push({
        type: "propertyChange",
        originalShape: originalShape,
        newShape: JSON.parse(JSON.stringify(this.selectedShape)),
        index: this.selectedShapeIndex,
        property: "strokeWidth",
      });

      this.clearRedoStack();

      // Send the updated shape to the server if not in guest mode
      if (!this.guestMode && this.socket && this.selectedShape.id) {
        this.socket.send(
          JSON.stringify({
            type: "delete_message",
            roomId: Number(this.roomId),
            messageId: this.selectedShape.id,
          })
        );

        this.socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify(this.selectedShape),
            roomId: Number(this.roomId),
          })
        );
      } else if (this.guestMode) {
        this.saveGuestCanvasData();
      }
      if (this.onShapePropertyChange) {
        this.onShapePropertyChange();
      }
      this.clearCanvas();
    }
  }

  // Update the font size of the selected text
  updateSelectedTextFontSize(
    fontSize: "small" | "medium" | "large" | "xlarge"
  ) {
    if (!this.selectedShape) return;

    // Only apply to text
    if (this.selectedShape.shape.type === "text") {
      const originalShape = JSON.parse(JSON.stringify(this.selectedShape));

      this.selectedShape.shape.fontSize = fontSize;
      // Recalculate text dimensions based on new font size
      let fontSizePx = 20;
      let heightPx = 30;

      if (fontSize === "small") {
        fontSizePx = 14;
        heightPx = 20;
      } else if (fontSize === "medium") {
        fontSizePx = 20;
        heightPx = 30;
      } else if (fontSize === "large") {
        fontSizePx = 28;
        heightPx = 40;
      } else if (fontSize === "xlarge") {
        fontSizePx = 36;
        heightPx = 50;
      }

      // Set font for measuring text width
      this.ctx.font = `${fontSizePx}px Arial`;

      // Update the text dimensions
      this.selectedShape.shape.width =
        this.ctx.measureText(this.selectedShape.shape.text).width + 20;
      this.selectedShape.shape.height = heightPx;
      // Update the shape in the array
      if (this.selectedShapeIndex >= 0) {
        this.existingShapes[this.selectedShapeIndex] = this.selectedShape;
      }

      // Add to operations stack
      this.operationsStack.push({
        type: "propertyChange",
        originalShape: originalShape,
        newShape: JSON.parse(JSON.stringify(this.selectedShape)),
        index: this.selectedShapeIndex,
        property: "fontSize",
      });

      this.clearRedoStack();

      // Send the updated shape to the server if not in guest mode
      if (!this.guestMode && this.socket && this.selectedShape.id) {
        this.socket.send(
          JSON.stringify({
            type: "delete_message",
            roomId: Number(this.roomId),
            messageId: this.selectedShape.id,
          })
        );

        this.socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify(this.selectedShape),
            roomId: Number(this.roomId),
          })
        );
      } else if (this.guestMode) {
        this.saveGuestCanvasData();
      }
      if (this.onShapePropertyChange) {
        this.onShapePropertyChange();
      }
      this.clearCanvas();
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
      this.isDragging = true;
      document.body.style.cursor = "grabbing";
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      return;
    }

    // Handle selection tool
    if (this.selectedTool === "select") {
      const transformedX = (e.clientX - this.offsetX) / this.scale;
      const transformedY = (e.clientY - this.offsetY) / this.scale;

      const result = this.findShapeAtPosition(transformedX, transformedY);

      if (result) {
        this.selectedShape = result.shape;
        this.selectedShapeIndex = result.index;
        this.originalShapeBeforeMove = JSON.parse(JSON.stringify(result.shape));
        this.isMovingShape = true;
        this.moveStartX = transformedX;
        this.moveStartY = transformedY;
        document.body.style.cursor = "move";
      } else {
        // Clicked on empty space, deselect
        this.selectedShape = null;
        this.selectedShapeIndex = -1;
        document.body.style.cursor = "pointer";
      }

      this.clearCanvas();
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
      } else if (this.selectedTool === "select") {
        document.body.style.cursor = "pointer";
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
    // Handle finishing a shape move
    if (
      this.selectedTool === "select" &&
      this.isMovingShape &&
      this.selectedShape &&
      this.originalShapeBeforeMove
    ) {
      this.isMovingShape = false;

      // If the shape was actually moved, add to operations stack
      if (this.moveStartX !== this.startX || this.moveStartY !== this.startY) {
        // Use the stored original shape
        const newShape = JSON.parse(JSON.stringify(this.selectedShape));
        // Add the move operation to the operations stack
        this.operationsStack.push({
          type: "move",
          originalShape: this.originalShapeBeforeMove,
          newShape,
          index: this.selectedShapeIndex,
        });

        this.clearRedoStack();

        // Send the updated shape to the server
        if (!this.guestMode && this.socket) {
          // First delete the old shape
          if (this.selectedShape.id) {
            this.socket.send(
              JSON.stringify({
                type: "delete_message",
                roomId: Number(this.roomId),
                messageId: this.selectedShape.id,
              })
            );

            // Then send the updated shape
            this.socket.send(
              JSON.stringify({
                type: "chat",
                message: JSON.stringify(this.selectedShape),
                roomId: Number(this.roomId),
              })
            );
          }
        } else if (this.guestMode) {
          this.saveGuestCanvasData();
        }
      }

      document.body.style.cursor = "pointer";
      return;
    }
    if (selectedTool === "rectangle") {
      newShape = {
        id: generateId(),
        shape: {
          type: "rectangle",
          strokeColor: this.strokeColor,
          strokeWidth: this.strokeWidth,
          backgroundColor: this.backgroundColor,
          fillPattern: this.backgroundColor ? this.fillPattern : undefined,
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
          strokeWidth: this.strokeWidth,
          backgroundColor: this.backgroundColor,
          fillPattern: this.backgroundColor ? this.fillPattern : undefined,
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
          strokeWidth: this.strokeWidth,
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
          strokeWidth: this.strokeWidth,
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

    // Select the newly created shape
    this.selectedShape = newShape;
    this.selectedShapeIndex = this.existingShapes.length - 1;
    this.selectedTool = "select";
    document.body.style.cursor = "pointer";
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

      // Handle moving a selected shape
      if (
        this.selectedTool === "select" &&
        this.isMovingShape &&
        this.selectedShape
      ) {
        const dx = transformedX - this.startX;
        const dy = transformedY - this.startY;

        // Update the shape's position based on its type
        if (this.selectedShape.shape.type === "rectangle") {
          this.selectedShape.shape.x += dx;
          this.selectedShape.shape.y += dy;
        } else if (this.selectedShape.shape.type === "circle") {
          this.selectedShape.shape.centerX += dx;
          this.selectedShape.shape.centerY += dy;
        } else if (this.selectedShape.shape.type === "line") {
          this.selectedShape.shape.startX += dx;
          this.selectedShape.shape.startY += dy;
          this.selectedShape.shape.endX += dx;
          this.selectedShape.shape.endY += dy;
        } else if (this.selectedShape.shape.type === "pencil") {
          // Move all points in the pencil path
          for (const point of this.selectedShape.shape.points) {
            point.x += dx;
            point.y += dy;
          }
        } else if (this.selectedShape.shape.type === "text") {
          this.selectedShape.shape.x += dx;
          this.selectedShape.shape.y += dy;
        }

        // Update the start position for the next move
        this.startX = transformedX;
        this.startY = transformedY;

        this.clearCanvas();
        return;
      }

      const width = transformedX - this.startX;
      const height = transformedY - this.startY;

      this.clearCanvas();
      this.ctx.strokeStyle = this.strokeColor || "rgba(255, 255, 255)";
      this.ctx.lineWidth = this.strokeWidth || 1;
      if (this.selectedTool === "rectangle") {
        const x = Math.min(this.startX, transformedX);
        const y = Math.min(this.startY, transformedY);
        const rectWidth = Math.abs(width);
        const rectHeight = Math.abs(height);
        // Draw background if it exists
        if (this.backgroundColor) {
          this.ctx.fillStyle = this.backgroundColor;

          // Apply fill pattern if specified
          if (this.fillPattern) {
            this.applyFillPattern(
              x,
              y,
              rectWidth,
              rectHeight,
              this.fillPattern,
              this.backgroundColor
            );
          } else {
            // Simple fill
            this.ctx.fillRect(x, y, rectWidth, rectHeight);
          }
        }
        // Draw stroke
        this.ctx.strokeRect(x, y, rectWidth, rectHeight);
      } else if (this.selectedTool === "circle") {
        const radius = Math.sqrt(width ** 2 + height ** 2) / 2;
        const centerX = this.startX + width / 2;
        const centerY = this.startY + height / 2;
        // Draw background if it exists
        if (this.backgroundColor) {
          this.ctx.fillStyle = this.backgroundColor;
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

          // Apply fill pattern if specified
          if (this.fillPattern) {
            this.applyCircleFillPattern(
              centerX,
              centerY,
              radius,
              this.fillPattern,
              this.backgroundColor
            );
          } else {
            // Simple fill
            this.ctx.fill();
          }
        }
        // Draw stroke
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
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth = this.strokeWidth;
        this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
        for (const point of this.currentPath) {
          this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.stroke();
      }
      this.ctx.lineWidth = 1;
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
