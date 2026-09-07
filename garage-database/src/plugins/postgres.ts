import postgres from "@fastify/postgres";
import fp from "fastify-plugin";

export default fp(async function database(fastify) {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }

  await fastify.register(postgres, {
    connectionString,
  });
});
