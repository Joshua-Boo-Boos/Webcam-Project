import { useState, useEffect, useRef } from 'react'
import Webcam from 'react-webcam'
import './App.css'
import Camera_Component from './components/Camera_Component'
import SHA512 from 'crypto-js/sha512'

function App() {

  const [canDisplayCamera, setCanDisplayCamera] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [cameraSide, setCameraSide] = useState<'user' | 'environment'>('user');
  const cameraRef = useRef<Webcam | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [allReceivedData, setAllReceivedData] = useState<{data: string; username: string}[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<string[]>([]);

  useEffect(() => {
    if (loggedIn && username && !ws.current) {
      try {
        ws.current = new WebSocket('wss://192.168.1.210:8000/ws/' + username);
      } catch (error) {
        console.error('Error occurred while creating WebSocket:', error);
      }
      if (ws.current) {
        ws.current.onmessage = (event) => {
          const message = JSON.parse(event.data);
          console.log('Received message:', message)
          if (message.type === 'image') {
            console.log('Received image from user:', message.username);
            setAllReceivedData(currentData => {
              const newData = [...currentData];
              let found_user = false;
              for (let i = 0; i < currentData.length; i++) {
                if (newData[i].username === message.username) {
                  newData[i].data = message.data;
                  found_user = true;
                  break;
                }
              }
              if (!found_user) {
                newData.push({data: message.data, username: message.username});
              }
              return newData;
            });
          } else if (message.type === 'online_users') {
            console.log('Online users', message.users);
            setOnlineUsers(message.users);
            setAllReceivedData(currentData => {
              const newData = [...currentData];
              const arrayToReturn = newData.filter(item => message.users.includes(item.username));
              console.log('arrayToReturn:', arrayToReturn);
              return arrayToReturn;
            });
          } else if (message.type === 'chat_message') {
            console.log('Received chat message:', message);
            setChatMessages(chatMessages => [...chatMessages, `${message.username}: ${message.content}`]);
          }
        }
      }
    }
  }, [loggedIn, username]);

  const login = async () => {
    try {
      const loginAPIURL = 'https://192.168.1.210:8000/api/login';
      const response = await fetch(loginAPIURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({username: SHA512(inputUsername).toString(), password: SHA512(inputPassword).toString()})
      });
      if (!response.ok) {
        throw new Error('Login failed');
      } else {
        const data = await response.json();
        console.log('Login successful:', data);
        if (data.success) {
          setUsername(inputUsername);
          setLoggedIn(true);
          setInputUsername('');
          setInputPassword('');
        }
      }
    } catch (error) {
      console.error('Error occurred during login:', error);
    }
  }

  const logout = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    setLoggedIn(false);
    setUsername('');
    setAllReceivedData([]);
    setOnlineUsers([]);
  }

  const submitChatMessage = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && loggedIn && username) {
      console.log('Submitting chat message:', chatInput);
      ws.current.send(JSON.stringify({
        type: 'chat_message', 
        content: chatInput, 
        username: username
      }));
      setChatInput('');
    }
  }

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (canDisplayCamera && loggedIn && ws.current) {
      intervalId = setInterval(() => {
        if (cameraRef.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          const imageSrc = cameraRef.current.getScreenshot();
          if (imageSrc) {
            ws.current.send(JSON.stringify({
              type: 'image', 
              data: imageSrc, 
              username: username
            }));
          }
        }
      }, 100);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [canDisplayCamera, loggedIn, username]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN && loggedIn) {
        ws.current.send(JSON.stringify({type: 'online_users_check', username: username}));
      } else {
        console.warn('WebSocket is not connected');
      }
    }, 500)
    return () => clearInterval(intervalId);
  }, [loggedIn])

  return (
    <div className='app-container'>
      <div className="login-container">
        <input
          type="text"
          placeholder='Username'
          className="input-username"
          value={inputUsername}
          onChange={e => setInputUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder='Password'
          className="input-password"
          value={inputPassword}
          onChange={e => setInputPassword(e.target.value)}
        />
        <button disabled={loggedIn} onClick={login} className="login-button">Login</button>
        <button disabled={!loggedIn} onClick={logout} className="logout-button">Logout</button>
      </div>
      <div className="camera-and-chat-container">
        <div className="overall-camera-container">
          <h3 className='connected-users-title'>Connected Users ({onlineUsers.length})</h3>
          <div className="all-cameras-container">
            <div className='other-cameras-container'>
              {allReceivedData
                .filter(item => item.username !== username)
                .map((item) => (
                  <Camera_Component
                    key={item.username}
                    allReceivedData={allReceivedData}
                    specific_username={item.username}
                  />
                ))
              }
            </div>
            <div className='camera-container'>
              {canDisplayCamera && (
                <div className='camera-wrapper'>
                  <Webcam
                    ref={cameraRef}
                    audio={true}
                    height={300}
                    width={300}
                    style={{objectFit: 'cover'}}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                      facingMode: cameraSide,
                      width: 300,
                      height: 300,
                    }}
                    audioConstraints={{
                      echoCancellation: true,
                      noiseSuppression: true,
                      sampleRate: 44100,
                    }}
                  />
                </div>
              )}
              <div className="camera-controls">
                <button disabled={!loggedIn} onClick={() => setCanDisplayCamera(!canDisplayCamera)} className="allow-disallow-camera-button">
                  {canDisplayCamera ? 'Disable' : 'Enable'} Camera
                </button>
                <button disabled={!loggedIn} onClick={() => setCameraSide(cameraSide === 'user' ? 'environment' : 'user')} className="change-camera-side">
                  Switch Camera
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="chat-container">
          <h3 className='chat-title'>Chat</h3>
          <textarea value={chatMessages.join('\n')} rows={20} disabled={true} className="textarea-messages" />
          <div className="submit-message-container">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder='Type your message...' type="text" className="input-message" />
            <button onClick={() => submitChatMessage()} className="submit-message">Submit</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
