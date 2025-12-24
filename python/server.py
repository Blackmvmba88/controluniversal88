import asyncio
import json
import os
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
import uvicorn
from python.daemon import Daemon

app = FastAPI()
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount('/docs', StaticFiles(directory=os.path.join(base_dir, 'docs')), name='docs')
app.mount('/', StaticFiles(directory=os.path.join(base_dir, 'web'), html=True), name='web')

clients = set()

def broadcast(msg):
    data = json.dumps(msg)
    to_remove = []
    for ws in clients:
        try:
            asyncio.create_task(ws.send_text(data))
        except Exception:
            to_remove.append(ws)
    for ws in to_remove:
        clients.discard(ws)

@app.websocket('/ws')
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # not used, just keep alive
    except Exception:
        clients.discard(websocket)

@app.get('/api/status')
async def status():
    try:
        d = Daemon()
        return d.get_status()
    except Exception as e:
        return { 'error': str(e) }

@app.post('/api/save-map')
async def save_map(payload: dict):
    try:
        d = Daemon()
        d.save_mapping(payload)
        return { 'ok': True }
    except Exception as e:
        return { 'error': str(e) }

if __name__ == '__main__':
    d = Daemon()
    async def emit(m):
        broadcast(m)
    loop = asyncio.get_event_loop()
    loop.create_task(d.start(emit))
    uvicorn.run('python.server:app', host='0.0.0.0', port=8080, reload=False)
