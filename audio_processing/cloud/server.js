'use strict';

const express = require('express');
var exec = require('child_process').exec;
const access_token = require('./access_token.json').token;

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

// App
const app = express();
app.use(express.json({
    type: 'application/json',
}));


app.get('/', (req, res) => {
    res.send('Hello World');
});

app.post('/to_crops', async (req, res) => {
    // validate the access_token here!
    if (req.body.access_token != access_token) {
        res.status(401).send('access denied!');
    }
    // TODO need a safer way to interpolate strings
    var cmd = `python3 cloud_crop.py --uuid "${req.body.uuid}"`;
    var config = {
        shell: '/bin/bash',
    }

    exec(cmd, config, handler);


    function handler (error, stdout, stderr) {
        // this should receive a json string from the
        // python script via stdout
        if (error) {
            console.error(`exec error: ${error}`);
            res.json({
                'error': error,
            })
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        res.json({
            data: JSON.parse(stdout),
            stderr: stderr,
        });
    }

    //exec(`
    //    sox -i
    //`, {
    //    shell: '/bin/bash',
    //}, async (error, stdout, stderr) => {
    //    if (error) {
    //        console.error(`exec error: ${error}`);
    //        res.json({
    //            error: 'there was an error creating the crops',
    //            message: error,
    //        });
    //    } else {
    //        res.json({
    //            output: stdout,
    //        });
    //    }
    //});
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
