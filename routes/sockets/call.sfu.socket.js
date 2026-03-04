// // calls.socket.js (PRODUCTION FINAL)

// const redis = require("../helpers/rediscon");
// const { CALL_LOG } = require("../models/callLog");
// const { getOrCreateRoom } = require("../mediasoup/roomManager");
// const { v4: uuidv4 } = require("uuid");

// module.exports = (io, socket) => {
//   const username = socket.username;

// //   console.log(`Socket connected: ${socket.id} | ${username}`);

//   // =====================================================
//   // PER SOCKET STATE
//   // =====================================================
//   socket.transports = {};
//   socket.producers = {};
//   socket.consumers = {};

//   // =====================================================
//   // CALL INVITE (PRIVATE + GROUP)
//   // =====================================================
//   socket.on("call_invite", async ({ roomId, members }) => {
//     try {
//       const callId = uuidv4();

//       const freeUsers = [];

//       for (const u of members) {
//         if (!(await redis.redisIsOnCall(u))) freeUsers.push(u);
//       }

//       if (!freeUsers.length) return socket.emit("all_users_busy");

//       await redis.redisSetOnCall(username);
//       for (const u of freeUsers) await redis.redisSetOnCall(u);

//       const sessionData = {
//         roomId,
//         participants: [username, ...freeUsers],
//         startedAt: Date.now(),
//         answered: false,
//       };

//       await redis.redisSetCallSession(callId, sessionData);

//       // :bell: ring everyone
//       for (const u of freeUsers) {
//         const sockets = await redis.redisGetSockets(u);

//         sockets.forEach((sid) =>
//           io.to(sid).emit("incoming_call", {
//             from: username,
//             roomId,
//             callId,
//           }),
//         );
//       }

//       // =================================================
//       // :fire: RING TIMEOUT (30s → missed call)
//       // =================================================
//       setTimeout(async () => {
//         const session = await redis.redisGetCallSession(callId);
//         if (!session || session.answered) return;

//         // console.log("Missed call timeout");

//         io.to(roomId).emit("call_timeout");

//         for (const u of session.participants) {
//           await redis.redisClearOnCall(u);
//         }

//         await redis.redisClearCallSession(callId);

//         await CALL_LOG.create({
//           callId,
//           from: username,
//           status: "missed",
//           duration: 0,
//         });
//       }, 30000);
//     } catch (err) {
//       console.error("call_invite error:", err);
//     }
//   });

//   // =====================================================
//   // JOIN ROOM (late join fix + answer detection)
//   // =====================================================
//   socket.on("join_call_room", async ({ roomId, callId }, cb) => {
//     try {
//       const room = await getOrCreateRoom(roomId);

//       socket.join(roomId);

//       // :fire: mark answered
//       if (callId) {
//         const session = await redis.redisGetCallSession(callId);
//         if (session && !session.answered) {
//           session.answered = true;
//           session.answerTime = Date.now();
//           await redis.redisSetCallSession(callId, session);
//         }
//       }

//       if (!room.peers.has(socket.id)) {
//         room.peers.set(socket.id, {
//           username,
//           producers: new Map(),
//         });
//       }

//       const existingProducers = [];

//       for (const [peerId, peer] of room.peers.entries()) {
//         if (peerId === socket.id) continue;

//         for (const producer of peer.producers.values()) {
//           existingProducers.push({
//             producerId: producer.id,
//             producerSocketId: peerId,
//             username: peer.username,
//             kind: producer.kind,
//           });
//         }
//       }

//       cb({
//         rtpCapabilities: room.router.rtpCapabilities,
//         existingProducers,
//       });
//     } catch (err) {
//       console.error("join_call_room error:", err);
//     }
//   });

//   // =====================================================
//   // CREATE TRANSPORT
//   // =====================================================
//   socket.on("create_transport", async ({ roomId }, cb) => {
//     const room = await getOrCreateRoom(roomId);

//     const transport = await room.router.createWebRtcTransport({
//       listenIps: [{ ip: "0.0.0.0", announcedIp: "3.144.17.245" }], //process.env.PUBLIC_IP }],
//       enableUdp: true,
//       enableTcp: true,
//       preferUdp: true,
//     });

