// /topwallet task------

const axios = require("axios");
const token = process.env.TELEGRAM_BOT_TOKENN;

const subGroupMap = {
  Contactus: {
    chat_id: -1003500953250,
    message_thread_id: 2, // HR topic/thread
  },
  all: {
    chat_id: -1003500953250, // Main group (no topic)
  },
};

// ✅ Sends message to appropriate group or topic
async function alertDev(message, type = "all") {
  const groupInfo = subGroupMap[type];
  console.log(groupInfo);

  if (!groupInfo) {
    console.warn(`❌ Group type "${type}" not found`);
    return;
  }

  await sendMessage(groupInfo, message, token);
}

//main function
async function sendMessage({ chat_id, message_thread_id }, message, token) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const payload = {
      chat_id,
      text: message,
      parse_mode: "Markdown",
    };

    if (message_thread_id !== undefined) {
      payload.message_thread_id = message_thread_id;
    }

    await axios.post(url, payload);
  } catch (err) {
    console.error(
      `❌ Failed to send message to chat ID ${chat_id}:`,
      err.response?.data || err.message
    );
  }
}

module.exports = { alertDev };
