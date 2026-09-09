const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "production";

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required (from the operator-generated connection-string secret)");
}

let clientPromise;

function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getDb() {
  const client = await getClient();
  return client.db(DB_NAME);
}

async function ping() {
  const db = await getDb();
  await db.command({ ping: 1 });
}

module.exports = { getDb, ping };
