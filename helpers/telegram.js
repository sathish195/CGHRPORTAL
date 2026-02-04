const axios = require("axios");
// require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const ids = [-1002901768301];

async function alertDev(messaggio) {
  for (const id of ids) {
    await sendMessage(id, messaggio, token);
  }
}

async function sendMessage(id, messaggio, token) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: id,
      text: messaggio,
      parse_mode: "Markdown",
    });
  } catch (err) {
    console.error(
      `❌ Failed to send message to ${id}:`,
      err.response?.data || err.message
    );
  }
}


const scanglobal_token = process.env.TELEGRAM_BOT_TOKENN;

const subGroupMap = {
  Contactus: {
    chat_id: -3875988887,
    message_thread_id: 3, 
  },
  all: {
    chat_id: -3875988887, 
  },
};

// ✅ Sends message to appropriate group or topic
async function scanglobalAlertDev(message, type = "all") {
  const groupInfo = subGroupMap[type];
  console.log(groupInfo);

  if (!groupInfo) {
    console.warn(`❌ Group type "${type}" not found`);
    return;
  }

  await sclSendMessage(groupInfo, message, scanglobal_token);
}

//main function
async function sclSendMessage({ chat_id, message_thread_id }, message, scanglobal_token) {
  try {
    const url = `https://api.telegram.org/bot${scanglobal_token}/sendMessage`;

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

module.exports = { alertDev,scanglobalAlertDev };
