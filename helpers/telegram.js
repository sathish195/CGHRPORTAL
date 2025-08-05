const axios = require("axios");
// require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const ids = [-4822896123];

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

module.exports = { alertDev };
