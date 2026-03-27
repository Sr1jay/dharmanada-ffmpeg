const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const { execSync } = require("child_process");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/render", upload.single("audio"), async (req, res) => {
  try {
    const images = req.body.images.split(",");
    const audioPath = req.file.path;

    // download images
    for (let i = 0; i < images.length; i++) {
      const response = await axios({
        url: images[i],
        method: "GET",
        responseType: "stream"
      });

      const writer = fs.createWriteStream(`img${i}.jpg`);
      response.data.pipe(writer);

      await new Promise((resolve) => writer.on("finish", resolve));
    }

    // build ffmpeg command
    let inputs = "";
    let filters = "";

    for (let i = 0; i < images.length; i++) {
      inputs += `-loop 1 -t 3 -i img${i}.jpg `;
      filters += `[${i}:v]`;
    }

    filters += `concat=n=${images.length}:v=1:a=0[v]`;

    const cmd = `
      ffmpeg ${inputs} -i ${audioPath} \
      -filter_complex "${filters}" \
      -map "[v]" -map ${images.length}:a \
      -shortest output.mp4
    `;

    execSync(cmd);

    res.sendFile(__dirname + "/output.mp4");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating video");
  }
});

app.listen(3000, () => console.log("Server running"));
