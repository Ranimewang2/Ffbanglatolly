#!/bin/bash
# Install Node dependencies
npm install

# Install yt-dlp (YouTube downloader)
pip install yt-dlp --break-system-packages || pip3 install yt-dlp

# Verify yt-dlp installed
yt-dlp --version

echo "Build complete!"
