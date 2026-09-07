import { FastifyPluginAsync } from "fastify";

const databaseHealth: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health/database", async () => {
    const result = await fastify.pg.query("SELECT NOW() AS current_time");

    return {
      status: "ok",
      databaseTime: result.rows[0].current_time,
    };
  });
};

export default databaseHealth;
