const express = require("express");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const upload = multer({ dest: "/tmp/" });

const BRAND_IMAGE_URL = process.env.BRAND_IMAGE_URL;

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Dharma Nada FFmpeg Server" });
});

app.post("/generate-video", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  const jobId = Date.now();
  const audioPath = req.file.path;
  const imagePath = path.join("/tmp", `brand_${jobId}.png`);
  const outputPath = path.join("/tmp", `video_${jobId}.mp4`);

  try {
    console.log(`[${jobId}] Downloading brand image...`);
    const imageResponse = await axios.get(BRAND_IMAGE_URL, { responseType: "arraybuffer" });
    fs.writeFileSync(imagePath, imageResponse.data);

    console.log(`[${jobId}] Generating video with FFmpeg...`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(["-loop 1"])
        .input(audioPath)
        .outputOptions([
          "-c:v libx264",
          "-c:a aac",
          "-b:a 128k",
          "-pix_fmt yuv420p",
          "-shortest",
          "-movflags +faststart",
          "-preset ultrafast",
          "-crf 28",
          "-vf scale=720:1280"
        ])
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    console.log(`[${jobId}] Sending video...`);
    const filename = req.body.filename || `dharmanada_${jobId}.mp4`;
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const stream = fs.createReadStream(outputPath);
    stream.pipe(res);
    stream.on("end", () => {
      [audioPath, imagePath, outputPath].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    });

  } catch (err) {
    console.error(`[${jobId}] Error:`, err.message);
    [audioPath, imagePath, outputPath].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dharma Nada FFmpeg Server running on port ${PORT}`);
});
