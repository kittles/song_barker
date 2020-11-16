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
var handlebars = require('handlebars');
var fs = require('fs');
var facebook_app_token = require('../credentials/facebook_app_access_token.json').access_token;
var email_config = require('../credentials/email.json');
var { curly } = require('node-libcurl');
var bcrypt = require('bcrypt');
var generator = require('generate-password');
var nodemailer = require('nodemailer');
var validator = require('email-validator');
var uuidv4 = require('uuid').v4;
var signed_url = require('./signed_url.js')


//
// server config
//


var port = process.env.PORT || 3000;

app.use(express.json({
    type: 'application/json',
}));
app.set('json spaces', 2);
app.use(morgan('combined')); // logging
// TODO this is just for local dev, nginx should handle static on server
app.use(express.static('./public'));
// TODO no uploads needed
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
            maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        }
    })
);


//
// greeting cards
//


app.get('/card/:uuid', async (req, res) => {
    // uuid gets a greeting_card object
    // greeting card is used to get necessary info to make a page
    // with template vars filled in for all the animations etc
    // page has to do a couple things:
    // 1. wait until everything is loaded before allowing playback
    // 2. control playback (keep in sync etc), allow repeats and pause
    // 3. links to download app etc
    function show_error_page () {
        res.sendFile(path.join(__dirname + '/public/puppet/error-page.html'));
    }

    // TODO delete

    if (!uuid_validate(req.params.uuid)) {
        // TODO should redirect to a user friendly page
        //res.status(400).send('malformed raw uuid');
        show_error_page();
        return;
    }
    const db = await _db.dbPromise;
    console.log(process.env.k9_database);
    var check = await db.get('select * from users limit 1');
    console.log(check);
    var card = await db.get('select * from greeting_cards where uuid = ?', req.params.uuid);
    if (_.isUndefined(card)) {
        //res.status(404).send('card does not exist');
        show_error_page();
        return;
    }
    // get face coordinates
    var image = await db.get('select * from images where uuid = ?', card.image_id);
    if (_.isUndefined(image)) {
        //res.status(400).send('unable to find image for card');
        show_error_page();
        return;
    }
    // get decoration image bucket fp
    var decoration_image = await db.get('select * from decoration_images where uuid = ?', card.decoration_image_id);
    if (_.isUndefined(decoration_image)) {
        //res.status(400).send('unable to find decoration image for card');
        //return;
        decoration_image = {
            bucket_fp: null,
        };
    }
    // card audio bucket fp
    var card_audio = await db.get('select * from card_audios where uuid = ?', card.card_audio_id);
    if (_.isUndefined(card_audio)) {
        //res.status(400).send('unable to find card audio');
        show_error_page();
        return;
    }
    fs.readFile('public/puppet/puppet.html', 'utf-8', function (error, source) { //TODO just using sketch to test...
        var template = handlebars.compile(source);
        var html = template({
            uuid: req.params.uuid,
            // asset bucket fps
            card_audio_bucket_fp: card_audio.bucket_fp,
            image_bucket_fp: image.bucket_fp,
            decoration_image_bucket_fp: decoration_image.bucket_fp,
            // animation
            image_coordinates_json: image.coordinates_json,
            animation_json: card.animation_json,
            // card text
            name: card.name,
            recipient_name: card.recipient_name,
            mouth_color: image.mouth_color,
            domain_name: process.env.k9_domain_name,
            bucket_name: process.env.k9_bucket_name,
        });
        res.send(html);
    });
});


// TODO remove this
app.get('/', (req, res) => {
    res.send(`sessionID: ${req.sessionID}, user_id: ${req.session.user_id}`);
});


//
// oauth login stuff
//


app.get('/openid-home', (req, res) => {
    res.send('Welcome to SongBarker!');
});


app.get('/openid-privacy', (req, res) => {
    res.send('We share no information with anyone!');
});


app.get('/openid-tos', (req, res) => {
    res.send('terms of service');
});


