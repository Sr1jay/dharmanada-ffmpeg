const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const { execSync } = require("child_process");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/render", upload.single("audio"), async (req, res) => {
  try {
    console.log("---- REQUEST START ----");

    if (!req.file) {
      console.log("No audio file received");
      return res.status(400).send("No audio file");
    }

   let images = req.body.images;

if (typeof images === "string") {
  images = images.split(",").map(s => s.trim());
}
    const audioPath = req.file.path;

    console.log("Images count:", images.length);
    console.log("Audio path:", audioPath);

    // STEP 1: download images
    for (let i = 0; i < images.length; i++) {
      console.log(`Downloading image ${i}`);
      const response = await axios({
        url: images[i],
        method: "GET",
        responseType: "arraybuffer",
        timeout: 10000
      });
      fs.writeFileSync(`img${i}.jpg`, response.data);
    }

    console.log("Images downloaded");

    // STEP 2: convert audio
    console.log("Converting audio...");
    execSync(`ffmpeg -y -i ${audioPath} audio.mp3`, { stdio: "inherit" });
    console.log("Audio converted");

    // STEP 3: build video (safe version)
    console.log("Building video...");

    let inputs = "";
    for (let i = 0; i < images.length; i++) {
      inputs += `-loop 1 -t 3 -i img${i}.jpg `;
    }

    const cmd = `ffmpeg -y ${inputs} -i audio.mp3 -vf "scale=1280:720,format=yuv420p" -shortest output.mp4`;

    console.log("Running FFmpeg:", cmd);

    execSync(cmd, { stdio: "inherit", timeout: 30000 });

    console.log("Video created");

    // STEP 4: send response
    res.sendFile(__dirname + "/output.mp4");

    console.log("---- REQUEST END ----");

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).send("Server failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
