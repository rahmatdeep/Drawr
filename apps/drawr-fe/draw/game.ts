import { generateId } from "@/utils/generateId";
import { getExsistingShapes } from "./http";

type Tool = "circle" | "rectangle" | "pencil" | "eraser";

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
        type: "pencil";
        startX: number;
        startY: number;
        endX: number;
        endY: number;
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
      } else if (element.shape.type === "pencil") {
        this.ctx.beginPath();
        this.ctx.moveTo(element.shape.startX, element.shape.startY);
        this.ctx.lineTo(element.shape.endX, element.shape.endY);
        this.ctx.stroke();
        this.ctx.closePath();
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
          shouldKeep = !(
            e.clientX >= element.shape.x &&
            e.clientX <= element.shape.x + element.shape.width &&
            e.clientY >= element.shape.y &&
            e.clientY <= element.shape.y + element.shape.height
          );
        } else if (element.shape.type === "circle") {
          const dist = Math.sqrt(
            (e.clientX - element.shape.centerX) ** 2 +
              (e.clientY - element.shape.centerY) ** 2
          );
          shouldKeep = dist > element.shape.radius;
        } else if (element.shape.type === "pencil") {
          shouldKeep = !(
            e.clientX >= Math.min(element.shape.startX, element.shape.endX) &&
            e.clientX <= Math.max(element.shape.startX, element.shape.endX) &&
            e.clientY >= Math.min(element.shape.startY, element.shape.endY) &&
            e.clientY <= Math.max(element.shape.startY, element.shape.endY)
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
    } else if (selectedTool === "pencil") {
      newShape = {
        id: generateId(),
        shape: {
          type: "pencil",
          startX: this.startX,
          startY: this.startY,
          endX: e.clientX,
          endY: e.clientY,
        },
      };
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
      } else if (this.selectedTool === "pencil") {
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(e.clientX, e.clientY);
        this.ctx.stroke();
        this.ctx.closePath();
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
