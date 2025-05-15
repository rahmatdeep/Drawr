/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import { MicIcon, MicOffIcon, PhoneIcon, PhoneOffIcon } from "lucide-react";

interface User {
  userId: string;
  username: string;
  isInCall: boolean;
  isMuted: boolean;
}

interface VoiceCallProps {
  roomId: string;
  socket: WebSocket | null;
  currentUserId: string;
}

export function VoiceCallComponent({
  roomId,
  socket,
  currentUserId,
}: VoiceCallProps) {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callParticipants, setCallParticipants] = useState<User[]>([]);
  const [isAudioReady, setIsAudioReady] = useState(false);

  // WebRTC related refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [userId: string]: RTCPeerConnection }>(
    {}
  );
  const audioContextRef = useRef<AudioContext | null>(null);

  // Set up WebRTC audio
  useEffect(() => {
    if (!isInCall) return;

    const initializeAudio = async () => {
      try {
        // Request user media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });

        localStreamRef.current = stream;

        // Mute audio if needed
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });

        setIsAudioReady(true);

        // Initialize audio context for visualizations if needed
        audioContextRef.current = new AudioContext();
      } catch (err) {
        console.error("Error accessing microphone:", err);
        alert(
          "Couldn't access your microphone. Please check your permissions."
        );
        leaveCall();
      }
    };

    initializeAudio();

    return () => {
      // Clean up audio when unmounting or leaving call
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isInCall]);

  // Toggle mute
  useEffect(() => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

    // Notify others of mute state change
    if (socket && socket.readyState === WebSocket.OPEN && isInCall) {
      socket.send(
        JSON.stringify({
          type: "toggle_mute",
          isMuted,
          roomId: Number(roomId),
        })
      );
    }
  }, [isMuted, socket, isInCall, roomId]);

  // Handle socket messages
  useEffect(() => {
    if (!socket) return;

    const handleSocketMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "room_users":
          // Update call participants from room users list
          if (data.users && Array.isArray(data.users)) {
            const participants = data.users.filter(
              (user: User) => user.isInCall
            );
            setCallParticipants(participants);
          }
          break;

        case "call_participants":
          // Handle initial list of call participants when joining
          if (data.participants && Array.isArray(data.participants)) {
            setCallParticipants(data.participants);

            // Initiate connection to each existing participant
            data.participants.forEach((participant: User) => {
              if (participant.userId !== currentUserId) {
                createPeerConnection(participant.userId);
              }
            });
          }
          break;

        case "user_joined_call":
          // Add new participant to the list
          if (isInCall && data.user) {
            setCallParticipants((prev) => {
              if (!prev.find((p) => p.userId === data.user.userId)) {
                return [...prev, data.user];
              }
              return prev;
            });

            // If we're already in the call, create a connection with the new participant
            if (data.user.userId !== currentUserId) {
              createPeerConnection(data.user.userId);
            }
          }
          break;

        case "user_left_call":
          // Remove participant from the list
          setCallParticipants((prev) =>
            prev.filter((p) => p.userId !== data.userId)
          );

          // Close and clean up peer connection
          if (peerConnectionsRef.current[data.userId]) {
            peerConnectionsRef.current[data.userId].close();
            delete peerConnectionsRef.current[data.userId];
          }
          break;

        case "user_mute_changed":
          // Update mute status for a user
          setCallParticipants((prev) =>
            prev.map((p) =>
              p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p
            )
          );
          break;

        // WebRTC signaling
        case "webrtc_offer":
          handleWebRTCOffer(data);
          break;

        case "webrtc_answer":
          handleWebRTCAnswer(data);
          break;

        case "webrtc_ice_candidate":
          handleICECandidate(data);
          break;
      }
    };

    socket.addEventListener("message", handleSocketMessage);

    return () => {
      socket.removeEventListener("message", handleSocketMessage);
    };
  }, [socket, isInCall, currentUserId, roomId]);

  // Create WebRTC peer connection
  const  createPeerConnection = async (targetUserId: string) => {
    if (peerConnectionsRef.current[targetUserId]) return;

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });

    // Add local stream tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.log("local stream not found");
      return;
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "webrtc_ice_candidate",
            candidate: event.candidate,
            targetUserId,
            roomId: Number(roomId),
          })
        );
      }
    };

    // Handle incoming streams
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];

      // Create audio element for remote stream
      const audioElement = new Audio();
      audioElement.srcObject = remoteStream;
      audioElement.autoplay = true;

      // Associate with user ID for later cleanup
      audioElement.dataset.userId = targetUserId;
      document.body.appendChild(audioElement);
    };

    // Save the peer connection
    peerConnectionsRef.current[targetUserId] = peerConnection;

    // If we're the one joining, create an offer
    if (isInCall && localStreamRef.current) {
      await createOffer(targetUserId, peerConnection);
    }

    return peerConnection;
  };

  // Create and send an offer
  const createOffer = async (
    targetUserId: string,
    peerConnection: RTCPeerConnection
  ) => {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "webrtc_offer",
            offer,
            targetUserId,
            roomId: Number(roomId),
          })
        );
      }
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  // Handle incoming WebRTC offer
  const handleWebRTCOffer = async (data: any) => {
    const { fromUserId, offer } = data;

    // Create peer connection if it doesn't exist
    let peerConnection = peerConnectionsRef.current[fromUserId];
    if (!peerConnection ) {
      const newPeerConnection = await createPeerConnection(fromUserId);
      if (!newPeerConnection) return;
      peerConnection = newPeerConnection;
    }

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "webrtc_answer",
            answer,
            targetUserId: fromUserId,
            roomId: Number(roomId),
          })
        );
      }
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  // Handle incoming WebRTC answer
  const handleWebRTCAnswer = async (data: any) => {
    const { fromUserId, answer } = data;

    const peerConnection = peerConnectionsRef.current[fromUserId];
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  // Handle incoming ICE candidate
  const handleICECandidate = async (data: any) => {
    const { fromUserId, candidate } = data;

    const peerConnection = peerConnectionsRef.current[fromUserId];
    if (!peerConnection) return;

    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  };

  // Join the call
  const joinCall = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    setIsInCall(true);

    socket.send(
      JSON.stringify({
        type: "join_call",
        roomId: Number(roomId),
        isMuted: false,
      })
    );
  };

  // Leave the call
  const leaveCall = () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "leave_call",
          roomId: Number(roomId),
        })
      );
    }

    // Stop audio tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    Object.keys(peerConnectionsRef.current).forEach((userId) => {
      peerConnectionsRef.current[userId].close();

      // Remove associated audio elements
      const audioElement = document.querySelector(
        `audio[data-user-id="${userId}"]`
      );
      if (audioElement) {
        audioElement.remove();
      }
    });

    peerConnectionsRef.current = {};
    setIsInCall(false);
    setIsMuted(false);
    setIsAudioReady(false);
  };

  // Toggle mute status
  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  return (
    <div className="flex flex-col items-end gap-2 cursor-default">
      {/* Call Controls */}
      <div className="flex bg-white/5 backdrop-blur-md p-2 rounded-tl-full rounded-bl-full border border-r-0 border-white/20 shadow-md">
        {isInCall ? (
          <>
            <button
              onClick={toggleMute}
              className={`rounded-full p-2 ${
                isMuted
                  ? "bg-red-600 text-red-300"
                  : "bg-green-600 text-green-300"
              } mr-2`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
            </button>
            <button
              onClick={leaveCall}
              className="bg-red-700 text-white rounded-full p-2"
              title="Leave call"
            >
              <PhoneOffIcon size={20} />
            </button>
          </>
        ) : (
          <button
            onClick={joinCall}
            className="bg-green-600 text-white rounded-full p-2"
            title="Join call"
          >
            <PhoneIcon size={20} />
          </button>
        )}
      </div>

      {/* Call Participants */}
      {isInCall && callParticipants.length > 0 && (
        <div className="bg-white/5 backdrop-blur-md text-gray-200 p-3 rounded-tl-lg rounded-bl-lg border border-r-0 border-white/20 shadow-md min-w-48">
          <h3 className="text-sm font-semibold mb-2">Call Participants</h3>
          <ul className="space-y-2">
            {callParticipants.map((participant) => (
              <li
                key={participant.userId}
                className="flex items-center justify-between text-sm"
              >
                <span>{participant.username}</span>
                {participant.isMuted ? (
                  <MicOffIcon size={16} className="text-red-400" />
                ) : (
                  <MicIcon size={16} className="text-green-400" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Loading indicator */}
      {isInCall && !isAudioReady && (
        <div className="bg-gray-800 text-gray-200 p-3 rounded-lg shadow-md">
          <p className="text-sm">Connecting audio...</p>
        </div>
      )}
    </div>
  );
}
