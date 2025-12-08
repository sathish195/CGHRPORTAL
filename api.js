const axios = require("axios");

async function decodeQrString(req, res) {
  try {
    const token = req.body.token;
    const str = req.body.qr_string;

    const headers = { Authorization: "Bearer " + token };

    const response = await axios({
      method: "get",
      url: "https://api-uat.netbank.ph/v1/qrph/decode",
      params: { qr_string: str },
      headers: headers,
    });

    // ✅ If successful, send the result
    return res.status(200).send({
      success: response.data,
    });
  } catch (err) {
    console.error("decodeQrString error:", err.response?.data || err.message);
    return res.status(400).send("Please Try Again..!");
  }
}

decodeQrString();
