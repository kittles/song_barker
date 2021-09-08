# this does not look like it does what its title implies
for i in *.avi; do ffmpeg -i "$i" "${i%.*}.mp4"; done
