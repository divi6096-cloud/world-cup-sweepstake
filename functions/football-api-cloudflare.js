// functions/football-api.js  (Cloudflare Pages Function)
// Proxies requests to football-data.org to avoid browser CORS issues.
// Place this file at:  functions/football-api.js  in your project root.
// It will be served at:  /football-api
//
// Set FOOTBALL_DATA_API_KEY in: Cloudflare Pages → Settings → Environment variables.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function onRequest(context) {
  const { request, env } = context

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS })
  }

  const url = new URL(request.url)
  const endpoint = url.searchParams.get('endpoint')
  if (!endpoint) {
    return new Response(JSON.stringify({ error: 'endpoint parameter required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const apiRes = await fetch(`https://api.football-data.org/v4/${endpoint}`, {
      headers: { 'X-Auth-Token': apiKey },
    })
    const body = await apiRes.text()
    return new Response(body, {
      status: apiRes.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
}
