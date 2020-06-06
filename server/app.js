var express = require('express');
var fileUpload = require('express-fileupload');
var _ = require('lodash');
var exec = require('child_process').exec;
var morgan = require('morgan');
var path = require('path');
var app = express();
var rest_api = require('./rest_api.js');
var models = require('./models.js').models;
var _db = require('./database.js');
var verify = require('./google_oauth_handler.js');
var session = require('express-session');
var FileStore = require('session-file-store')(session);
var user_sess = require('./user_from_session.js');
var uuid_validate = require('uuid-validate');

//
// server config
//

var port = process.env.PORT || 3000;

app.use(express.json({
    type: 'application/json',
}));
app.set('json spaces', 2);
app.use(morgan('combined')); // logging
app.use(express.static('./public'));
app.use(fileUpload({
    createParentPath: true
}));
app.use(
    session({
        store: new FileStore(),
        secret: 'bireli', // TODO come from env
        resave: true,
        saveUninitialized: true,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 30,
        }
    })
);

//
// routes
//

// index
app.get('/', (req, res) => {
    res.send(`sessionID: ${req.sessionID}, user_id: ${req.session.user_id}`);
});

// openid user creation
app.post('/openid-token/:platform', async (req, res) => {
    try {
        var payload;
        if (req.params.platform === 'android') {
            payload = await verify.android_verify(req.body);
        }
        if (req.params.platform === 'ios') {
            payload = await verify.ios_verify(req.body);
        }
        req.session.openid_profile = payload;
        // see if an account with the payload's email as user_id exists
        var user = await user_sess.get_user(payload.email);
        if (user) {
            console.log('user exists');
            // attach the user_id to the session
            req.session.user_id = payload.email;
        } else {
            // create a new user object
            console.log('create new user');
            await user_sess.add_user(payload.email, payload.name, payload.email);
            // should verify that db insert worked
            req.session.user_id = payload.email;
        }
        return res.json({ success: true, err: null, payload: payload });
    } catch (err) {
        return res.json({ success: false, err: err, payload: null });
    }
});

// for checking if logged in
app.get('/is-logged-in', async (req, res) => {
    var state = {
        logged_in: false,
    };
    if (!_.get(req.session, 'user_id', false)) {
        state.user_id = false;
        res.json(state);
    }
    const db = await _db.dbPromise;
    var is_user = await db.get('select 1 from users where user_id = ?', req.session.user_id);
    if (_.get(is_user, '1', false)) {
        state.logged_in = true;
        state.user_id = req.session.user_id;
    }
    res.json(state);
});

// disassociate user id from session
app.get('/logout', (req, res) => {
    delete req.session.user_id;
    res.json({ success: true });
});

// oauth consent screens
app.get('/openid-home', (req, res) => {
    res.send('Welcome to SongBarker!');
});
app.get('/openid-privacy', (req, res) => {
    res.send('We share no information with anyone!');
});
app.get('/openid-tos', (req, res) => {
    res.send('terms of service');
});

// puppet
// nginx handles this
//app.get('/puppet', (req, res) => {
//    res.setHeader('Cache-Control', 'no-cache');
//    res.sendFile(path.join(__dirname, 'public/puppet_002/puppet.html'));
//});

// rest api
(async () => {
    // await _db.initialize_db(models);
    const db = await _db.dbPromise;

    _.each(models, (def) => {
        _.each(rest_api.obj_rest_api(def, db), (route_def) => {
            app[route_def.request_method](route_def.endpoint, route_def.handler);
        });
    });
})();

// model descriptions
app.get('/describe', (req, res) => {
    res.json(models);
});


// process raw audio into cropped pieces
app.post('/to_crops', async function (req, res) {
    // auth
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    const db = await _db.dbPromise;
    // check that raw exists
    if (!uuid_validate(req.body.uuid)) {
        res.status(400).send('malformed raw uuid');
        return;
    }
    // NOTE raw object is created in the python script below
    if (req.body.image_id) {
        // check that image exists
        if (!uuid_validate(req.body.image_id)) {
            res.status(400).send('malformed image uuid');
            return;
        }
        var image_exists = await db.get('select 1 from images where uuid = ? and user_id = ?', [
            req.body.image_id,
            req.session.user_id,
        ]);
        if (!_.get(image_exists, '1', false)) {
            res.status(400).send('image object not found');
            return;
        }
    }
    // TODO image_id == undefined works, but only because db has no images with user_id == 'undefined'
    // kind of a hack...

    exec(`
        cd ../audio_processing &&
        source .env/bin/activate &&
        export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
        python to_crops.py -i ${req.body.uuid} -u ${req.session.user_id} -m ${req.body.image_id}
    `, {
        shell: '/bin/bash',
    }, async (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.json({
                error: 'there was an error creating the crops',
            });
        } else {
            var output = stdout.split(/\r?\n/); // split by line and strip
            output.pop(); // ditch empty line
            var crop_uuids = _.map(output, (line) => {
                return line.split(' ')[0];
            });
            // TODO make this like rest api response
            // TODO brittle
            const db = await _db.dbPromise;
            var crop_qs = _.join(_.map(crop_uuids, (uuid) => { return '?'; }), ', ');
            var all_crops_sql = `select * from crops
                where uuid in (
                    ${crop_qs}
                );`;
            var crops = await db.all(all_crops_sql, crop_uuids);
            _.map(crops, (crop) => {
                crop.obj_type = 'crop';
            });
            res.json(crops);
        }
    });
});

// sequence audio into a song
app.post('/to_sequence', async function (req, res) {
    // auth
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    const db = await _db.dbPromise;
    // check crops
    var is_uuid = _.map(req.body.uuids, (uuid) => {
        return uuid_validate(uuid); // it doesnt work just mapping uuid_validate directly for some reason
    });
    if (is_uuid.includes(false)) {
        res.status(400).send('malformed crop uuids');
        return;
    }
    var crops_exist = _.map(req.body.uuids, async (uuid) => {
        var crop_exists = await db.get('select 1 from crops where uuid = ? and user_id = ?', [
            uuid,
            req.session.user_id,
        ]);
        if (!_.get(crop_exists, '1', false)) {
            return false;
        } else {
            return true;
        }
    });
    if (crops_exist.includes(false)) {
        res.status(400).send('crop object not found');
        return;
    }
    // check song
    var song_exists = await db.get('select 1 from songs where id = ?', req.body.song_id);
    if (!_.get(song_exists, '1', false)) {
        res.status(400).send('song not found');
        return;
    }

    // generate sequence
    var uuids_string = _.join(req.body.uuids, ' ');
    exec(`
        cd ../audio_processing &&
        source .env/bin/activate &&
        export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json" &&
        python to_sequence.py -c ${uuids_string} -u "${req.session.user_id}" -s "${req.body.song_id}"
    `, {
        shell: '/bin/bash',
    }, async (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            res.json({
                error: 'there was an error',
            });
        } else {
            var output = stdout.split(/\r?\n/);
            var line = output.shift();
            var sequence_uuid = line.split(' ')[0];
            var sequence_url = line.split(' ')[1];
            console.log(sequence_uuid, sequence_url);
            const db = await _db.dbPromise;
            var sequence = await db.get('select * from sequences where uuid = ?', sequence_uuid);
            sequence.obj_type = 'sequence';
            res.json(sequence);
        }
    });
});


module.exports = app.listen(port, () => console.log(`listening on port ${port}!`));
