# this is for local dev, to pull down remote dev server's db
. ../config.sh

while true; do
    read -p "are you sure you want to remove the local database at $k9_database" yn
    case $yn in
        [Yy]* ) rm $k9_database; scp patrick@$k9_ip_address:/home/patrick/song_barker/server/barker_database.db $k9_database; break;;
        [Nn]* ) exit;;
        * ) echo "Please answer yes or no.";;
    esac
done
