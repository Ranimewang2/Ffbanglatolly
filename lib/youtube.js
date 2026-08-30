const { exec } = require("child_process");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Get YouTube video info without downloading
async function getVideoInfo(ytUrl, logs) {
  logs.push(`[YT] Fetching info for: ${ytUrl}`);
  return new Promise((resolve, reject) => {
    const cmd = `yt-dlp --dump-json --no-playlist "${ytUrl}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        logs.push(`[YT] ❌ Info error: ${err.message}`);
        reject(err);
        return;
      }
      try {
        const info = JSON.parse(stdout);
        logs.push(`[YT] ✅ Title: ${info.title}`);
        logs.push(`[YT] Duration: ${info.duration}s | Size: ~${Math.round((info.filesize_approx || 0) / 1024 / 1024)}MB`);
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

// Download video at 360p max within 200MB
async function downloadVideo(ytUrl, videoId, logs) {
  const outputPath = path.join("/tmp", `${videoId}.mp4`);

  // Remove old file if exists
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  logs.push(`[YT] Downloading video at 360p...`);

  return new Promise((resolve, reject) => {
    // Format: best quality under 360p, max 200MB, mp4
    const cmd = `yt-dlp -f "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]" --merge-output-format mp4 --max-filesize 200M -o "${outputPath}" --no-playlist "${ytUrl}"`;

    exec(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
      if (err) {
        logs.push(`[YT] ❌ Download error: ${err.message}`);
        reject(err);
        return;
      }
      if (!fs.existsSync(outputPath)) {
        logs.push(`[YT] ❌ File not found after download`);
        reject(new Error("File not found after download"));
        return;
      }
      const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
      logs.push(`[YT] ✅ Downloaded: ${outputPath} (${sizeMB}MB)`);
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
    logs.push(`[YT] ⚠️ Thumbnail download failed: ${err.message}`);
    return null;
  }
}

module.exports = { getVideoInfo, downloadVideo, downloadThumbnail };
