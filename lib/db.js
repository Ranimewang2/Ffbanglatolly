const axios = require("axios");
const config = require("./config");

const HEADERS = {
  "X-Master-Key": config.JSONBIN_API_KEY,
  "Content-Type": "application/json",
};

// ─── POSTS ────────────────────────────────────────────────

async function getPosts() {
  try {
    const res = await axios.get(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_POSTS_BIN_ID}/latest`,
      { headers: HEADERS }
    );
    return res.data.record.posts || [];
  } catch (err) {
    console.error("[DB] Error fetching posts:", err.message);
    return [];
  }
}

async function savePosts(posts) {
  try {
    await axios.put(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_POSTS_BIN_ID}`,
      { posts },
      { headers: HEADERS }
    );
  } catch (err) {
    console.error("[DB] Error saving posts:", err.message);
  }
}

async function addPost(post) {
  const posts = await getPosts();
  posts.push(post);
  await savePosts(posts);
}

async function removePost(fbPostId) {
  const posts = await getPosts();
  const filtered = posts.filter(p => p.fbPostId !== fbPostId);
  await savePosts(filtered);
}

// ─── LOGS ─────────────────────────────────────────────────

async function getRuns() {
  try {
    const res = await axios.get(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_LOGS_BIN_ID}/latest`,
      { headers: HEADERS }
    );
    return res.data.record.runs || [];
  } catch (err) {
    console.error("[DB] Error fetching runs:", err.message);
    return [];
  }
}

async function saveRun(runData) {
  try {
    const runs = await getRuns();
    runs.unshift(runData);
    const trimmed = runs.slice(0, 20);
    await axios.put(
      `https://api.jsonbin.io/v3/b/${config.JSONBIN_LOGS_BIN_ID}`,
      { runs: trimmed },
      { headers: HEADERS }
    );
  } catch (err) {
    console.error("[DB] Error saving run:", err.message);
  }
}

module.exports = { getPosts, savePosts, addPost, removePost, getRuns, saveRun };
