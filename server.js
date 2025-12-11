import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "500mb" }));

ffmpeg.setFfmpegPath(ffmpegPath);

app.post("/convert", async (req, res) => {
  try {
    const { playlist, segments } = req.body;

    if (!playlist || !segments) {
      return res.json({ success: false, message: "Missing playlist or segments" });
    }

    const workDir = "./tmp_" + Date.now();
    fs.mkdirSync(workDir);

    const playlistPath = path.join(workDir, "index.m3u8");
    fs.writeFileSync(playlistPath, playlist);

    for (const s of segments) {
      const filePath = path.join(workDir, s.name);
      const buffer = Buffer.from(s.contentBase64, "base64");
      fs.writeFileSync(filePath, buffer);
    }

    const outMp4 = path.join(workDir, "output.mp4");

    ffmpeg(playlistPath)
      .outputOptions(["-c copy"]) // Fast transmux
      .save(outMp4)
      .on("end", () => {
        const mp4Data = fs.readFileSync(outMp4, { encoding: "base64" });

        fs.rmSync(workDir, { recursive: true, force: true });

        res.json({ success: true, mp4Base64: mp4Data });
      })
      .on("error", (err) => {
        console.log(err);
        res.json({ success: false, message: err.message });
      });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.get("/", (_, res) => res.send("FFmpeg API Running ✔"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));
