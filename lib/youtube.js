const { exec } = require("child_process");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Build yt-dlp base command with deno runtime
function ytdlp(args) {
  const deno = "/root/.deno/bin/deno";
  const denoFlag = fs.existsSync(deno) ? `--js-runtimes deno:${deno}` : "";
  return `yt-dlp ${denoFlag} ${args}`;
}

// Get YouTube video info
async function getVideoInfo(ytUrl, logs) {
  logs.push(`[YT] Fetching info for: ${ytUrl}`);
  return new Promise((resolve, reject) => {
    const cmd = ytdlp(`--dump-json --no-playlist --geo-bypass "${ytUrl}"`);
    exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        logs.push(`[YT] ❌ Info error: ${err.message.slice(0, 300)}`);
        reject(err);
        return;
      }
      try {
        const info = JSON.parse(stdout);
        logs.push(`[YT] ✅ Title: ${info.title}`);
        logs.push(`[YT] Duration: ${info.duration}s`);
        resolve({
          title: info.title,
          description: info.description || "",
          thumbnail: info.thumbnail,
          duration: info.duration,
          videoId: info.id,
        });
      } catch (e) {
        logs.push(`[YT] ❌ Parse error: ${e.message}`);
        reject(e);
      }
    });
  });
}

// Download video at 360p max
async function downloadVideo(ytUrl, videoId, logs) {
  const outputPath = path.join("/tmp", `${videoId}.mp4`);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  logs.push(`[YT] Downloading video at 360p...`);

  return new Promise((resolve, reject) => {
    const cmd = ytdlp(`-f "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]" --merge-output-format mp4 --max-filesize 200M --geo-bypass -o "${outputPath}" --no-playlist "${ytUrl}"`);
    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        logs.push(`[YT] ❌ Download error: ${err.message.slice(0, 300)}`);
        reject(err);
        return;
      }
      if (!fs.existsSync(outputPath)) {
        reject(new Error("File not found after download"));
        return;
      }
      const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
      logs.push(`[YT] ✅ Downloaded: ${sizeMB}MB`);
      resolve(outputPath);
    });
  });
}

// Download thumbnail
async function downloadThumbnail(thumbnailUrl, videoId, logs) {
  logs.push(`[YT] Downloading thumbnail...`);
  const thumbPath = path.join("/tmp", `${videoId}_thumb.jpg`);
  try {
    const res = await axios.get(thumbnailUrl, { responseType: "arraybuffer", timeout: 15000 });
    fs.writeFileSync(thumbPath, res.data);
    logs.push(`[YT] ✅ Thumbnail saved`);
    return thumbPath;
  } catch (err) {
    logs.push(`[YT] ⚠️ Thumbnail failed: ${err.message}`);
    return null;
  }
}

module.exports = { getVideoInfo, downloadVideo, downloadThumbnail };
