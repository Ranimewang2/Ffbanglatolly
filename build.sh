#!/bin/bash
# Install Node dependencies
npm install

# Install/Update yt-dlp
pip install -U yt-dlp --break-system-packages || pip3 install -U yt-dlp

# Install deno (JS runtime for yt-dlp)
curl -fsSL https://deno.land/install.sh | sh
export DENO_INSTALL="/root/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"

# Verify installations
yt-dlp --version
deno --version

echo "Build complete!"
