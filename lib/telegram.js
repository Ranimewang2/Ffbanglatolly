const axios = require("axios");
const config = require("./config");

const TG_URL = `https://api.telegram.org/bot${config.TG_BOT_TOKEN}`;

async function sendMessage(text) {
  try {
    await axios.post(`${TG_URL}/sendMessage`, {
      chat_id: config.TG_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error("[TG] Error:", err.response?.data?.description || err.message);
  }
}

async function notifyUploaded({ title, fbPostId, ytUrl, deleteAt }) {
  const deleteTime = new Date(deleteAt).toLocaleString("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
  await sendMessage(
    `✅ <b>Video Uploaded to Facebook!</b>\n\n` +
    `📺 <b>Title:</b> ${title}\n` +
    `🆔 <b>Post ID:</b> ${fbPostId}\n` +
    `🔗 <b>YT Source:</b> ${ytUrl}\n` +
    `🗑️ <b>Auto-delete at:</b> ${deleteTime}`
  );
}

async function notifyDeleted({ title, fbPostId }) {
  await sendMessage(
    `🗑️ <b>Facebook Post Deleted</b>\n\n` +
    `📺 <b>Title:</b> ${title}\n` +
    `🆔 <b>Post ID:</b> ${fbPostId}`
  );
}

async function notifyError({ ytUrl, error }) {
  await sendMessage(
    `❌ <b>Upload Failed!</b>\n\n` +
    `🔗 <b>URL:</b> ${ytUrl}\n` +
    `💥 <b>Error:</b> ${error}`
  );
}

async function notifyTelegramUrl(ytUrl) {
  // Listen for messages from Telegram bot
  // This is called by the webhook handler
  await sendMessage(`📥 <b>Received URL:</b> ${ytUrl}\n⏳ Processing... please wait`);
}

module.exports = { sendMessage, notifyUploaded, notifyDeleted, notifyError, notifyTelegramUrl };
