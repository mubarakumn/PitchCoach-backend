module.exports = {
  apps: [
    {
      name: "api",
      script: "./server.js",
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: "transcription-worker",
      script: "./workers/transcriptionWorker.js",
      instances: 1,
      autorestart: true,
    },
    {
      name: "feedback-worker",
      script: "./workers/feedbackWorker.js",
      instances: 1,
      autorestart: true,
    },
  ],
};
