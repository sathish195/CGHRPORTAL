const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      unique: true,
      index: true,
    },

    conversationId: {
      type: String,
      required: true,
      index: true,
    },

    sender: {
      type: String, // username
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "audio", "file", "call"],
      default: "text",
    },

    content: String,

    media: {
      url: String,
      mime: String,
      size: Number,
      duration: Number,
      thumbnail: String,
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },

    readBy: {
      type: [String], // usernames
      default: [],
    },
    deletedFor: {
      type: [String], // usernames
      default: [],
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports.MESSAGE = mongoose.model("MESSAGE", messageSchema);
