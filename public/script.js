const socket = io();

const videoGrid = document.getElementById("video-grid");

const name = localStorage.getItem("name");
const roomId = localStorage.getItem("room");

document.getElementById("info").innerText = name + " - Room: " + roomId;

let localStream;
let peers = {};

// 🔥 ICE SERVER (QUAN TRỌNG NHẤT)
const config = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

// Lấy media (có cam thì lấy, không có vẫn ok)
async function getMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

getMedia().then((stream) => {
  localStream = stream;
  addVideo(stream, true);

  socket.emit("join-room", {
    roomId,
    userId: socket.id,
    name,
  });
});

socket.on("user-connected", ({ userId }) => {
  createPeer(userId, true);
});

socket.on("user-disconnected", (userId) => {
  if (peers[userId]) peers[userId].close();
});

function createPeer(userId, initiator) {
  const peer = new RTCPeerConnection(config);

  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream);
  });

  peer.ontrack = (e) => {
    addVideo(e.streams[0]);
  };

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("signal", { userId, candidate: e.candidate });
    }
  };

  socket.on("signal", (data) => {
    if (data.candidate) {
      peer.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });

  peers[userId] = peer;
}

function addVideo(stream, mute = false) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.muted = mute;
  videoGrid.append(video);
}

// 🎤 Mic
function toggleMic() {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}

// 🚪 Rời
function leave() {
  window.location.href = "/";
}

// 🖥️ Share screen
async function shareScreen() {
  const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });

  const track = screen.getVideoTracks()[0];

  for (let id in peers) {
    const sender = peers[id].getSenders().find((s) => s.track.kind === "video");
    sender.replaceTrack(track);
  }

  track.onended = () => {
    const cam = localStream.getVideoTracks()[0];
    for (let id in peers) {
      const sender = peers[id]
        .getSenders()
        .find((s) => s.track.kind === "video");
      sender.replaceTrack(cam);
    }
  };
}
