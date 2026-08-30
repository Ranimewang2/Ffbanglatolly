const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const config = require("./config");

const FB_API = "https://graph.facebook.com/v19.0";

// Upload video to Facebook Page
async function uploadVideo({ videoPath, title, description, thumbnailPath }, logs) {
  logs.push(`[FB] Uploading video to page...`);

  try {
    const form = new FormData();
    form.append("access_token", config.FB_ACCESS_TOKEN);
    form.append("title", title);
    form.append("description", description || "");
    form.append("source", fs.createReadStream(videoPath));

    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      form.append("thumb", fs.createReadStream(thumbnailPath));
      logs.push(`[FB] Thumbnail attached`);
    }

    const res = await axios.post(
      `${FB_API}/${config.FB_PAGE_ID}/videos`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 300000, // 5 mins for large uploads
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const postId = res.data?.id || res.data?.post_id || "";
    if (postId) {
      logs.push(`[FB] ✅ Uploaded! Post ID: ${postId}`);
      return postId;
    } else {
      logs.push(`[FB] ❌ No post ID returned: ${JSON.stringify(res.data)}`);
      return null;
    }
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    logs.push(`[FB] ❌ Upload error: ${errMsg}`);
    return null;
  }
}

// Delete a post from Facebook Page
async function deletePost(fbPostId, logs) {
  logs.push(`[FB] Deleting post: ${fbPostId}`);
  try {
    const res = await axios.delete(
      `${FB_API}/${fbPostId}`,
      {
        params: { access_token: config.FB_ACCESS_TOKEN },
        timeout: 15000,
      }
    );
    if (res.data?.success) {
      logs.push(`[FB] ✅ Post deleted: ${fbPostId}`);
      return true;
    } else {
      logs.push(`[FB] ❌ Delete failed: ${JSON.stringify(res.data)}`);
      return false;
    }
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    logs.push(`[FB] ❌ Delete error: ${errMsg}`);
    return false;
  }
}

module.exports = { uploadVideo, deletePost };