function add_stock_objects_to_user (user_id) {
    // when new accounts are created, this runs a python script that will add
    // db entries for stock objects for the new user
    var python_env_script = `${__dirname}/../audio_processing/.env/bin/activate`;
    var add_stock_script = `${__dirname}/../stock_assets/add_stock_objects_to_user.py`;
    var app_credentials = ' export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json"';
    var cmd = `source ${python_env_script} && ${app_credentials} &&  python ${add_stock_script} --user-id "${user_id}"`;
    exec(cmd, { shell: '/bin/bash' }, () => { console.log(`finished adding stock objects for ${user_id}`); });
}


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
            // attach the user_id to the session
            req.session.user_id = payload.email;
        } else {
            // create a new user object
            await user_sess.add_user(payload.email, payload.name, payload.email);
            // should verify that db insert worked
            req.session.user_id = payload.email;
            // subprocess to add stock objects
            add_stock_objects_to_user(payload.email)
        }
        req.session.openid_platform = 'google';
        return res.json({ success: true, err: null, payload: payload });
    } catch (err) {
        return res.json({ success: false, err: err, payload: null });
    }
});


// facebook user creation
app.post('/facebook-token', async (req, res) => {
    /*
    NOTE: you must have a valid app access token in the credentials dir

    client has made a request to facebook for a token, received the token
    and sent it here- it looks like a long string of numbers and letters

    first the server has to verify the token is valid, by checking it like:
    curl -X GET "https://graph.facebook.com/debug_token?input_token{this-is-the-token-we-are-checking}&access_token={access-token-for-k9karaoke-facebook-app}"

    this comes back as a json object with some basic details, including the user_id (assuming the token is valid), something like:
    {
        "data": {
            "app_id": "2622706171384608",
            "application": "sound barker",
            "data_access_expires_at": 1602199520,
            "expires_at": 1594429200,
            "is_valid": true,
            "scopes": [
                "public_profile"
            ],
            "type": "USER",
            "user_id": "10100343189417943"
        }
    }

    an invalid token looks like this:
    {
        "data": {
            "error": {
                "code": 190,
                "message": "Invalid OAuth access token."
            },
            "is_valid": false,
            "scopes": []
        }
    }

    probably just use token.data.is_valid...

    assuming a valid token, use the user_id to get the users email
    */
    try {
        // verify token
        // get email

        //curl -X GET "https://graph.facebook.com/debug_token?input_token{this-is-the-token-we-are-checking}&access_token={access-token-for-k9karaoke-facebook-app}"
        var verify_url = `https://graph.facebook.com/debug_token?input_token=${req.body.facebook_token}&access_token=${facebook_app_token}`;
        var { status, data, headers } = await curly.get(verify_url);
        data = JSON.parse(data).data;
        if (!_.get(data, 'is_valid', false)) {
            return res.json({ success: false, err: 'invalid token', payload: null });
        }

        var info_url = `https://graph.facebook.com/v7.0/me?fields=id%2Cname%2Cemail&access_token=${req.body.facebook_token}`;
        var { status, data, headers } = await curly.get(info_url);
        var payload = JSON.parse(data);
        req.session.openid_profile = payload;
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
            // subprocess to add stock objects
            add_stock_objects_to_user(payload.email)
            req.session.user_id = payload.email;
        }
        req.session.openid_platform = 'facebook';
        return res.json({ success: true, err: null, payload: payload });
    } catch (err) {
        console.log(err);
        return res.json({ success: false, err: err, payload: null });
    }
});


//
// manual account stuff
//


app.post('/manual-login', async (req, res) => {
    if (!req.body.email) {
        res.json({
            success: false,
            error: 'missing email',
        });
        return;
    }
    if (!req.body.password) {
        res.json({
            success: false,
            error: 'missing password',
        });
        return;
    }
    var user_obj = await user_sess.get_user(req.body.email);
    if (!user_obj) {
        res.json({
            success: false,
            error: 'no user found',
        });
        return;
    }
    if (_.get(user_obj, 'pending_confirmation') === 1) {
        res.json({
            success: false,
            error: 'uncofirmed account',
        });
        return;
    }
    var accept_password = await bcrypt.compare(req.body.password, user_obj.password);

    if (accept_password) {
        req.session.user_id = req.body.email;
        req.session.openid_platform = 'manual';
        res.json({
            success: true,
            payload: {
                email: req.body.email,
            },
        });
    } else {
        res.json({
            success: false,
            error: 'incorrect password',
        });
    }
});


