const { exec } = require("child_process");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Write cookies file on startup if content provided
const COOKIES_PATH = "/tmp/yt_cookies.txt";

function ensureCookies() {
  const cookies = `# Netscape HTTP Cookie File
# These are YouTube cookies for Bangladesh region bypass
.youtube.com	TRUE	/	TRUE	2147483647	CONSENT	YES+BD.en+20240101-00-0
.youtube.com	TRUE	/	TRUE	2147483647	PREF	f4=4000000&hl=en&gl=BD
.youtube.com	TRUE	/	TRUE	2147483647	GPS	1
.google.com	TRUE	/	TRUE	2147483647	CONSENT	YES+BD.en+20240101-00-0
`;
  if (!fs.existsSync(COOKIES_PATH)) {
    fs.writeFileSync(COOKIES_PATH, cookies);
  }
}

function ytdlp(args) {
  ensureCookies();
  const nodePath = process.execPath;
  return `yt-dlp --js-runtimes node:${nodePath} --cookies "${COOKIES_PATH}" --geo-bypass --geo-bypass-country BD ${args}`;
}

async function getVideoInfo(ytUrl, logs) {
  logs.push(`[YT] Fetching info: ${ytUrl}`);
  return new Promise((resolve, reject) => {
    const cmd = ytdlp(`--dump-json --no-playlist "${ytUrl}"`);
    exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        logs.push(`[YT] ❌ Info error: ${err.message.slice(0, 300)}`);
        reject(err);
        return;
      }
      try {
        const lines = stdout.trim().split("\n");
        let info = null;
        for (const line of lines.reverse()) {
          try { info = JSON.parse(line); break; } catch(e) {}
        }
        if (!info) throw new Error("No valid JSON in output");
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

async function downloadVideo(ytUrl, videoId, logs) {
  const outputPath = path.join("/tmp", `${videoId}.mp4`);
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  logs.push(`[YT] Downloading at 360p...`);

  return new Promise((resolve, reject) => {
    const cmd = ytdlp(`-f "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]" --merge-output-format mp4 --max-filesize 200M -o "${outputPath}" --no-playlist "${ytUrl}"`);
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
