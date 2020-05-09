var { Storage } = require('@google-cloud/storage');
var bucket_name = 'song_barker_sequences';
var storage = new Storage({
    keyFilename: '../credentials/bucket-credentials.json',
});


async function upload (local, remote, cb) {
    // Uploads a local file to the bucket
    return storage.bucket(bucket_name).upload(local, {
        gzip: true,
        destination: storage.bucket(bucket_name).file(remote),
    }, cb);
}
exports.upload = upload;
