import { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SERVER_URL = (process.env.TAKO_SERVER_URL || "http://127.0.0.1:8080").replace(
  /\/$/,
  ""
)

const DROP_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
])

const DROP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
])

async function proxy(request: NextRequest) {
  const upstream = `${SERVER_URL}${request.nextUrl.pathname}${request.nextUrl.search}`

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body
    init.duplex = "half"
  }

  let response: Response
  try {
    response = await fetch(upstream, init)
  } catch {
    return Response.json(
      { error: "Tako server is unreachable" },
      { status: 502 }
    )
  }

  const responseHeaders = new Headers()
  response.headers.forEach((value, key) => {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value)
    }
  })

  // Preserve every Set-Cookie header instead of collapsing them into one.
  const setCookies = response.headers.getSetCookie?.() ?? []
  if (setCookies.length > 0) {
    responseHeaders.delete("set-cookie")
    for (const cookie of setCookies) {
      responseHeaders.append("set-cookie", cookie)
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as HEAD,
  proxy as OPTIONS,
}
