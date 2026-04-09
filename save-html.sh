#!/bin/bash
# Auto-save index.html with timestamp and copy to clipboard

FILE=~/creator-support/public/index.html
BACKUP_DIR=~/creator-support/backups

# timestamp
TS=$(date +"%Y%m%d-%H%M%S")

# copy file to backup folder
cp "$FILE" "$BACKUP_DIR/index-$TS.html"

# copy file to clipboard
termux-clipboard-set < "$FILE"

echo "Saved index.html as index-$TS.html and copied to clipboard!"
