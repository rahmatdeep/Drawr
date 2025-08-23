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
  const [permissionStatus, setPermissionStatus] = useState<
    "prompt" | "granted" | "denied" | "checking"
  >("prompt");

  // Sound notification refs
  const userJoinSoundRef = useRef<HTMLAudioElement | null>(null);
  const userLeaveSoundRef = useRef<HTMLAudioElement | null>(null);
  const userMuteSoundRef = useRef<HTMLAudioElement | null>(null);
  const userUnmuteSoundRef = useRef<HTMLAudioElement | null>(null);

  // WebRTC related refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [userId: string]: RTCPeerConnection }>(
    {}
  );
  const audioContextRef = useRef<AudioContext | null>(null);

  // Negotiation state tracking
  const makingOfferRef = useRef<{ [userId: string]: boolean }>({});
  const ignoreOfferRef = useRef<{ [userId: string]: boolean }>({});

  // Initialize sound notification refs
  useEffect(() => {
    userJoinSoundRef.current = new Audio("/sounds/join.mp3");
    userLeaveSoundRef.current = new Audio("/sounds/leave.mp3");
    userMuteSoundRef.current = new Audio("/sounds/mute.mp3");
    userUnmuteSoundRef.current = new Audio("/sounds/unmute.mp3");

    // Set volume for all sounds (0.0 to 1.0, where 1.0 is full volume)
    // Adjust this value to make sounds quieter - 0.3 is a good starting point
    const soundVolume = 0.3;

    userJoinSoundRef.current.volume = soundVolume;
    userLeaveSoundRef.current.volume = soundVolume;
    userMuteSoundRef.current.volume = soundVolume;
    userUnmuteSoundRef.current.volume = soundVolume;

    // Preload audio files
    userJoinSoundRef.current.load();
    userLeaveSoundRef.current.load();
    userMuteSoundRef.current.load();
    userUnmuteSoundRef.current.load();

    return () => {
      // Clean up audio elements
      userJoinSoundRef.current = null;
      userLeaveSoundRef.current = null;
      userMuteSoundRef.current = null;
      userUnmuteSoundRef.current = null;
    };
  }, []);

  // Function to play notification sounds
  const playNotificationSound = (
    soundType: "join" | "leave" | "mute" | "unmute",
    ignoreInCallCheck = false
  ) => {
    if (!isInCall && !ignoreInCallCheck) return;

    let soundRef: React.RefObject<HTMLAudioElement | null>;

    switch (soundType) {
      case "join":
        soundRef = userJoinSoundRef;
        break;
      case "leave":
        soundRef = userLeaveSoundRef;
        break;
      case "mute":
        soundRef = userMuteSoundRef;
        break;
      case "unmute":
        soundRef = userUnmuteSoundRef;
        break;
    }
    //sets playback time to 0 and plays the sound
    if (soundRef.current) {
      soundRef.current.currentTime = 0;
      soundRef.current.play().catch((err) => {
        console.warn("Could not play notification sound:", err);
      });
    }
  };

  // Set up WebRTC audio
  useEffect(() => {
    if (!isInCall) return;

    const initializeAudio = async () => {
      try {
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
        setPermissionStatus("granted"); // Update permission status

        // Initialize audio context for visualizations if needed
        audioContextRef.current = new AudioContext();
      } catch (err: any) {
        console.error("Error accessing microphone during call setup:", err);

        // Check if this is a permission error
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setPermissionStatus("denied");
          alert(
            "Microphone permission denied. Please enable microphone access in your browser settings."
          );
        } else {
          alert(
            `Couldn't access your microphone: ${err.message}. Please check your device settings.`
          );
        }
        leaveCall();
      }
    };

    initializeAudio();

    return () => {
      // Clean up audio when unmounting or leaving call
      if (localStreamRef.current) {
        console.log("Cleaning up audio tracks...");
        localStreamRef.current.getTracks().forEach((track) => {
          console.log(`Stopping track: ${track.label}`);
          track.stop();
        });
        localStreamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        console.log("Closing audio context");
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
      // Play mute/unmute sound
      playNotificationSound(isMuted ? "mute" : "unmute");
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
                // Play join sound if it's not the current user
                if (data.user.userId !== currentUserId) {
                  playNotificationSound("join");
                }
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
          setCallParticipants((prev) => {
            const userExists = prev.some((p) => p.userId === data.userId);
            if (userExists && data.userId !== currentUserId) {
              // Play leave sound if it's not the current user
              playNotificationSound("leave");
            }
            return prev.filter((p) => p.userId !== data.userId);
          });

          // Close and clean up peer connection
          if (peerConnectionsRef.current[data.userId]) {
            peerConnectionsRef.current[data.userId].close();
            delete peerConnectionsRef.current[data.userId];
          }
          break;

        case "user_mute_changed":
          // Update mute status for a user
          setCallParticipants((prev) => {
            // Play mute/unmute sound if it's not the current user
            if (data.userId !== currentUserId) {
              // playNotificationSound(data.isMuted ? "mute" : "unmute");
            }
            return prev.map((p) =>
              p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p
            );
          });
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
  const createPeerConnection = (targetUserId: string) => {
    if (peerConnectionsRef.current[targetUserId]) return;

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Initialize negotiation state for this peer
    makingOfferRef.current[targetUserId] = false;
    ignoreOfferRef.current[targetUserId] = false;

    // Add local stream tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log("Adding track to peer connection:", track);

        peerConnection.addTrack(track, localStreamRef.current!);
      });
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

    // Handle negotiation needed - using the polite peer model
    peerConnection.onnegotiationneeded = async () => {
      try {
        // Determine if this peer should be the one making the offer
        // Simple deterministic approach: compare user IDs
        const isPolite = currentUserId > targetUserId;

        // Only proceed if we're the polite peer or there's no collision
        if (isPolite || !makingOfferRef.current[targetUserId]) {
          console.log(`Negotiation needed for peer ${targetUserId}`);
          makingOfferRef.current[targetUserId] = true;

          const offer = await peerConnection.createOffer();

          // Check if connection is still valid before proceeding
          if (peerConnection.signalingState === "closed") {
            console.log("Connection closed during offer creation");
            return;
          }

          await peerConnection.setLocalDescription(offer);

          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "webrtc_offer",
                offer: peerConnection.localDescription,
                targetUserId,
                roomId: Number(roomId),
              })
            );
          }
        }
      } catch (error) {
        console.error("Error during negotiation:", error);
      } finally {
        makingOfferRef.current[targetUserId] = false;
      }
    };

    // Save the peer connection
    peerConnectionsRef.current[targetUserId] = peerConnection;

    return peerConnection;
  };

  // Handle incoming WebRTC offer
  const handleWebRTCOffer = async (data: any) => {
    const { fromUserId, offer } = data;

    // Determine politeness based on user IDs
    const isPolite = currentUserId > fromUserId;

    console.log(`Received offer from ${fromUserId}, isPolite: ${isPolite}`);

    // Create peer connection if it doesn't exist
    let peerConnection = peerConnectionsRef.current[fromUserId];
    if (!peerConnection) {
      const newPeerConnection = createPeerConnection(fromUserId);
      if (!newPeerConnection) return;
      peerConnection = newPeerConnection;
    }

    // Check for offer collision
    const readyForOffer =
      !makingOfferRef.current[fromUserId] &&
      (peerConnection.signalingState === "stable" ||
        peerConnection.signalingState === "have-remote-offer");

    const offerCollision = !readyForOffer;

    // If we're impolite and there's a collision, ignore this offer
    if (!isPolite && offerCollision) {
      console.warn("Ignoring offer due to collision (impolite peer)");
      return;
    }

    // Log current state for debugging
    console.log("Signaling State:", peerConnection.signalingState);
    console.log("Local Description:", peerConnection.localDescription);
    console.log("Remote Description:", peerConnection.remoteDescription);

    try {
      // If we have a collision and we're polite, roll back
      if (offerCollision && isPolite) {
        console.log(
          "Polite peer rolling back local description due to collision"
        );
        await peerConnection.setLocalDescription({ type: "rollback" });
      }

      // Set the remote description (the offer)
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      // Create and send an answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "webrtc_answer",
            answer: peerConnection.localDescription,
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
    if (!peerConnection) {
      console.warn(`No peer connection for user ${fromUserId}`);
      return;
    }

    // Only set remote description if we're in the right state
    if (peerConnection.signalingState !== "have-local-offer") {
      console.warn(
        `Cannot set remote answer in state: ${peerConnection.signalingState}`
      );
      return;
    }

    try {
      console.log(`Setting remote description (answer) from ${fromUserId}`);
      console.log("Current signaling state:", peerConnection.signalingState);

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      console.log("Remote description set successfully");
      console.log("New signaling state:", peerConnection.signalingState);
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

  // Check mic permissions
  const checkMicrophonePermission = async () => {
    try {
      setPermissionStatus("checking");

      // Try using the Permissions API first
      const permissionResult = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });

      permissionResult.onchange = () => {
        setPermissionStatus(
          permissionResult.state as "prompt" | "granted" | "denied"
        );
      };

      setPermissionStatus(
        permissionResult.state as "prompt" | "granted" | "denied"
      );

      // If permission is already granted, return true immediately
      if (permissionResult.state === "granted") {
        return true;
      }

      // If permission is prompt, we need to actually request access to verify
      if (permissionResult.state === "prompt") {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

          // We don't need this stream now, so stop all tracks
          stream.getTracks().forEach((track) => {
            track.stop();
          });

          setPermissionStatus("granted");
          return true;
        } catch (err) {
          console.error("Failed to get audio stream after prompt:", err);
          setPermissionStatus("denied");
          return false;
        }
      }

      return (
        (permissionResult.state as "granted" | "denied" | "prompt") ===
        "granted"
      );
    } catch (error) {
      console.error("Error with Permissions API:", error);

      // Fall back to trying to access the microphone directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        // We don't need this stream now, so stop all tracks
        stream.getTracks().forEach((track) => {
          track.stop();
        });

        setPermissionStatus("granted");
        return true;
      } catch (err) {
        console.error("Microphone access denied in fallback:", err);
        setPermissionStatus("denied");
        return false;
      }
    }
  };

  // Join the call
  const joinCall = async () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    // Check permission first
    const hasPermission = await checkMicrophonePermission();

    if (!hasPermission) {
      alert(
        "Microphone permission is required to join the call. Please grant permission and try again."
      );
      return;
    }

    setIsInCall(true);

    socket.send(
      JSON.stringify({
        type: "join_call",
        roomId: Number(roomId),
        isMuted: false,
      })
    );
    // Play join sound for self
    playNotificationSound("join", true); // Bypass the isInCall check
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
      // Play leave sound for self
      playNotificationSound("leave");
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
      {/* Permission denied warning */}
      {permissionStatus === "denied" && (
        <div className="bg-red-700/90 text-white p-3 rounded-tl-lg rounded-bl-lg border border-r-0 border-white/20 shadow-md">
          <p className="text-sm">
            Microphone access denied. Please enable it in your browser settings.
          </p>
        </div>
      )}
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
      {/* Hidden audio elements for notification sounds */}
      <audio ref={userJoinSoundRef} preload="auto" />
      <audio ref={userLeaveSoundRef} preload="auto" />
      <audio ref={userMuteSoundRef} preload="auto" />
      <audio ref={userUnmuteSoundRef} preload="auto" />
    </div>
  );
}
