// import axios from "axios";
// import { HTTP_BACKEND } from "../config";

// type Shape =
//   | {
//       type: "rectangle";
//       x: number;
//       y: number;
//       width: number;
//       height: number;
//     }
//   | {
//       type: "circle";
//       centerX: number;
//       centerY: number;
//       radius: number;
//     }
//   | {
//       type: "pencil";
//       startX: number;
//       startY: number;
//       endX: number;
//       endY: number;
//     };

// export async function initDraw(
//   canvas: HTMLCanvasElement,
//   roomId: string,
//   socket: WebSocket
// ) {
//   const ctx = canvas.getContext("2d");

//   const exsistingShapes: Shape[] = await getExsistingShapes(roomId);

//   if (!ctx) {
//     return;
//   }

//   socket.onmessage = (event) => {
//     const message = JSON.parse(event.data);
//     if (message.type === "chat") {
//       const parsedShape = JSON.parse(message.message);
//       exsistingShapes.push(parsedShape);
//       clearCanvas(exsistingShapes, canvas);
//     }
//   };

//   clearCanvas(exsistingShapes, canvas);

//   let clicked = false;
//   let startX = 0;
//   let startY = 0;

//   canvas.addEventListener("mousedown", (e) => {
//     clicked = true;
//     startX = e.clientX;
//     startY = e.clientY;
//   });
//   canvas.addEventListener("mouseup", (e) => {
//     clicked = false;
//     const width = e.clientX - startX;
//     const height = e.clientY - startY;
//     // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//     //@ts-ignore
//     const selectedTool = window.selectedTool;
//     let shape: Shape | null = null;
//     if (selectedTool === "rectangle") {
//       shape = {
//         type: "rectangle",
//         x: startX,
//         y: startY,
//         height,
//         width,
//       };
//     } else if (selectedTool === "circle") {
//       const radius = Math.max(height, width) / 2;
//       shape = {
//         type: "circle",
//         radius,
//         centerX: startX + radius,
//         centerY: startY + radius,
//       };
//     }
//     if (!shape) {
//       return;
//     }
//     exsistingShapes.push(shape);

//     socket.send(
//       JSON.stringify({
//         type: "chat",
//         message: JSON.stringify(shape),
//         roomId: Number(roomId),
//       })
//     );
//   });
//   canvas.addEventListener("mousemove", (e) => {
//     if (clicked) {
//       const width = e.clientX - startX;
//       const height = e.clientY - startY;
//       clearCanvas(exsistingShapes, canvas);
//       ctx.strokeStyle = "rgba(255, 255, 255)";
//       // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//       //@ts-ignore
//       const selectedTool = window.selectedTool;
//       if (selectedTool === "rectangle") {
//         ctx.strokeRect(startX, startY, width, height);
//       } else if (selectedTool === "circle") {
//         const radius = Math.max(width, height) / 2;
//         const centerX = startX + radius;
//         const centerY = startY + radius;
//         ctx.beginPath();
//         ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
//         ctx.stroke();
//         ctx.closePath();
//       }
//     }
//   });
// }

// function clearCanvas(exsistingShapes: Shape[], canvas: HTMLCanvasElement) {
//   const ctx = canvas.getContext("2d");
//   if (!ctx) return;
//   ctx.clearRect(0, 0, canvas.width, canvas.height);
//   ctx.fillStyle = "rgba(0,0,0)";
//   ctx.fillRect(0, 0, canvas.width, canvas.height);
//   ctx.strokeStyle = "rgba(255, 255, 255)";

//   exsistingShapes.map((shape) => {
//     if (shape.type === "rectangle") {
//       ctx.strokeStyle = "rgba(255, 255, 255)";
//       ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
//     } else if (shape.type === "circle") {
//       ctx.beginPath();
//       ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
//       ctx.stroke();
//       ctx.closePath();
//     }
//   });
// }

// async function getExsistingShapes(roomId: string) {
//   const res = await axios.get(`${HTTP_BACKEND}/chats/${roomId}`);
//   const data = res.data.messages;

//   const shapes = data.map((x: { message: string }) => {
//     const messageData = JSON.parse(x.message);
//     return messageData;
//   });

//   return shapes;
// }
