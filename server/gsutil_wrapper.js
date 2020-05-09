var commandExistsSync = require('command-exists').sync;
var cp = require('child_process');


function gsutil_cmd (cmd, cb) {
    // check if gsutil is available
    if (commandExistsSync('gsutil')) {
        console.log('uploading to bucket');
        return cp.exec('gsutil ' + cmd, (err) => {
            console.log('gsutil finished', err);
        });
    } else {
        console.log('gsutil missing from command line, install and initialize it');
    }
}
exports.gsutil_cmd = gsutil_cmd;


//gsutil_cmd('ls gs://song_barker_sequences', (a,b,c) => console.log(a,b,c));
