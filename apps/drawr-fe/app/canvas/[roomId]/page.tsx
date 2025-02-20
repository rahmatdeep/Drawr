import { RoomCanvasComponent } from "@/components/RoomCanvasComponent";

export default async function Canvas({
  params,
}: {
  params: {
    roomId: string;
  };
}) {
  const roomId = (await params).roomId;
  return <RoomCanvasComponent roomId={roomId} />;
}
