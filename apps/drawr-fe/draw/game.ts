import { generateId } from "@/utils/generateId";
import { getExsistingShapes } from "./http";
import { pointToLineDistance } from "@/utils/pointToLineDistance";

type Tool = "circle" | "rectangle" | "line" | "eraser" | "pencil" | "text";

type Shape =
  | {
      id?: number;
      shape: {
        type: "rectangle";
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }
  | {
      id?: number;
      shape: {
        type: "circle";
        centerX: number;
        centerY: number;
        radius: number;
      };
    }
  | {
      id?: number;
      shape: {
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
        type: "pencil";
        points: { x: number; y: number }[];
      };
    }
  | {
      id?: number;
      shape: {
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
  private exsistingShapes: Shape[];
  private roomId: string;
  private socket: WebSocket;
  private clicked: boolean;
  private startX: number = 0;
  private startY: number = 0;
  private selectedTool = "circle";
  private currentPath: { x: number; y: number }[] = [];
  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.exsistingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.clicked = false;
    this.init();
    this.initHandlers();
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
        text,
        x,
        y: y + 10,
        width: this.ctx.measureText(text).width + 20,
        height: 30,
      },
    };
    this.exsistingShapes.push(newShape);
    this.socket.send(
      JSON.stringify({
        type: "chat",
        message: JSON.stringify(newShape),
        roomId: Number(this.roomId),
      })
    );
    this.clearCanvas();
  }

  async init() {
    this.exsistingShapes = await getExsistingShapes(this.roomId);
    this.clearCanvas();
  }

  initHandlers() {
    this.socket.addEventListener("message", this.messageHandler);
  }

  messageHandler = (event: MessageEvent) => {
    const message = JSON.parse(event.data);
    if (message.type === "chat") {
      const parsedShape = JSON.parse(message.message);
      this.exsistingShapes.push(parsedShape);
      this.clearCanvas();
    }
    if (message.type === "delete_message") {
      this.exsistingShapes = this.exsistingShapes.filter(
        (shape) => shape.id !== message.messageId
      );
      this.clearCanvas();
    }
  };
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "rgba(0,0,0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = "rgba(255, 255, 255)";

    this.exsistingShapes.map((element) => {
      if (element.shape.type === "rectangle") {
        this.ctx.strokeStyle = "rgba(255, 255, 255)";
        this.ctx.strokeRect(
          element.shape.x,
          element.shape.y,
          element.shape.width,
          element.shape.height
        );
      } else if (element.shape.type === "circle") {
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
        this.ctx.beginPath();
        this.ctx.moveTo(element.shape.startX, element.shape.startY);
        this.ctx.lineTo(element.shape.endX, element.shape.endY);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (
        element.shape.type === "pencil" &&
        element.shape.points?.length > 0
      ) {
        this.ctx.beginPath();
        this.ctx.moveTo(element.shape.points[0].x, element.shape.points[0].y);
        for (const point of element.shape.points) {
          this.ctx.lineTo(point.x, point.y);
        }
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (element.shape.type === "text") {
        this.ctx.fillStyle = "white";
        this.ctx.font = "20px Arial";
        this.ctx.fillText(element.shape.text, element.shape.x, element.shape.y);
      }
    });
  }

  mouseDownHandler = (e: MouseEvent) => {
    this.clicked = true;
    this.startX = e.clientX;
    this.startY = e.clientY;

    if (this.selectedTool === "eraser") {
      this.exsistingShapes = this.exsistingShapes.filter((element) => {
        let shouldKeep = true;

        if (element.shape.type === "rectangle") {
          const rect = element.shape;
          const tolerance = 5; 

          const distToTop = pointToLineDistance(
            e.clientX,
            e.clientY,
            rect.x,
            rect.y,
            rect.x + rect.width,
            rect.y
          );

          const distToRight = pointToLineDistance(
            e.clientX,
            e.clientY,
            rect.x + rect.width,
            rect.y,
            rect.x + rect.width,
            rect.y + rect.height
          );

          const distToBottom = pointToLineDistance(
            e.clientX,
            e.clientY,
            rect.x,
            rect.y + rect.height,
            rect.x + rect.width,
            rect.y + rect.height
          );

          const distToLeft = pointToLineDistance(
            e.clientX,
            e.clientY,
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
            (e.clientX - element.shape.centerX) ** 2 +
              (e.clientY - element.shape.centerY) ** 2
          );
          shouldKeep = dist > element.shape.radius;
        } else if (element.shape.type === "line") {
          const distance = pointToLineDistance(
            e.clientX,
            e.clientY,
            element.shape.startX,
            element.shape.startY,
            element.shape.endX,
            element.shape.endY
          );

          shouldKeep = distance > 5;
        } else if (element.shape.type === "pencil") {
          // check if the e.clientX and e.clientY is included in the points array or if e.clientX and e.clientY are like 10px away from the points
          const isPointInPoints = element.shape.points.some(
            (point) =>
              (point.x === e.clientX && point.y === e.clientY) ||
              (Math.abs(point.x - e.clientX) < 10 &&
                Math.abs(point.y - e.clientY) < 10)
          );
          shouldKeep = !isPointInPoints;
        } else if (element.shape.type === "text") {
          shouldKeep = !(
            e.clientX >= element.shape.x &&
            e.clientX <= element.shape.x + element.shape.width &&
            e.clientY >= element.shape.y - element.shape.height && // Adjust for text baseline
            e.clientY <= element.shape.y
          );
        }

        if (!shouldKeep) {
          this.socket.send(
            JSON.stringify({
              type: "delete_message",
              roomId: Number(this.roomId),
              messageId: element.id,
            })
          );
        }
        return shouldKeep;
      });

      this.clearCanvas();
      return;
    }
  };
  mouseUpHandler = (e: MouseEvent) => {
    this.clicked = false;
    const width = e.clientX - this.startX;
    const height = e.clientY - this.startY;

    const selectedTool = this.selectedTool;
    let newShape: Shape | null = null;
    if (selectedTool === "rectangle") {
      newShape = {
        id: generateId(),
        shape: {
          type: "rectangle",
          x: Math.min(this.startX, e.clientX),
          y: Math.min(this.startY, e.clientY),
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
          startX: this.startX,
          startY: this.startY,
          endX: e.clientX,
          endY: e.clientY,
        },
      };
    } else if (selectedTool === "pencil" && this.currentPath.length > 0) {
      newShape = {
        id: generateId(),
        shape: {
          type: "pencil",
          points: this.currentPath,
        },
      };
      this.currentPath = []; // Reset path after creating shape
      this.exsistingShapes.push(newShape);
      this.socket.send(
        JSON.stringify({
          type: "chat",
          message: JSON.stringify(newShape),
          roomId: Number(this.roomId),
        })
      );
      return; // Exit early for pencil tool
    }
    if (!newShape) {
      return;
    }
    this.exsistingShapes.push(newShape);

    this.socket.send(
      JSON.stringify({
        type: "chat",
        message: JSON.stringify(newShape),
        roomId: Number(this.roomId),
      })
    );

    //

    this.clearCanvas();
  };
  mouseMoveHandler = (e: MouseEvent) => {
    if (this.clicked) {
      const width = e.clientX - this.startX;
      const height = e.clientY - this.startY;
      this.clearCanvas();
      this.ctx.strokeStyle = "rgba(255, 255, 255)";

      if (this.selectedTool === "rectangle") {
        this.ctx.strokeRect(
          Math.min(this.startX, e.clientX),
          Math.min(this.startY, e.clientY),
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
        this.ctx.lineTo(e.clientX, e.clientY);
        this.ctx.stroke();
        this.ctx.closePath();
      } else if (this.selectedTool === "pencil") {
        this.currentPath.push({ x: e.clientX, y: e.clientY });
        this.clearCanvas();

        // Draw the current path
        this.ctx.beginPath();
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
  }

  destroy() {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);

    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);

    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    this.socket.removeEventListener("message", this.messageHandler);
  }
}
