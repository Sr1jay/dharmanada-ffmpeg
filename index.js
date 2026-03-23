const express = require("express");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const app = express();
app.use(express.json());

const TMP = "/tmp";
const BRAND_IMAGE_URL = process.env.BRAND_IMAGE_URL;

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Dharma Nada FFmpeg Server" });
});

app.post("/generate-video", async (req, res) => {
  const { audio_url, audio_base64, filename } = req.body;

  if (!audio_url && !audio_base64) {
    return res.status(400).json({ error: "Provide either audio_url or audio_base64" });
  }

  const jobId = Date.now();
  const audioPath = path.join(TMP, `audio_${jobId}.mp3`);
  const imagePath = path.join(TMP, `brand_${jobId}.png`);
  const outputPath = path.join(TMP, `video_${jobId}.mp4`);

  try {
    console.log(`[${jobId}] Downloading brand image...`);
    const imageResponse = await axios.get(BRAND_IMAGE_URL, { responseType: "arraybuffer" });
    fs.writeFileSync(imagePath, imageResponse.data);

    console.log(`[${jobId}] Saving audio...`);
    if (audio_base64) {
      const audioBuffer = Buffer.from(audio_base64, "base64");
      fs.writeFileSync(audioPath, audioBuffer);
    } else {
      const audioResponse = await axios.get(audio_url, { responseType: "arraybuffer" });
      fs.writeFileSync(audioPath, audioResponse.data);
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
          "-b:a 192k",
          "-pix_fmt yuv420p",
          "-shortest",
          "-movflags +faststart",
          "-vf scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#C8490A"
        ])
        .output(outputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    console.log(`[${jobId}] Video ready, sending response...`);
    const videoBuffer = fs.readFileSync(outputPath);
    const videoBase64 = videoBuffer.toString("base64");

    res.json({
      success: true,
      video_base64: videoBase64,
      filename: filename || `dharmanada_${jobId}.mp4`,
      size_bytes: videoBuffer.length
    });

  } catch (err) {
    console.error(`[${jobId}] Error:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    [audioPath, imagePath, outputPath].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dharma Nada FFmpeg Server running on port ${PORT}`);
});
