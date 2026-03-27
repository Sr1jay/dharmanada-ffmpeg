const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const { execSync } = require("child_process");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/render", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No audio file");

    const images = req.body.images.split(",").map(s => s.trim());
    const audioPath = req.file.path;

    console.log("Images:", images);
    console.log("Audio path:", audioPath);

    // STEP 1: download images
    for (let i = 0; i < images.length; i++) {
      const response = await axios({
        url: images[i],
        method: "GET",
        responseType: "arraybuffer"
      });
      fs.writeFileSync(`img${i}.jpg`, response.data);
    }

    // STEP 2: convert Telegram audio (.oga) → mp3
    execSync(`ffmpeg -y -i ${audioPath} audio.mp3`, { stdio: "inherit" });

    // STEP 3: build video from images
    let inputs = "";
    let filter = "";

    for (let i = 0; i < images.length; i++) {
      inputs += `-loop 1 -t 3 -i img${i}.jpg `;
      filter += `[${i}:v]`;
    }

    filter += `concat=n=${images.length}:v=1:a=0[v]`;

    const cmd = `ffmpeg -y ${inputs} -i audio.mp3 -filter_complex "${filter}" -map "[v]" -map ${images.length}:a -shortest output.mp4`;

    console.log("Running FFmpeg:", cmd);

    execSync(cmd, { stdio: "inherit" });

    // STEP 4: return video
    res.sendFile(__dirname + "/output.mp4");

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).send("FFmpeg failed");
  }
});

app.listen(3000, () => console.log("Server running on 3000"));
