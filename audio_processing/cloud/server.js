'use strict';

const express = require('express');
var exec = require('child_process').exec;
// TODO doesnt belong in the repo!
const access_token = require('./access_token.json').token;

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

// App
const app = express();
app.use(express.json({
    type: 'application/json',
}));


app.get('/am-i-alive-i-hope-so', (req, res) => {
    res.send('*gasping for air*');
});


app.post('/to_crops', async (req, res) => {
    // validate the access_token here!
    if (req.body.access_token != access_token) {
        res.status(401).send('access denied!');
    }
    // TODO need a safer way to interpolate strings
    var cmd = `python3 cloud_crop.py --uuid "${req.body.uuid}" --bucket "${req.body.bucket}"`;
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
});


app.post('/to_sequence', async (req, res) => {
    // validate the access_token here!
    if (req.body.access_token != access_token) {
        res.status(401).send('access denied!');
    }
    // TODO need a safer way to interpolate strings
    var cmd = `python3 cloud_sequence.py `;
    cmd += `--song '${JSON.stringify(req.body.song)}' `;
    cmd += `--crops '${JSON.stringify(req.body.crops)}' `;
    cmd += `--bucket '${req.body.bucket}'`;
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
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
