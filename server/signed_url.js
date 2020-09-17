const { Storage } = require('@google-cloud/storage');
const bucketName = 'song_barker_sequences';
const content_type = 'audio/mpeg';
// from https://cloud.google.com/storage/docs/access-control/signing-urls-with-helpers#storage-signed-url-object-nodejs

const storage = new Storage({
    keyFilename: '../credentials/bucket-credentials.json',
});


async function to_signed_upload_url (filename, content_type) {
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: content_type,
    };

    // Get a v4 signed URL for uploading file
    const [url] = await storage
        .bucket(bucketName)
        .file(filename)
        .getSignedUrl(options);

    /*
    console.log('Generated PUT signed URL:');
    console.log(url);
    console.log('You can use this URL with any user agent, for example:');
    console.log(
    `curl -X PUT -H 'Content-Type: ${content_type}' ` +
    `--upload-file ${filename} '${url}'`
    );
    */
    return (url);
}
exports.to_signed_upload_url = to_signed_upload_url;


async function to_signed_playback_url (filename) {
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: content_type,
    };

    // Get a v4 signed URL for uploading file
    const [url] = await storage
        .bucket(bucketName)
        .file(filename)
        .getSignedUrl(options);
    return (url);
}
exports.to_signed_playback_url = to_signed_playback_url;
