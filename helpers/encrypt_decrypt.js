const CryptoJS = require("crypto-js");

const password = process.env.CRYPTO_PASS;
const salt = process.env.CRYPTO_SALT;
const key = CryptoJS.PBKDF2(password, salt, {
  keySize: 256 / 32,
  iterations: 100,
});

function encrypt(str) {
  try {
    return CryptoJS.AES.encrypt(str, key.toString()).toString();
  } catch (error) {
    return "tberror";
  }
}

function decrypt(str) {
  try {
    const dattt = CryptoJS.AES.decrypt(str, key.toString());
    return dattt.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    return "tberror";
  }
}

function encryptobj(obj) {
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(obj), key.toString()).toString();
  } catch (error) {
    return "tberror";
  }
}

function decryptobj(str) {
  try {
    const objt = CryptoJS.AES.decrypt(str, key.toString());
    return JSON.parse(objt.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    return "tberror";
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptobj,
  decryptobj,
};