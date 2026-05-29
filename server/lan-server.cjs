const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

const port = Number(process.env.PORT || 4173)
const root = path.resolve(__dirname, '..', 'dist')
const rooms = new Map()

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`)

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url)
      return
    }

    serveStatic(url, response)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Server error' }))
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log('MAFIA TURBORZ LAN server is running')
  console.log(`Local:   http://localhost:${port}/mafia/`)

  for (const address of getLocalAddresses()) {
    console.log(`Network: http://${address}:${port}/mafia/`)
  }
})

async function handleApi(request, response, url) {
  if (request.method === 'POST' && url.pathname === '/api/room/start') {
    const body = await readJson(request)
    const room = getRoom(String(body.roomCode || ''))
    room.updatedAt = Date.now()
    sendJson(response, { ok: true })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/room/status') {
    const roomCode = String(url.searchParams.get('roomCode') || '')
    const room = rooms.get(roomCode)
    sendJson(response, { exists: Boolean(room) })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/room/snapshot') {
    const body = await readJson(request)
    const room = getRoom(String(body.roomCode || ''))
    room.snapshot = body.snapshot
    room.snapshotVersion += 1
    room.updatedAt = Date.now()
    sendJson(response, { ok: true, version: room.snapshotVersion })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/room/snapshot') {
    const roomCode = String(url.searchParams.get('roomCode') || '')
    const room = rooms.get(roomCode)
    sendJson(response, {
      snapshot: room?.snapshot ?? null,
      version: room?.snapshotVersion ?? 0
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/room/action') {
    const body = await readJson(request)
    const room = getRoom(String(body.roomCode || ''))
    room.actionVersion += 1
    room.actions.push({
      id: room.actionVersion,
      peerId: String(body.peerId || 'client'),
      payload: body.action
    })
    room.updatedAt = Date.now()
    sendJson(response, { ok: true, version: room.actionVersion })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/room/actions') {
    const roomCode = String(url.searchParams.get('roomCode') || '')
    const after = Number(url.searchParams.get('after') || 0)
    const room = getRoom(roomCode)
    sendJson(response, {
      actions: room.actions.filter((action) => action.id > after),
      version: room.actionVersion
    })
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify({ error: 'Not found' }))
}

function serveStatic(url, response) {
  let pathname = decodeURIComponent(url.pathname)

  if (pathname === '/' || pathname === '/mafia') {
    pathname = '/mafia/'
  }

  if (pathname.startsWith('/mafia/')) {
    pathname = pathname.slice('/mafia'.length)
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const filePath = path.normalize(path.join(root, requestedPath))

  if (!filePath.startsWith(root)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  const finalPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(root, 'index.html')
  const extension = path.extname(finalPath)

  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=300'
  })
  fs.createReadStream(finalPath).pipe(response)
}

function getRoom(roomCode) {
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      snapshot: null,
      snapshotVersion: 0,
      actions: [],
      actionVersion: 0,
      updatedAt: Date.now()
    })
  }

  return rooms.get(roomCode)
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let rawBody = ''

    request.on('data', (chunk) => {
      rawBody += chunk
    })

    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {})
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

function sendJson(response, data) {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  response.end(JSON.stringify(data))
}

function getLocalAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(Boolean)
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address)
}
