// const express = require("express");
// const { upload } = require("../middleware/upload.middleware");
// const { uploadMedia } = require("../controlers/upload.controller");
// const { auth } = require("../middleware/auth");

// const express = require('express');
// const router = express.Router();





// router.post("/", auth, upload.single("file"), async (req, res) => {
//     try {
//       const file = req.file;
//       if (!file) {
//         return res.status(400).json({ message: "File required" });
//       }
  
//       const mimeType = mime.lookup(file.originalname);
//       const ext = path.extname(file.originalname);
  
//       let finalPath, thumbnail;
  
//       if (mimeType.startsWith("image")) {
//         finalPath = `uploads/images/${file.filename}.jpg`;
//         await processImage(file.path, finalPath);
//       } else if (mimeType.startsWith("video")) {
//         finalPath = `uploads/videos/${file.filename}.mp4`;
//         thumbnail = `uploads/videos/thumb_${file.filename}.jpg`;
//         await processVideo(file.path, finalPath, thumbnail);
//       } else if (mimeType.startsWith("audio")) {
//         finalPath = `uploads/audio/${file.filename}${ext}`;
//         fs.renameSync(file.path, finalPath);
//       } else {
//         finalPath = `uploads/files/${file.filename}${ext}`;
//         fs.renameSync(file.path, finalPath);
//       }
  
//       fs.unlinkSync(file.path); // remove temp file
  
//       res.json({
//         url: "/" + finalPath,
//         mime: mimeType,
//         size: file.size,
//         thumbnail,
//       });
//     } catch (err) {
//       console.error("upload error:", err);
//       res.status(400).json({ message: "Upload failed" });
//     }
//   });

// module.exports = router;
