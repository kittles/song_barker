DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
. $DIR/config.sh
echo "attempting to connect to "$k9_ip_address
ssh patrick@$k9_ip_address
