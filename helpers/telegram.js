const axios = require("axios");
// require('dotenv').config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const id = 1331794477;
//  1331794477;

function alertDev(messaggio) {
  console.log("Token:", token);
  console.log("ID:", id);

  sendMessage(id, messaggio, token);
  console.log("success");
}

async function sendMessage(id, messaggio, token) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${id}&text=${encodeURIComponent(
      messaggio
    )}`;
    console.log(url);
    let response = await axios.get(url);
    console.log("Message sent successfully:", response.data);
  } catch (err) {
    console.error("Failed to send message:", err);
  }
}

module.exports = { alertDev };
