var commandExistsSync = require('command-exists').sync;
var cp = require('child_process');


function gsutil_cmd (cmd, cb) {
    // check if gsutil is available
    if (commandExistsSync('gsutil')) {
        var gsutil_cmd = 'gsutil ' + cmd;
        console.log(`executing command: \`${gsutil_cmd}\``);
        return cp.exec(gsutil_cmd, (err) => {
            console.log('gsutil finished', err);
            cb();
        });
    } else {
        console.log('gsutil missing from command line, install and initialize it');
    }
}
exports.gsutil_cmd = gsutil_cmd;


function upload_file (src, dest, cb) {
    return gsutil_cmd(`cp "${src}" "${dest}"`, cb);
}
exports.upload_file = upload_file;


function upload_dir (src, dest, cb) {
    return gsutil_cmd(`-m cp -r "${src}" "${dest}"`, cb);
}
exports.upload_dir = upload_dir;
