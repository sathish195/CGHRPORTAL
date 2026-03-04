// const sharp = require("sharp");
// const ffmpeg = require("fluent-ffmpeg");
// const ffmpegPath = require("ffmpeg-static");
// const path = require("path");
// const fs = require("fs");

// ffmpeg.setFfmpegPath(ffmpegPath);

// exports.processImage = async (inputPath, outputPath) => {
//   await sharp(inputPath)
//     .resize(1280)
//     .jpeg({ quality: 75 })
//     .toFile(outputPath);
// };

// exports.processVideo = async (inputPath, outputPath, thumbPath) => {
//   return new Promise((resolve, reject) => {
//     ffmpeg(inputPath)
//       .outputOptions(["-preset veryfast", "-crf 28"])
//       .save(outputPath)
//       .on("end", () => {
//         ffmpeg(inputPath)
//           .screenshots({
//             count: 1,
//             folder: path.dirname(thumbPath),
//             filename: path.basename(thumbPath),
//           })
//           .on("end", resolve)
//           .on("error", reject);
//       })
//       .on("error", reject);
//   });
// };