//     socket.transports[transport.id] = transport;

//     transport.on("dtlsstatechange", (state) => {
//       if (state === "closed") {
//         transport.close();
//         delete socket.transports[transport.id];
//       }
//     });

//     cb({
//       id: transport.id,
//       iceParameters: transport.iceParameters,
//       iceCandidates: transport.iceCandidates,
//       dtlsParameters: transport.dtlsParameters,
//     });
//   });

//   // =====================================================
//   // CONNECT TRANSPORT
//   // =====================================================
//   socket.on(
//     "connect_transport",
//     async ({ transportId, dtlsParameters }, cb) => {
//       await socket.transports[transportId].connect({ dtlsParameters });
//       cb();
//     },
//   );

//   // =====================================================
//   // PRODUCE
//   // =====================================================
//   socket.on(
//     "produce",
//     async ({ roomId, transportId, kind, rtpParameters }, cb) => {
//       const transport = socket.transports[transportId];

//       const producer = await transport.produce({ kind, rtpParameters });

//       socket.producers[producer.id] = producer;

//       const room = await getOrCreateRoom(roomId);
//       room.peers.get(socket.id).producers.set(producer.id, producer);

//       cb({ id: producer.id });

//       // notify others
//       socket.to(roomId).emit("new_producer", {
//         producerId: producer.id,
//         producerSocketId: socket.id,
//         username,
//         kind,
//       });
//     },
//   );

//   // =====================================================
//   // CONSUME
//   // =====================================================
//   socket.on(
//     "consume",
//     async ({ roomId, producerId, rtpCapabilities, transportId }, cb) => {
//       const room = await getOrCreateRoom(roomId);

//       if (!room.router.canConsume({ producerId, rtpCapabilities }))
//         return cb({ error: "cannot consume" });

//       const consumer = await socket.transports[transportId].consume({
//         producerId,
//         rtpCapabilities,
//         paused: true,
//       });

//       socket.consumers[consumer.id] = consumer;

//       consumer.on("producerclose", () => {
//         consumer.close();
//         delete socket.consumers[consumer.id];
//         socket.emit("consumer_closed", { consumerId: consumer.id });
//       });

//       cb({
//         id: consumer.id,
//         producerId,
//         kind: consumer.kind,
//         rtpParameters: consumer.rtpParameters,
//       });
//     },
//   );

//   // =====================================================
//   // RESUME CONSUMER
//   // =====================================================
//   socket.on("resume_consumer", async ({ consumerId }) => {
//     const consumer = socket.consumers[consumerId];
//     if (consumer) await consumer.resume();
//   });

//   // =====================================================
//   // END CALL (duration tracking)
//   // =====================================================
//   socket.on("end_call", async ({ callId }) => {
//     const session = await redis.redisGetCallSession(callId);
//     if (!session) return;

//     const duration = session.answerTime
//       ? Math.floor((Date.now() - session.answerTime) / 1000)
//       : 0;

//     io.to(session.roomId).emit("call_ended", { duration });

//     for (const u of session.participants) {
//       await redis.redisClearOnCall(u);
//     }

//     await redis.redisClearCallSession(callId);

//     await CALL_LOG.create({
//       callId,
//       from: username,
//       status: "completed",
//       duration,
//     });

//     const room = await getOrCreateRoom(session.roomId);
//     if (room) room.peers.clear();
//   });

//   // =====================================================
//   // DISCONNECT CLEANUP
//   // =====================================================
//   socket.on("disconnect", async () => {
//     Object.values(socket.transports).forEach((t) => t.close());
//     Object.values(socket.producers).forEach((p) => p.close());
//     Object.values(socket.consumers).forEach((c) => c.close());

//     const roomId = [...socket.rooms].find((r) => r !== socket.id);

//     if (roomId) {
//       const room = await getOrCreateRoom(roomId);
//       if (room) room.peers.delete(socket.id);
//     }
//   });
// };
