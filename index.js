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

    // download images
    for (let i = 0; i < images.length; i++) {
      const response = await axios({
        url: images[i],
        method: "GET",
        responseType: "arraybuffer"
      });
      fs.writeFileSync(`img${i}.jpg`, response.data);
    }

    // create input.txt for ffmpeg (much more stable)
    let inputTxt = "";
    for (let i = 0; i < images.length; i++) {
      inputTxt += `file 'img${i}.jpg'\n`;
      inputTxt += `duration 3\n`;
    }
    inputTxt += `file 'img${images.length - 1}.jpg'\n`; // last image fix
    fs.writeFileSync("input.txt", inputTxt);

    // run ffmpeg
    execSync(
      `ffmpeg -y -f concat -safe 0 -i input.txt -i ${audioPath} -vf scale=1280:720 -pix_fmt yuv420p -shortest output.mp4`,
      { stdio: "inherit" }
    );

    res.sendFile(__dirname + "/output.mp4");

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).send("FFmpeg failed");
  }
});

app.listen(3000, () => console.log("Server running on 3000"));
