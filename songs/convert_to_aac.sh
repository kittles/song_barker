for i in *.avi; do ffmpeg -i "$i" "${i%.*}.mp4"; done
