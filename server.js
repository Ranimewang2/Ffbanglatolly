const express = require("express");
const path = require("path");
const fs = require("fs");
const config = require("./lib/config");
const { getVideoInfo, downloadVideo, downloadThumbnail } = require("./lib/youtube");
const { uploadVideo, deletePost } = require("./lib/facebook");
const { getPosts, addPost, removePost, getRuns, saveRun } = require("./lib/db");
const { sendMessage, notifyUploaded, notifyDeleted, notifyError } = require("./lib/telegram");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ── Core upload function ──────────────────────────────────
async function processYouTubeUrl(ytUrl) {
  const logs = [];
  const startTime = Date.now();
  logs.push(`[BOT] 🚀 Processing: ${ytUrl}`);
  logs.push(`[BOT] Time: ${new Date().toISOString()}`);

  let videoPath = null;
  let thumbPath = null;

  try {
    // Step 1: Get video info
    const info = await getVideoInfo(ytUrl, logs);

    // Step 2: Download video
    videoPath = await downloadVideo(ytUrl, info.videoId, logs);

    // Step 3: Download thumbnail
    thumbPath = await downloadThumbnail(info.thumbnail, info.videoId, logs);

    // Step 4: Upload to Facebook
    const fbPostId = await uploadVideo({
      videoPath,
      title: info.title,
      description: info.description,
      thumbnailPath: thumbPath,
    }, logs);

    if (!fbPostId) {
      logs.push(`[BOT] ❌ Upload failed`);
      await notifyError({ ytUrl, error: "Facebook upload returned no post ID" });
      await saveRun({ timestamp: new Date().toISOString(), type: "upload", status: "failed", ytUrl, logs });
      return { success: false, logs };
    }

    // Step 5: Save to DB with delete time
    const deleteAt = Date.now() + config.DELETE_AFTER_MS;
    const post = {
      fbPostId,
      title: info.title,
      ytUrl,
      uploadedAt: new Date().toISOString(),
      deleteAt: new Date(deleteAt).toISOString(),
    };
    await addPost(post);

    // Step 6: Notify Telegram
    await notifyUploaded({ title: info.title, fbPostId, ytUrl, deleteAt });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logs.push(`[BOT] ✅ Done in ${duration}s`);

    await saveRun({ timestamp: new Date().toISOString(), type: "upload", status: "success", ytUrl, title: info.title, fbPostId, duration: `${duration}s`, logs });
    return { success: true, fbPostId, title: info.title, logs };

  } catch (err) {
    logs.push(`[BOT] ❌ Fatal error: ${err.message}`);
    await notifyError({ ytUrl, error: err.message });
    await saveRun({ timestamp: new Date().toISOString(), type: "upload", status: "failed", ytUrl, logs });
    return { success: false, error: err.message, logs };
  } finally {
    // Cleanup temp files
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (thumbPath && fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    logs.push(`[BOT] 🧹 Temp files cleaned`);
  }
}

// ── Auto-delete function ──────────────────────────────────
async function processDeletes() {
  const logs = [];
  logs.push(`[DELETE] Checking posts to delete...`);
  const posts = await getPosts();
  const now = Date.now();
  let deleted = 0;

  for (const post of posts) {
    const deleteAt = new Date(post.deleteAt).getTime();
    if (now >= deleteAt) {
      logs.push(`[DELETE] Deleting: ${post.title}`);
      const success = await deletePost(post.fbPostId, logs);
      if (success) {
        await removePost(post.fbPostId);
        await notifyDeleted({ title: post.title, fbPostId: post.fbPostId });
        deleted++;
      }
    } else {
      const remaining = Math.round((deleteAt - now) / 1000 / 60);
      logs.push(`[DELETE] Keeping: ${post.title} (${remaining} mins left)`);
    }
  }

  logs.push(`[DELETE] ✅ Done. Deleted: ${deleted}/${posts.length}`);
  await saveRun({ timestamp: new Date().toISOString(), type: "delete", deleted, total: posts.length, logs });
  return { deleted, total: posts.length, logs };
}

// ── API: Upload via URL ───────────────────────────────────
app.post("/api/upload", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { url } = req.body;
  if (!url || !url.includes("youtube.com") && !url.includes("youtu.be")) {
    return res.status(400).json({ success: false, error: "Invalid YouTube URL" });
  }
  // Respond immediately
  res.status(200).json({ success: true, message: "Processing started", url });
  // Process in background
  setImmediate(() => processYouTubeUrl(url).catch(console.error));
});

// ── API: Auto-delete endpoint (for cron-job.org) ──────────
app.get("/api/delete", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ success: true, message: "Delete check started" });
  setImmediate(() => processDeletes().catch(console.error));
});

// ── API: Logs ─────────────────────────────────────────────
app.get("/api/logs", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const runs = await getRuns();
  res.json({ success: true, runs });
});

// ── API: Posts list ───────────────────────────────────────
app.get("/api/posts", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const posts = await getPosts();
  res.json({ success: true, posts });
});

// ── Telegram webhook ──────────────────────────────────────
app.post(`/webhook/${config.TG_BOT_TOKEN}`, async (req, res) => {
  res.sendStatus(200);
  const msg = req.body?.message;
  if (!msg?.text) return;

  const text = msg.text.trim();
  const chatId = msg.chat.id.toString();

  // Only accept from your chat ID
  if (chatId !== config.TG_CHAT_ID) {
    await sendMessage("⛔ Unauthorized");
    return;
  }

  if (text.includes("youtube.com") || text.includes("youtu.be")) {
    await sendMessage(`📥 Received!\n⏳ Downloading and uploading...\nThis may take a few minutes.`);
    processYouTubeUrl(text).catch(console.error);
  } else if (text === "/start") {
    await sendMessage(`👋 <b>FB Video Bot Ready!</b>\n\nSend me a YouTube URL and I'll upload it to Facebook automatically.\n\n🗑️ Videos are auto-deleted after 1 day.`);
  } else if (text === "/posts") {
    const posts = await getPosts();
    if (!posts.length) {
      await sendMessage("No active posts.");
    } else {
      let msg = `📋 <b>Active Posts (${posts.length}):</b>\n\n`;
      posts.forEach((p, i) => {
        const del = new Date(p.deleteAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" });
        msg += `${i+1}. ${p.title}\n🗑️ Deletes: ${del}\n\n`;
      });
      await sendMessage(msg);
    }
  } else {
    await sendMessage(`❓ Send a YouTube URL to upload.\n\nCommands:\n/start - Help\n/posts - Active posts`);
  }
});

// ── Keepalive ─────────────────────────────────────────────
app.get("/ping", (req, res) => {
  res.json({ status: "alive", time: new Date().toISOString() });
});

// ── Dashboard ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Setup Telegram webhook ────────────────────────────────
async function setupWebhook() {
  const axios = require("axios");
  const webhookUrl = `https://fbbotrender.onrender.com/webhook/${config.TG_BOT_TOKEN}`;
  try {
    await axios.post(`https://api.telegram.org/bot${config.TG_BOT_TOKEN}/setWebhook`, {
      url: webhookUrl,
    });
    console.log(`[SERVER] Telegram webhook set: ${webhookUrl}`);
  } catch (err) {
    console.error("[SERVER] Webhook setup failed:", err.message);
  }
}

app.listen(PORT, () => {
  console.log(`[SERVER] FB Bot running on port ${PORT}`);
  setupWebhook();
});
