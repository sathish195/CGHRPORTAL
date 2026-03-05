const express = require("express");
const router = express.Router();
const {Auth}  = require("../middlewares/auth");
const { CONVERSATION } = require("../models/chat/conversation");
const { MESSAGE } = require("../models/chat/message");
const { USER } = require("../models/add_employee");
const redis = require("../helpers/redisFunctions");
const validations = require("../helpers/schema");



// --------------------
// Private & Group setup
// --------------------
router.post("/private", Auth, async (req, res) => {
  const { username } = req;
  const io = req.app.get("io");

  const { error, value } = validations.otherUser(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { otherUser } = value;
  let find_otheruser = await USER.findOne({ username: otherUser });
  if (!find_otheruser) {
    return res.status(404).json({ message: "User not found" });
  }
  let convo = await CONVERSATION.findOne({
    type: "private",
    members: { $all: [username, otherUser] },
  });

  let isNew = false;

  if (!convo) {
    const privateKey = [username, otherUser].sort().join("_");
    convo = await CONVERSATION.create({
      type: "private",
      members: [username, otherUser],
      privateKey,
    });
    isNew = true;
  } //  ONLY if newly created

  if (isNew) {
    const payload = {
      conversationId: convo._id,
      type: "private",
      members: convo.members,
      lastMessage: null,
      updatedAt: convo.createdAt,
      unreadCount: 0,
    }; // emit to both users

    const users = [username, otherUser];

    for (const user of users) {
      const sockets = await redis.redisGetSockets(user);
      sockets.forEach((sid) => {
        io.to(sid).emit("conversation_created", payload);
      });
    }
  }

  res.json(convo);
});
router.post("/group", Auth,  async (req, res) => {
  const { username } = req;
  const io = req.app.get("io");

  const { error, value } = validations.createGroup(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { members, name, description } = value;

  const convo = await CONVERSATION.create({
    type: "group",
    members: [username, ...members],
    admins: [username],
    groupInfo: { name, description },
  });

  const payload = {
    conversationId: convo._id,
    type: "group",
    members: convo.members,
    groupInfo: convo.groupInfo,
    lastMessage: null,
    updatedAt: convo.createdAt,
    unreadCount: 0,
  }; //  notify all group members

  for (const member of convo.members) {
    const sockets = await redis.redisGetSockets(member);
    sockets.forEach((sid) => {
      io.to(sid).emit("conversation_created", payload);
    });
  }

  res.json(convo);
});

// --------------------
// Fetching conversations & messages
// --------------------
router.get("/conversations", Auth, async (req, res) => {
  try {
    const username = req.username;

    const conversations = await CONVERSATION.find({
      members: username,
    })
      .sort({ updatedAt: -1 })
      .lean();

    const result = await Promise.all(
      conversations.map(async (conv) => {
        let lastMessage = null;

        if (conv.lastMessageId) {
          lastMessage = await MESSAGE.findOne({
            messageId: conv.lastMessageId,
          }).lean();
        }

        const unreadCount = await redis.redisGetUnread(
          username,
          conv._id.toString(),
        );

        return {
          conversationId: conv._id,
          type: conv.type,
          members: conv.members,
          admins: conv.admins || [],
          groupInfo: conv.groupInfo || null,
          lastMessage,
          updatedAt: conv.updatedAt,
          unreadCount: unreadCount || 0,
        };
      }),
    );

    res.json(result);
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(400).json({ message: "Server error" });
  }
});
router.post("/messages", Auth, async (req, res) => {
  const username = req.username;

  const { error, value } = validations.getMessages(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { conversationId, limit = 30, skip = 0 } = value;

  const convo = await CONVERSATION.findById(conversationId);
  if (!convo) {
    return res.status(404).json({ message: "Conversation not found" });
  }

  if (!convo.members.includes(username)) {
    return res.status(403).json({
      message: "You are not a member of this conversation",
    });
  }

  const messages = await MESSAGE.find({
    conversationId: convo._id,
  })
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit))
    .lean();

  res.json(messages.reverse());
});

// --------------------
// Group management
// --------------------
router.post("/group/add-members", Auth,  async (req, res) => {
  const { username } = req;
  const io = req.app.get("io");

  const { error, value } = validations.groupMembers(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { conversationId, members } = value;

  const convo = await CONVERSATION.findById(conversationId);
  if (!convo || convo.type !== "group")
    return res.status(404).json({ message: "Group not found" });

  if (!convo.admins.includes(username))
    return res.status(403).json({ message: "Only admins can add members" });

  const newMembers = members.filter((m) => !convo.members.includes(m));
  if (!newMembers.length)
    return res.status(400).json({ message: "Users already in group" });

  convo.members.push(...newMembers);
  await convo.save();

  await emitToUsers(io, convo.members, "group:members_added", {
    conversationId,
    addedBy: username,
    members: newMembers,
  });

  res.json({ members: convo.members });
});
router.post("/group/remove-member", Auth, async (req, res) => {
  const { username } = req;
  const io = req.app.get("io");

  const { error, value } = validations.groupAdmin(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { conversationId, member } = value;

  const convo = await CONVERSATION.findById(conversationId);
  if (!convo || convo.type !== "group")
    return res.status(404).json({ message: "Group not found" });

  if (!convo.admins.includes(username))
    return res.status(403).json({ message: "Only admins can remove members" });

  convo.members = convo.members.filter((m) => m !== member);
  convo.admins = convo.admins.filter((a) => a !== member);

  if (!convo.admins.length && convo.members.length) {
    convo.admins.push(convo.members[0]);
  }

  await convo.save();

  await emitToUsers(io, convo.members.concat(member), "group:member_removed", {
    conversationId,
    removedBy: username,
    member,
  });
  res.json({ members: convo.members });
});
router.post("/group/make-admin", Auth, async (req, res) => {
  const { username } = req;
  const io = req.app.get("io");

  const { error, value } = validations.groupAdmin(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { conversationId, member } = value;

  const convo = await CONVERSATION.findById(conversationId);
  if (!convo || convo.type !== "group")
    return res.status(404).json({ message: "Group not found" });

  if (!convo.admins.includes(username))
    return res.status(403).json({ message: "Only admins can promote" });

  if (!convo.members.includes(member))
    return res.status(400).json({ message: "User not in group" });

  if (!convo.admins.includes(member)) {
    convo.admins.push(member);
    await convo.save();
  }

  await emitToUsers(io, convo.members, "group:admin_added", {
    conversationId,
    addedBy: username,
    admin: member,
  });

  res.json({ admins: convo.admins });
});
router.post("/group/remove-admin", Auth,  async (req, res) => {
  const { username } = req;
  const io = req.app.get("io");

  const { error, value } = validations.groupAdmin(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { conversationId, member } = value;

  const convo = await CONVERSATION.findById(conversationId);
  if (!convo || convo.type !== "group")
    return res.status(404).json({ message: "Group not found" });

  if (!convo.admins.includes(username))
    return res.status(403).json({ message: "Only admins can demote" });

  if (convo.admins.length === 1)
    return res.status(400).json({ message: "At least one admin required" });

  convo.admins = convo.admins.filter((a) => a !== member);
  await convo.save();

  await emitToUsers(io, convo.members, "group:admin_removed", {
    conversationId,
    removedBy: username,
    admin: member,
  });

  res.json({ admins: convo.admins });
});
router.post("/group/leave", Auth, async (req, res) => {
  const { username } = req;
  const io = req.app.get("io");

  const { error, value } = validations.leaveGroup(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  const { conversationId } = value;

  const convo = await CONVERSATION.findById(conversationId);
  if (!convo || convo.type !== "group")
    return res.status(404).json({ message: "Group not found" });

  convo.members = convo.members.filter((m) => m !== username);
  convo.admins = convo.admins.filter((a) => a !== username);

  if (!convo.admins.length && convo.members.length) {
    convo.admins.push(convo.members[0]);
  }

  await convo.save();

  await emitToUsers(io, convo.members, "group:member_left", {
    conversationId,
    username,
  });

  res.json({ message: "Left group" });
});

module.exports = router;