app.post('/create-account', async (req, res) => {
    // check that we have a email and password
    if (!req.body.email) {
        res.json({
            success: false,
            error: 'missing email',
        });
        return;
    }
    if (!req.body.password) {
        res.json({
            success: false,
            error: 'missing password',
        });
        return;
    }
    if (!validator.validate(req.body.email)) {
        res.json({
            success: false,
            error: 'invalid email',
        });
        return;
    }

    if (! await email_available(req.body.email)) {
        var user_obj = await user_sess.get_user(req.body.email);

        // if there is an account, but its pending confirmation
        if (user_obj.pending_confirmation) {
            res.json({
                success: false,
                error: 'account already exists, but email hasnt been confirmed',
            });
            return;
        }

        // if there is a confirmed account, try to log in with the password
        if (user_obj.password == null) {
            res.json({
                success: false,
                error: 'account already exists, but was created with openid, not password',
            });
            return;
        }
        var accept_password = await bcrypt.compare(req.body.password, user_obj.password);
        if (accept_password) {
            req.session.user_id = req.body.email;
            req.session.openid_platform = 'manual';
            res.json({
                success: true,
                payload: {
                    email: req.body.email,
                },
                account_already_exists: true, // this is useful if a user tries to click sign in and hits sign up by accident
            });
            return;
        } else {
            res.json({
                success: false,
                error: 'account already exists, but incorrect password',
            });
            return;
        }
    }

    var email_confirmation_string = uuidv4();
    var password = await hash_password(req.body.password);
    const db = await _db.dbPromise;
    // create an account that is pending confirmation
    var result = await db.run('insert into users (user_id, name, email, password, email_confirmation_string, pending_confirmation) values (?, ?, ?, ?, ?, ?)',
        req.body.email,
        'Canine Friend',
        req.body.email,
        password,
        email_confirmation_string,
        1,
    );

    var transporter = nodemailer.createTransport({
        host: email_config.GMAIL_SERVICE_HOST,
        port: email_config.GMAIL_SERVICE_PORT,
        secure: email_config.GMAIL_SERVICE_SECURE,
        auth: {
            user: email_config.GMAIL_USER_NAME,
            pass: email_config.GMAIL_USER_PASSWORD,
        },
    });

    var email_confirmation_url = `https://thedogbarksthesong.ml/confirm/${email_confirmation_string}`;


    fs.readFile('public/puppet/confirmation_email.html', 'utf-8', function (error, source) {
        var template = handlebars.compile(source);
        var html = template({
            confirmation_link: email_confirmation_url,
        });
        transporter.sendMail({
            from: '"K-9 Karaoke" <no-reply@turboblasterunlimited.com>', // sender address
            to: req.body.email,
            subject: 'K-9 Karaoke email confirmation ✔', // Subject line
            html: html,
        });
    });

    res.json({
        success: true,
        payload: {
            email: req.body.email,
        },
        account_already_exists: false,
    });
});


app.get('/confirm/:uuid', async (req, res) => {
    if (!uuid_validate(req.params.uuid)) {
        res.status(400).send('invalid confirmation string');
        return;
    }

    const db = await _db.dbPromise;
    var result = await db.get('select user_id, email from users where email_confirmation_string = ? and pending_confirmation = 1',
       req.params.uuid,
    );
    if (!_.get(result, 'user_id')) {
        res.status(400).send('no account for this confirmation string');
        return;
    }

    var update_query = await db.run('update users set pending_confirmation = 0 where user_id = ?',
        result.user_id,
    );
    // subprocess to add stock objects
    add_stock_objects_to_user(result.user_id)

    res.send('K9 Karaoke has confirmed your email address, go to the app to log in!');
});


app.post('/change-password', async (req, res) => {
    if (!req.body.old_password) {
        res.json({
            success: false,
            error: 'missing old password',
        });
        return;
    }
    if (!req.body.new_password) {
        res.json({
            success: false,
            error: 'missing new password',
        });
        return;
    }
    var user_obj = await user_sess.get_user(req.session.user_id);
    if (!user_obj) {
        res.json({
            success: false,
            error: 'no user found',
        });
        return;
    }
    var accept_password = await bcrypt.compare(req.body.old_password, user_obj.password);
    if (accept_password) {
        var password = await hash_password(req.body.new_password);
        const db = await _db.dbPromise;
        var result = await db.run('update users set password = ? where user_id = ?',
            password,
            user_obj.user_id
        );
        res.json({
            success: true,
            // some other shit
        });
    } else {
        res.json({
            success: false,
            error: 'incorrect password',
        });
    }
});


