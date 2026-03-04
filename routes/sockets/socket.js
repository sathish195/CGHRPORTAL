// const jwt = require("jsonwebtoken");
// const redis = require("../helpers/rediscon");
// const { USER } = require("../models/user");
// const chatSocket = require("./chat.socket");
// const call_sfu_Socket = require("./call.sfu.socket");

// const config = require("../config");

// module.exports = (io) => {
//   io.use(async (socket, next) => {
//     try {
//       const token = socket.handshake.auth?.token;
//       if (!token) return next(new Error("NO_TOKEN"));

//       const decoded = jwt.verify(token, config.JWTPRIVATEKEY);

//       const user = await USER.findOne({ username: decoded.username });
//       if (!user || user.user_status !== "active") {
//         return next(new Error("ACCOUNT_DISABLED"));
//       }

//       socket.username = user.username;
//       next();
//     } catch {
//       next(new Error("AUTH_FAILED"));
//     }
//   });

//   io.on("connection", async (socket) => {
//     const username = socket.username;
//     const platform = socket.handshake.auth?.platform || "unknown";

//     await USER.updateOne(
//       { username },
//       {
//         presence_status: "online",
//         $push: {
//           devices: {
//             socketId: socket.id,
//             platform,
//             lastActive: new Date(),
//           },
//         },
//       },
//     );

//     socket.join(username);
//     await redis.redisAddSocket(username, socket.id);
//     chatSocket(io, socket);
//     call_sfu_Socket(io, socket);
//     socket.on("disconnect", async () => {
//       await USER.updateOne(
//         { username },
//         {
//           $pull: { devices: { socketId: socket.id } },
//           lastSeen: new Date(),
//         },
//       );

//       await redis.redisRemoveSocket(username, socket.id);

//       // 🔥 CRITICAL FIX (prevents stuck busy)
//       await redis.redisClearOnCall(username);

//       const count = await redis.redisSocketCount(username);
//       if (count === 0) {
//         await USER.updateOne({ username }, { presence_status: "offline" });
//       }
//     });
//   });
// };
