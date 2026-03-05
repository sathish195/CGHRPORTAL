const mediasoup = require("mediasoup");
const { getWorker } = require("./worker");

const rooms = new Map();

const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
  },
];

exports.getOrCreateRoom = async (roomId) => {
  if (rooms.has(roomId)) return rooms.get(roomId);

  const worker = getWorker();
  const router = await worker.createRouter({ mediaCodecs });

  const room = {
    router,
    peers: new Map(),
  };

  rooms.set(roomId, room);
  return room;
};