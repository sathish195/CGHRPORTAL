const mediasoup = require("mediasoup");

let worker;

exports.createWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  worker.on("died", () => {
    console.error("mediasoup worker died");
    process.exit(1);
  });

  return worker;
};

exports.getWorker = () => worker;
