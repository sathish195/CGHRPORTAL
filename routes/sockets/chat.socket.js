// const { MESSAGE } = require("../models/message");
// const { CONVERSATION } = require("../../models/chat/conversation");
// const redis = require("../helpers/rediscon");
// const { v4: uuidv4 } = require("uuid");
// const validations = require("../helpers/validations");
// module.exports = (io, socket) => {
//   /**
//    * SEND MESSAGE
//    */
//   socket.on("send_message", async (data) => {
//     try {
//       // Basic payload guard
//       if (!data || typeof data !== "object") {
//         return socket.emit("error", {
//           code: "INVALID_PAYLOAD",
//           message: "Invalid message payload",
//         });
//       }

//       // Joi validation
//       const validatedData = validations.send_message_socket(data, socket);
//       if (!validatedData) return;

//       const { conversationId, type, content, media } = validatedData;
//       const sender = socket.username;
//       const messageId = uuidv4();

//       // 🔒 MEMBERSHIP CHECK (MUST BE FIRST)
//       const convo = await CONVERSATION.findById(conversationId);
//       if (!convo || !convo.members.includes(sender)) {
//         return socket.emit("error", {
//           code: "NOT_A_MEMBER",
//           message: "You are not a member of this conversation",
//         });
//       }

//       // ✅ CREATE MESSAGE
//       const message = await MESSAGE.create({
//         messageId,
//         conversationId,
//         sender,
//         type,
//         content,
//         media,
//       });

//       // Update conversation last message
//       await CONVERSATION.updateOne(
//         { _id: conversationId },
//         { lastMessageId: messageId, updatedAt: new Date() }
//       );
//       let deliveredMarked = false;

//       for (const member of convo.members) {
//         if (member === sender) continue;

//         const socketCount = await redis.redisSocketCount(member);

//         if (socketCount === 0) {
//           await redis.redisPushOfflineMessage(member, message);
//           await redis.redisIncrementUnread(member, conversationId);
//         } else {
//           const sockets = await redis.redisGetSockets(member);

//           sockets.forEach((sid) => {
//             io.to(sid).emit("new_message", message);
//             io.to(sid).emit("chat_list_update", {
//               conversationId,
//               lastMessage: {
//                 sender,
//                 type,
//                 content,
//                 media,
//                 createdAt: new Date(),
//               },
//             });
//           });

//           // ✅ MARK DELIVERED ONLY ONCE
//           if (!deliveredMarked) {
//             await MESSAGE.updateOne(
//               { messageId, status: { $ne: "read" } },
//               { status: "delivered" }
//             );
//             deliveredMarked = true;
//           }
//         }
//       }

//       // Sender acknowledgement
//       socket.emit("message_sent", message);
//     } catch (err) {
//       console.error("send_message error:", err);
//       socket.emit("error", {
//         code: "SERVER_ERROR",
//         message: "Failed to send message",
//       });
//     }
//   });

//   /**
//    * TYPING INDICATOR
//    */ socket.on("typing", async ({ conversationId }) => {
//     try {
//       const convo = await CONVERSATION.findById(conversationId);
//       if (!convo || !convo.members.includes(socket.username)) return;

//       const typingKey = `typing:${conversationId}:${socket.username}`;
//       const alreadyTyping = await redis.redisIsTyping(typingKey);

//       if (!alreadyTyping) {
//         await redis.redisSetTyping(typingKey);

//         for (const member of convo.members) {
//           if (member === socket.username) continue;
//           const sockets = await redis.redisGetSockets(member);
//           sockets.forEach((sid) => {
//             io.to(sid).emit("typing", {
//               conversationId,
//               username: socket.username,
//             });
//           });
//         }
//       }
//     } catch (err) {
//       console.error("typing debounce error:", err);
//     }
//   });

//   /**
//    * READ RECEIPT
//    */ socket.on("read_message", async ({ messageId }) => {
//     try {
//       const msg = await MESSAGE.findOne({ messageId });
//       if (!msg || msg.readBy?.includes(socket.username)) return;

//       const convo = await CONVERSATION.findById(msg.conversationId);
//       if (!convo || !convo.members.includes(socket.username)) return;

//       await MESSAGE.updateOne(
//         { messageId },
//         {
//           $addToSet: { readBy: socket.username },
//           status: "read",
//         }
//       );
//       await redis.redisResetUnread(
//         socket.username,
//         msg.conversationId.toString()
//       );
//       //   const convo = await CONVERSATION.findById(msg.conversationId);
//       //   if (!convo) return;

//       for (const member of convo.members) {
//         if (member === socket.username) continue;

//         const sockets = await redis.redisGetSockets(member);
//         sockets.forEach((sid) => {
//           io.to(sid).emit("message_read", {
//             messageId,
//             readBy: socket.username,
//             conversationId: msg.conversationId,
//           });
//         });
//       }
//     } catch (err) {
//       console.error("read_message error:", err);
//     }
//   });

//   /**
//    * FETCH OFFLINE MESSAGES
//    */
//   socket.on("fetch_offline", async () => {
//     try {
//       const messages = await redis.redisPopOfflineMessages(socket.username);

//       for (const msg of messages) {
//         socket.emit("new_message", msg);

//         await MESSAGE.updateOne(
//           { messageId: msg.messageId, status: { $ne: "read" } },
//           { status: "delivered" }
//         );
//       }
//     } catch (err) {
//       console.error("fetch_offline error:", err);
//       socket.emit("error", {
//         code: "SERVER_ERROR",
//         message: "Failed to fetch offline messages",
//       });
//     }
//   });

//   socket.on("open_chat", async ({ conversationId }) => {
//     await redis.redisResetUnread(socket.username, conversationId);
//   });

//   socket.on("delete_message", async ({ messageId, mode }) => {
//     try {
//       const msg = await MESSAGE.findOne({ messageId });
//       if (!msg) return;

//       const convo = await CONVERSATION.findById(msg.conversationId);
//       if (!convo || !convo.members.includes(socket.username)) return;

//       if (mode === "me") {
//         await MESSAGE.updateOne(
//           { messageId },
//           { $addToSet: { deletedFor: socket.username } }
//         );

//         socket.emit("message_deleted", {
//           messageId,
//           mode: "me",
//         });
//       }

//       if (mode === "everyone") {
//         if (msg.sender !== socket.username) return;

//         await MESSAGE.updateOne(
//           { messageId },
//           {
//             isDeleted: true,
//             content: null,
//             media: null,
//           }
//         );

//         for (const member of convo.members) {
//           const sockets = await redis.redisGetSockets(member);
//           sockets.forEach((sid) => {
//             io.to(sid).emit("message_deleted", {
//               messageId,
//               mode: "everyone",
//             });
//           });
//         }
//       }
//     } catch (err) {
//       console.error("delete_message error:", err);
//     }
//   });
// };
