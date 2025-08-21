from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.websockets import WebSocketState
from pydantic import BaseModel
import asyncio
import aiosqlite
import json

class LoginObject(BaseModel):
    username: str
    password: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, username: str):
        if username in self.active_connections:
            # Disconnect existing connection for this username
            await self.active_connections[username].close()
            del self.active_connections[username]
        
        await websocket.accept()
        self.active_connections[username] = websocket

    def disconnect(self, username: str):
        self.active_connections.pop(username, None)

    async def send_message_single(self, username, message_to_send):
        websocket = self.active_connections.get(username)
        if websocket:
            try:
                await websocket.send_text(message_to_send)
            except:
                self.disconnect(username)

    async def send_message_all_except(self, sender_username, message_to_send):
        for username, websocket in self.active_connections.items():
            if username != sender_username:
                try:
                    await websocket.send_text(message_to_send)
                except:
                    self.disconnect(username)

manager = ConnectionManager()

@app.websocket('/ws/{username}')
async def websocket_endpoint(websocket: WebSocket, username: str):
    await manager.connect(websocket, username)
    print(f'Client connected: {username}')
    print(f'Currently connected users: {list(manager.active_connections.keys())}')
    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                print(f'Message received from {username}: {message.get("type")}')
                
                if message.get('type') == 'image':
                    base64_image = message['data']
                    print(f'User {username} sent an image')
                    
                    # Broadcast image to all clients except the sender
                    await manager.send_message_all_except(
                        username, 
                        json.dumps({
                            'type': 'image', 
                            'data': base64_image, 
                            'username': username
                        })
                    )
                    
                elif message.get('type') == 'online_users_check':
                    print(f'User {username} requested online users list: {list(manager.active_connections.keys())}')
                    await manager.send_message_single(
                        username, 
                        json.dumps({
                            'type': 'online_users', 
                            'users': list(manager.active_connections.keys())
                        })
                    )
                    
            except json.JSONDecodeError:
                await manager.send_message_single(
                    username, 
                    json.dumps({'error': 'Invalid JSON format'})
                )
            except WebSocketDisconnect:
                manager.disconnect(username)
                print(f'Client disconnected: {username}')
                break

            except Exception as e:
                print(f'Exception occurred: {e}')
                
    except WebSocketDisconnect:
        manager.disconnect(username)
        print(f'Client disconnected: {username}')
    except Exception as e:
        print(f'Exception occurred: {e}')
        manager.disconnect(username)

@app.post('/api/login')
async def login(login_object: LoginObject):
    username = login_object.username
    password = login_object.password
    
    async with aiosqlite.connect('users.db') as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY, 
                password TEXT NOT NULL
            )
        ''')
        await db.commit()
        
        cur = await db.execute('SELECT * FROM users WHERE username = ?', (username,))
        user = await cur.fetchone()
        
        if user:
            if user[1] == password:
                return {'success': True}
            else:
                raise HTTPException(status_code=401, detail='Incorrect password')
        else:
            await db.execute(
                'INSERT INTO users (username, password) VALUES (?, ?)', 
                (username, password)
            )
            await db.commit()
            return {'success': True}
