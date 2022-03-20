import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../constants/Actions';
import { Client, Editor } from '../components/index';
import { initSocket } from '../socket';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [clients, setClients] = useState([]);

    useEffect(() => {
        const init = async () => {

            function handleErrors(e) {
                console.log('socket error', e);
                toast.error('Socket connection failed, try again later.');
                navigate('/');
            }

            socketRef.current = await initSocket();
            socketRef.current.on('connect_error', (err) => handleErrors(err));
            socketRef.current.on('connect_failed', (err) => handleErrors(err));

            // message send to server, event emit
            socketRef.current.emit(ACTIONS.JOIN, { // join event
                roomId, // useParams - link param
                username: location.state?.username,
            });

            socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => { // Listening for joined event
                if (username !== location.state?.username) {
                    toast.success(`${username} joined the room.`);
                }
                setClients(clients);
                socketRef.current.emit(ACTIONS.SYNC_CODE, { // emit code change (sync)
                    code: codeRef.current,
                    socketId,
                });
            });

            socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => { // Listening for disconnected
                toast.success(`${username} left the room.`);
                setClients((prev) => { // filtering clients other than left one
                    return prev.filter((client) => client.socketId !== socketId);
                });
            });
        };
        init();

        return () => { // clear listeners
            socketRef.current.disconnect();
            socketRef.current.off(ACTIONS.JOINED);
            socketRef.current.off(ACTIONS.DISCONNECTED);
        };
    }, []);

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        navigate('/');
    }

    if (!location.state) {
        return <Navigate to="/" />;
    }

    return (
        <div className='mainWrap'>
            <div className='aside'>
                
                <div className='asideInner'>
                
                    <div className='logoWrapper'>
                        <img style={{height: '35px'}} className="homePageLogo" src="/code-sync.png" alt="code-sync-logo" />
                        <div style={{display: 'flex', flexDirection: 'column', marginTop: '3px', marginLeft: '5px'}}>
                            <span style={{fontSize: '15px'}}>Coder-Sync</span>
                            <span style={{fontWeight: 'bolder', fontSize: '12px', color: '#4aed88'}}>Realtime Collboration</span>
                        </div>
                    </div>

                    <div style={{display: 'flex'}}>
                        <h3 style={{marginTop: '-5px'}}>Connected</h3>
                        <div style={{
                            height: '8px',
                            width: '8px',
                            background: '#4aee88',
                            borderRadius: '50px',
                            marginLeft: '10px'
                        }}></div>
                    </div>

                    <div className='clientsList'>
                        {clients.map((values, index) => (
                            <Client key={values.socketId} username={values.username} />
                        ))}
                    </div>

                </div>

                <button className='btn copyBtn' onClick={()=>copyRoomId()}>Copy ROOM ID</button>
                <button className='btn leaveBtn' onClick={()=>leaveRoom()}>Leave ROOM</button>

            </div>

            <div className='editorWrap'>
                <Editor socketRef={socketRef} roomId={roomId} onCodeChange={(code)=>{codeRef.current = code}} />
            </div>

        </div>
    );
};

export default EditorPage;