/**
 * seed.js — one-time local script to generate password hashes for the
 * admin and client dashboards, so you can put them straight into KV
 * instead of relying on the env-var fallback (which only works until the
 * first real login/rotation happens).
 *
 * This does NOT touch Cloudflare directly — it just prints wrangler
 * commands you copy-paste, keeping this dependency-free (uses Node's
 * built-in crypto, no npm install needed).
 *
 * Usage:
 *   node seed.js admin "your-admin-password"
 *   node seed.js client "your-client-password"
 *
 * Then run the printed `npx wrangler kv key put ...` command against your
 * real KV namespace (see README.md).
 */

const crypto = require("crypto");

const ITERATIONS = 100000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

const [, , role, password] = process.argv;

if (!role || !password || !["admin", "client"].includes(role)) {
  console.log("Usage: node seed.js <admin|client> <password>");
  process.exit(1);
}

const hash = hashPassword(password);
const key = role === "admin" ? "admin:password_hash" : "client:password_hash";

console.log("\nGenerated hash:");
console.log(hash);
console.log("\nRun this to store it in your KV namespace (replace <NAMESPACE_ID>):\n");
console.log(`npx wrangler kv key put "${key}" "${hash}" --namespace-id=<NAMESPACE_ID>\n`);
