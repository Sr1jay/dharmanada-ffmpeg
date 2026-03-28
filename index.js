const express = require("express");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const upload = multer({ dest: "/tmp/" });

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Dharma Nada FFmpeg Server" });
});

app.post("/generate-video", upload.fields([
  { name: "audio", maxCount: 1 },
  { name: "image", maxCount: 1 }
]), async (req, res) => {

  if (!req.files || !req.files.audio) {
    return res.status(400).json({ error: "No audio file provided" });
  }

  const jobId = Date.now();
  const audioPath = req.files.audio[0].path;
  const outputPath = path.join("/tmp", `video_${jobId}.mp4`);
  let imagePath;
  let tempImagePath = null;

  try {
    if (req.files.image) {
      imagePath = req.files.image[0].path;
    } else if (process.env.BRAND_IMAGE_URL) {
      tempImagePath = path.join("/tmp", `brand_${jobId}.png`);
      const imageResponse = await axios.get(process.env.BRAND_IMAGE_URL, { responseType: "arraybuffer" });
      fs.writeFileSync(tempImagePath, imageResponse.data);
      imagePath = tempImagePath;
    } else {
      return res.status(400).json({ error: "No image provided and no BRAND_IMAGE_URL set" });
    }

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
          "-vf scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#C8490A"
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
      [audioPath, outputPath, tempImagePath].forEach(f => {
        if (f && fs.existsSync(f)) fs.unlinkSync(f);
      });
      if (imagePath && imagePath !== tempImagePath && fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

  } catch (err) {
    console.error(`[${jobId}] Error:`, err.message);
    [audioPath, outputPath, tempImagePath].forEach(f => {
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    });
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dharma Nada FFmpeg Server running on port ${PORT}`);
});
