// Cloudflare Worker: принимает уведомление об изменении данных и публикует его
// в Pusher Channels. Секрет Pusher хранится только здесь (wrangler secret),
// а не в статическом сайте.
//
// POST /notify
//   { "kind": "watched" | "movies", "clientId": "<id вкладки>" }

const CHANNEL = "marvel-watchlist";
const EVENT = "changed";
const KINDS = new Set(["watched", "movies"]);

function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = request.headers.get("Origin") ?? "";

  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return { headers, allowedOrigin: allowed.includes(origin) };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function md5Hex(text) {
  // MD5 в WebCrypto доступен в Cloudflare Workers как расширение.
  return toHex(await crypto.subtle.digest("MD5", new TextEncoder().encode(text)));
}

async function hmacSha256Hex(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
}

async function publish(env, kind, clientId) {
  const path = `/apps/${env.PUSHER_APP_ID}/events`;
  const body = JSON.stringify({
    name: EVENT,
    channels: [CHANNEL],
    data: JSON.stringify({ kind, clientId }),
  });

  const params = {
    auth_key: env.PUSHER_KEY,
    auth_timestamp: String(Math.floor(Date.now() / 1000)),
    auth_version: "1.0",
    body_md5: await md5Hex(body),
  };

  const query = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const signature = await hmacSha256Hex(
    env.PUSHER_APP_SECRET,
    `POST\n${path}\n${query}`,
  );

  return fetch(
    `https://api-${env.PUSHER_CLUSTER}.pusher.com${path}?${query}&auth_signature=${signature}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body },
  );
}

export default {
  async fetch(request, env) {
    const { headers, allowedOrigin } = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowedOrigin ? 204 : 403, headers });
    }

    if (url.pathname !== "/notify" || request.method !== "POST") {
      return json({ error: "not_found" }, 404, headers);
    }

    if (!allowedOrigin) {
      return json({ error: "forbidden" }, 403, headers);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400, headers);
    }

    const kind = payload?.kind;
    const clientId =
      typeof payload?.clientId === "string" ? payload.clientId.slice(0, 64) : "";
    if (!KINDS.has(kind)) {
      return json({ error: "invalid_kind" }, 400, headers);
    }

    try {
      const response = await publish(env, kind, clientId);
      if (!response.ok) {
        return json({ error: "pusher_error", status: response.status }, 502, headers);
      }
    } catch {
      return json({ error: "pusher_unreachable" }, 502, headers);
    }

    return json({ ok: true }, 200, headers);
  },
};