app.post('/temp-password', async (req, res) => {
    var user_obj = await user_sess.get_user(req.body.user_id);
    if (!user_obj) {
        res.json({
            success: false,
            error: 'no user found',
        });
        return;
    }
    // generate temp password
    var temp_password = generator.generate({
        length: 10,
        numbers: true
    });
    var temp_hash_password = await hash_password(temp_password);
    const db = await _db.dbPromise;
    var result = await db.run('update users set password = ? where user_id = ?',
        temp_hash_password,
        user_obj.user_id
    );

    var transporter = nodemailer.createTransport({
        host: email_config.GMAIL_SERVICE_HOST,
        port: email_config.GMAIL_SERVICE_PORT,
        secure: email_config.GMAIL_SERVICE_SECURE,
        auth: {
            user: email_config.GMAIL_USER_NAME,
            pass: email_config.GMAIL_USER_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: '"seattle city sellahs" <seattlecitysellers@gmail.com>', // sender address
        to: user_obj.email,
        subject: 'K9 Karaoke account recovery ✔', // Subject line
        text: `please use this temporary password to log in to your account: ${temp_password}`,
    });

    res.json({
        success: true,
    });
});


app.get('/email-available/:email', async (req, res) => {
    res.json({
        email_available: await email_available(req.params.email),
    });
});


async function email_available (email) {
    // return true == email is available
    const db = await _db.dbPromise;
    var email_query = await db.get('select 1 from users where user_id = ?', email);
    return !_.get(email_query, '1', false);
}


async function hash_password (password) {
    var salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
}


//
// account state management
//


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


function handle_delete_account (user_id) {
    // when new accounts are created, this runs a python script that will add
    // db entries for stock objects for the new user
    var python_env_script = `${__dirname}/../audio_processing/.env/bin/activate`;
    var add_stock_script = `${__dirname}/../audio_processing/delete_account.py`;
    var app_credentials = ' export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json"';
    var cmd = `source ${python_env_script} && ${app_credentials} &&  python ${add_stock_script} --user-id "${user_id}"`;
    exec(cmd, { shell: '/bin/bash' }, () => { console.log(`deleted ${user_id}`); });
}


// delete account and all associated stuff
app.post('/delete-account', async function (req, res) {
    // auth
    if (!req.session.user_id) {
        res.status(401).send('you must be logged in');
        return;
    }
    handle_delete_account(req.session.user_id);
    delete req.session.user_id;
    res.json({ success: true });
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
// TODO remove
app.get('/describe', (req, res) => {
    res.json(models);
});


//
// audio processing apis
//

// signed uploads from app instead of giving them the credential
app.post('/signed-upload-url', async (req, res) => {
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    if (!req.body.filepath) {
        res.status(400).send('no filepath included in body');
        return;
    }
    if (!req.body.content_type) {
        res.status(400).send('no content_type included in body. use "audio/mpeg" for audio, and "image/jpeg" or "application/octet-stream" for images');
        return;
    }
    var url = await signed_url.to_signed_upload_url(req.body.filepath);
    return res.json({
        url: url,
        success: true,
    });
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
    var cmd_for_logging = `python to_sequence.py -c ${uuids_string} -u "${req.session.user_id}" -s "${req.body.song_id}"`;
    console.log('CALLING to_sequence.py: ', cmd_for_logging);
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


//// for local dev with app
//var fs = require('fs');
//var https = require('https');
//var privateKey  = fs.readFileSync('../credentials/server.key', 'utf8');
//var certificate = fs.readFileSync('../credentials/server.crt', 'utf8');
//var credentials = {key: privateKey, cert: certificate};
//var httpsServer = https.createServer(credentials, app);
//httpsServer.listen(8443);

module.exports = app.listen(port, () => console.log(`listening on port ${port}!`));
