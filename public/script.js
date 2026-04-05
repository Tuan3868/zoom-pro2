const socket = io();

const videoGrid = document.getElementById("video-grid");

const name = localStorage.getItem("name");
const roomId = localStorage.getItem("room");

document.getElementById("info").innerText = name + " - Room: " + roomId;

let localStream;
let peers = {};
let videoEnabled = true;

// 🔥 ICE SERVER (xuyên mạng)
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

// 🎥 LẤY CAM + MIC (có cam thì lấy, không có vẫn vào được)
async function getMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
  }
}

// 🚀 START
getMedia().then((stream) => {
  localStream = stream;
  addVideo(stream, true);

  socket.emit("join-room", { roomId, name });
});

// 👥 NHẬN DANH SÁCH USER
socket.on("all-users", (users) => {
  users.forEach((user) => {
    if (user.id !== socket.id) {
      createPeer(user.id, true);
    }
  });
});

// 👤 USER MỚI
socket.on("user-connected", (user) => {
  createPeer(user.id, false);
});

// 🔁 SIGNAL
socket.on("signal", async ({ from, data }) => {
  let peer = peers[from];

  if (!peer) {
    peer = createPeer(from, false);
  }

  if (data.sdp) {
    await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));

    if (data.sdp.type === "offer") {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("signal", {
        to: from,
        data: { sdp: peer.localDescription },
      });
    }
  }

  if (data.candidate) {
    await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});

// 🔗 TẠO PEER
function createPeer(userId, initiator) {
  const peer = new RTCPeerConnection(config);

  peers[userId] = peer;

  localStream.getTracks().forEach((track) => {
    peer.addTrack(track, localStream);
  });

  peer.ontrack = (e) => {
    addVideo(e.streams[0]);
  };

  peer.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("signal", {
        to: userId,
        data: { candidate: e.candidate },
      });
    }
  };

  if (initiator) {
    peer.createOffer().then((offer) => {
      peer.setLocalDescription(offer);
      socket.emit("signal", {
        to: userId,
        data: { sdp: offer },
      });
    });
  }

  return peer;
}

// 🎥 HIỂN THỊ VIDEO
function addVideo(stream, mute = false) {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.autoplay = true;
  video.muted = mute;
  videoGrid.append(video);
}

// 🎤 MIC
function toggleMic() {
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
}

// 📷 CAMERA (🔥 bạn vừa thêm)
function toggleCam() {
  if (!localStream) return;

  videoEnabled = !videoEnabled;

  localStream.getVideoTracks().forEach((track) => {
    track.enabled = videoEnabled;
  });
}

// 🚪 RỜI PHÒNG
function leave() {
  window.location.href = "/";
}

// 🖥️ SHARE MÀN HÌNH
async function shareScreen() {
  const screen = await navigator.mediaDevices.getDisplayMedia({
    video: true,
  });

  const track = screen.getVideoTracks()[0];

  for (let id in peers) {
    const sender = peers[id].getSenders().find((s) => s.track.kind === "video");

    if (sender) sender.replaceTrack(track);
  }

  track.onended = () => {
    const cam = localStream.getVideoTracks()[0];

    for (let id in peers) {
      const sender = peers[id]
        .getSenders()
        .find((s) => s.track.kind === "video");

      if (sender) sender.replaceTrack(cam);
    }
  };
}
