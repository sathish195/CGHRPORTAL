// const CryptoJS = require("crypto-js");

// const password = process.env.CRYPTO_PASS;
// const salt = process.env.CRYPTO_SALT;
// const key = CryptoJS.PBKDF2(password, salt, {
//   keySize: 256 / 32,
//   iterations: 100,
// });

// function encrypt(str) {
//   try {
//     return CryptoJS.AES.encrypt(str, key.toString()).toString();
//   } catch (error) {
//     return "tberror";
//   }
// }

// function decrypt(str) {
//   try {
//     const dattt = CryptoJS.AES.decrypt(str, key.toString());
//     return dattt.toString(CryptoJS.enc.Utf8);
//   } catch (error) {
//     return "tberror";
//   }
// }

// function encryptobj(obj) {
//   try {
//     return CryptoJS.AES.encrypt(JSON.stringify(obj), key.toString()).toString();
//   } catch (error) {
//     return "tberror";
//   }
// }

// function decryptobj(str) {
//   try {
//     const objt = CryptoJS.AES.decrypt(str, key.toString());
//     return JSON.parse(objt.toString(CryptoJS.enc.Utf8));
//   } catch (error) {
//     return "tberror";
//   }
// }

// module.exports = {
//   encrypt,
//   decrypt,
//   encryptobj,
//   decryptobj,
// };




// --------------------------new encryption---------------------------


require("dotenv").config();
const { webcrypto } = require("crypto");

global.crypto = webcrypto;

// ================= CONFIG =================
const PASSWORD = "Sectrect_pass!234__HRPORTAL@1234";

const ITERATIONS = 150000;

const MAX_AGE_MS = 10 * 60 * 1000;

const usedNonces = new Set();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

const fromBase64 = (base64) =>
  Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}
async function encrypt(userData) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await deriveKey(PASSWORD, salt);

  // 🔒 Internal security metadata
  const payload = {
    data: userData, // actual business data
    ts: Date.now(), // timestamp
    nonce: crypto.randomUUID(), // one-time token
  };

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(payload))
  );

  return Buffer.from(
    JSON.stringify({
      v: 1,
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    })
  ).toString("base64");
}
async function decrypt(cipherText,{ checkExpiry = true, allowReplay = false } = {}) {

  try {
    console.log(cipherText);
    if (!cipherText) return null;
    if (typeof cipherText === "object") return cipherText;

    const payload = JSON.parse(decoder.decode(fromBase64(cipherText)));
    const key = await deriveKey(PASSWORD, new Uint8Array(payload.salt));

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
      key,
      new Uint8Array(payload.data)
    );

    
    console.log(decrypted, "decrypted");

    const decoded = JSON.parse(decoder.decode(decrypted));
    console.log(decoded, "decoded");
    // ⏳ Expiry ONLY for API payloads
    if (checkExpiry) {
      if (!decoded.ts || Date.now() - decoded.ts > MAX_AGE_MS) {
        throw new Error("Expired payload");
      }
    }

    // 🔁 Replay ONLY for API payloads
    if (!allowReplay) {
      if (usedNonces.has(decoded.nonce)) {
        throw new Error("Replay detected");
      }
      usedNonces.add(decoded.nonce);
    }

    return decoded.data;
  } catch (err) {
    console.error("Decrypt failed:", err);
    return null;
  }}
async function jwt_decrypt(cipherText) {
    const payload = JSON.parse(Buffer.from(cipherText, "base64").toString());
  
    const key = await deriveKey(PASSWORD, new Uint8Array(payload.salt));
  
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
      key,
      new Uint8Array(payload.data)
    );
  
    const decoded = JSON.parse(new TextDecoder().decode(decrypted));
    // if (!decoded.ts || Date.now() - decoded.ts > MAX_AGE_MS) {
    //   throw new Error("Request expired (replay blocked)");
    // }
  
    // if (usedNonces.has(decoded.nonce)) {
    //   throw new Error("Replay attack detected");
    // }
  
    // usedNonces.add(decoded.nonce);
    return decoded.data;
  }
    async function generateRandomString(length = 7) {
      const randomBytes = crypto.getRandomValues(new Uint8Array(length / 2)); // Generates random bytes
      let randomString = '';
  
      // Convert random bytes to hex string (each byte is two hex characters)
      for (let i = 0; i < randomBytes.length; i++) {
          randomString += randomBytes[i].toString(16).padStart(2, '0').toUpperCase();
      }
  
      return randomString;
  }
  

module.exports = {
  encrypt,
  decrypt,
  jwt_decrypt,
  generateRandomString
};