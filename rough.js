// console.log(new Date().toISOString());

// const { Queue, QueueScheduler, Worker } = require("bullmq");
// const Redis = require("ioredis");

// const client = process.env.REDIS_URL
//   ? new Redis({
//       host: process.env.REDIS_URL,
//       port: process.env.REDIS_PORT,
//       password: process.env.REDIS_PASSWORD,
//       maxRetriesPerRequest: null,
//     })
//   : new Redis({ maxRetriesPerRequest: null });

// const queue = new Queue("my-queue", { connection: client });

// async function job(data) {
//   await queue.add("my-job", data);
// }

// const worker = new Worker(
//   "my-queue",
//   async (job) => {
//     console.log(`Processing job ${job.id}:`, job.data);
//     await processJob(job.data);
//   },
//   { connection: client }
// );

// async function processJob(data) {
//   return new Promise((resolve) => {
//     setTimeout(() => {
//       console.log(`Job processed:`, data);
//       resolve();
//     }, 1000);
//   });
// }

// worker.on("completed", (job) => {
//   console.log(`Job ${job.id} completed successfully!`);
// });

// worker.on("failed", (job, err) => {
//   console.error(`Job ${job.id} failed: ${err.message}`);
// });

// // Example
// job({ task: "sendEmail", email: "example@example.com" })
//   .then(() => console.log("Job added to queue!"))
//   .catch((err) => console.error("Failed to add job:", err));
