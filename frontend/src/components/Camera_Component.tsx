import { useState, useEffect } from 'react';

interface Camera_Component_Props {
    allReceivedData: {data: string; username: string}[];
    specific_username: string;
}

function Webcam_Component({allReceivedData, specific_username}: Camera_Component_Props) {

    const [receivedData, setReceivedData] = useState<string>('');

    useEffect(() => {
        const userImage = allReceivedData.find(image => image.username === specific_username);
        if (userImage) {
            setReceivedData(userImage.data);
        }
    }, [allReceivedData, specific_username]);

    return (
        <div className="camera-feed">
            <h4>Camera: {specific_username}</h4>
            {receivedData !== '' ? (
                <div className="other-client-camera-wrapper">
                    <img 
                        src={receivedData} 
                        alt={`${specific_username}'s camera`}
                        style={{
                            width: 300,
                            height: 300,
                            border: "2px solid #ccc",
                            borderRadius: "8px"
                        }}
                    />
                </div>
            ) : (
                <div className='no-remote-client-webcam'
                    style={{
                    width: 300,
                    height: 300,
                    border: "2px solid #ccc",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#f0f0f0"
                }}>
                    <span>No video from {specific_username}</span>
                </div>
            )}
        </div>
    )
}

export default Webcam_Component;
