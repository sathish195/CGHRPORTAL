const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["private", "group"],
      required: true,
    },

    members: {
      type: [String], // usernames
      required: true,
      index: true,
    },

    admins: {
      type: [String], // usernames
      default: [],
    },

    groupInfo: {
      name: String,
      icon: String,
      description: String,
    },

    lastMessageId: {
      type: String, // messageId (string)
    },
    privateKey:{type : String,index:true}
  },
  { timestamps: true }
);
// conversationSchema.index({ type: 1, members: 1 }, { unique: true });
conversationSchema.index({ privateKey: 1 }, { unique: true, sparse: true });

module.exports.CONVERSATION = mongoose.model(
  "CONVERSATION",
  conversationSchema
);
