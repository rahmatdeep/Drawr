import { prismaClient } from "@repo/db/client";
import { createClient } from "redis";
const redisCreateClient = createClient();
const redisDeleteClient = createClient();
(async () => {
  await redisCreateClient.connect();
  await redisDeleteClient.connect();

  await Promise.all([createShape(), deleteShape()]);
})();

async function createShape() {
  while (true) {
    const createData = await redisCreateClient.blPop("create_queue", 0);
    if (createData) {
      const data = JSON.parse(createData.element);
      try {
        await prismaClient.chat.create({ data });
      } catch (e) {
        console.log(e);
      }
    }
  }
}

async function deleteShape() {
  while (true) {
    const deleteData = await redisDeleteClient.blPop("delete_queue", 0);
    if (deleteData) {
      const data = JSON.parse(deleteData.element);
      try {
        await prismaClient.chat.delete({ where: data });
      } catch (e) {
        console.log(e);
      }
    }
  }
}
