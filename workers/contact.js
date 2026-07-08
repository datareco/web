const encoder = new TextEncoder();

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

function corsHeaders(origin) {
  const headers = {
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };

  if (origin) {
    headers["access-control-allow-origin"] = origin;
  }

  return headers;
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, env) {
  if (!origin) return true;
  return getAllowedOrigins(env).includes(origin);
}

function trimField(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeLine(value) {
  return value.replace(/\r?\n/g, " ").trim();
}

function buildEmailPayload(payload, env) {
  const interest = payload.interest || "General inquiry";
  const subject = `Website inquiry: ${escapeLine(interest)} — ${escapeLine(payload.name)}`.slice(0, 150);
  const lines = [
    `Name: ${payload.name}`,
    `Work email: ${payload.email}`,
    `Organisation: ${payload.organisation || "—"}`,
    `Interest: ${payload.interest || "—"}`,
    `Source host: ${payload.source || "—"}`,
    "",
    "Notes:",
    payload.notes || "—",
  ];

  return {
    FromEmailAddress: env.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [env.SES_TO_EMAIL],
    },
    ReplyToAddresses: [payload.email],
    Content: {
      Simple: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: lines.join("\n"),
            Charset: "UTF-8",
          },
        },
      },
    },
  };
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return encoder.encode(String(value));
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", toBytes(value));
  return toHex(digest);
}

async function hmacSha256(key, value) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBytes(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value)));
}

async function getSigningKey(secret, dateStamp, region, service) {
  const kDate = await hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function signSesRequest(body, env) {
  const region = env.AWS_REGION;
  const service = "ses";
  const host = `email.${region}.amazonaws.com`;
  const method = "POST";
  const canonicalUri = "/v2/email/outbound-emails";
  const canonicalQueryString = "";
  const now = new Date();
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const amzDate = iso.slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const canonicalHeaders = [
    `content-type:application/json`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n") + "\n";
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSigningKey(env.AWS_SECRET_ACCESS_KEY, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${env.AWS_ACCESS_KEY_ID}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");

  return {
    url: `https://${host}${canonicalUri}`,
    headers: {
      authorization,
      "content-type": "application/json",
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  };
}

async function sendEmail(payload, env) {
  const body = JSON.stringify(buildEmailPayload(payload, env));
  const signed = await signSesRequest(body, env);
  const response = await fetch(signed.url, {
    method: "POST",
    headers: signed.headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "SES request failed");
  }

  return response.json();
}

function readinessError(message, origin) {
  return json(
    {
      ok: false,
      error: message,
    },
    503,
    origin
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (!isAllowedOrigin(origin, env)) {
      return json({ ok: false, error: "Origin not allowed." }, 403, origin);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || !["/", "/api/contact"].includes(url.pathname)) {
      return json({ ok: false, error: "Not found." }, 404, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON payload." }, 400, origin);
    }

    const normalized = {
      name: trimField(payload.name, 120),
      email: trimField(payload.email, 160),
      organisation: trimField(payload.organisation, 160),
      interest: trimField(payload.interest, 120),
      notes: trimField(payload.notes, 4000),
      source: trimField(payload.source, 120),
    };

    if (!normalized.name || !normalized.email) {
      return json({ ok: false, error: "Name and work email are required." }, 400, origin);
    }

    if (!validateEmail(normalized.email)) {
      return json({ ok: false, error: "Please enter a valid work email." }, 400, origin);
    }

    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      return readinessError("Contact delivery is not configured yet. Email support@datareco.com for now.", origin);
    }

    try {
      const result = await sendEmail(normalized, env);
      return json({ ok: true, messageId: result.MessageId || null }, 200, origin);
    } catch (error) {
      const detail = String(error.message || error);

      if (/Email address is not verified|not verified|sandbox/i.test(detail)) {
        return readinessError(
          "Contact delivery is being enabled in SES right now. Please email support@datareco.com temporarily.",
          origin
        );
      }

      return json({ ok: false, error: "We could not send your request just now. Please email support@datareco.com." }, 502, origin);
    }
  },
};