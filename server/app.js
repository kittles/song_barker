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
var generate_short_uuid = require('short-uuid').generate;
var signed_url = require('./signed_url.js')
//var https = require('https');
//var cloud_access_token = require('../credentials/cloud-access-token.json').token;
//var axios = require('axios');
var cloud_request = require('./cloud_request.js').cloud_request;
var data_for_name = require('./autoname_crop.js').data_for_name;
var insert_into_db = require('./db_insert.js').insert_into_db;

var sendgrid = require('./sendgrid');

var devmgr = require('./device_signin')

const fetch = require("node-fetch");

var rcat = require('./rcat2ga4');

//const AppleAuth = require("apple-auth");

//
// server config
//


var port = process.env.PORT || 3000;

var guest_account = "support@turboblasterunlimited.com";

app.use(express.json({
    type: 'application/json',
}));
app.set('json spaces', 1);
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

/*****************
Begin configuration for new google signin application
JMF -- 13-oct-2022
*/

app.use(express.urlencoded({ extended: true }));

// Import the functions you need from the SDKs you need
const firebase = require("firebase/app");
const firebaseAnalytics = require("firebase/analytics");

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyANbOcar7YVUUAzsmNTpk2x0MVNXeG54XA",
    authDomain: "song-barker.firebaseapp.com",
    databaseURL: "https://song-barker.firebaseio.com",
    projectId: "song-barker",
    storageBucket: "song-barker.appspot.com",
    messagingSenderId: "867304541572",
    appId: "1:867304541572:web:0f92b665524cbfbb20e1d1",
    measurementId: "G-Z41C74JL05"
  };
  

const { 
  getAuth, 
  signInWithCredential,
  GoogleAuthProvider,
 } = require("firebase/auth");

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const firebaseApp = firebase.getApp();
//const analytics = firebaseAnalytics.getAnalytics(app);



/*****
 * End configuration for new google signin
 */
const measurement_id = "G-VTMC8Z7ZC9";
const api_secret = "PtwAnu7bQcmiZk1TDYxNrQ";

// testing
app.post('/testga', async(req, res) => {
    //var clientid = ga.getAll ().get ('clientId');
    console.log(req.body.name);
    var result = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`, 
        {
        method: "POST",
        body: JSON.stringify({
            client_id: '123.123',
            events: [{
            name: 'tutorial_begin',
            params: {user_id: req.body.name},
            }]
        })
    });
    res.status(200).send("testing ga4: " + result.toString());
});

app.post('/ga4', async(req, res) => {
    //var clientid = ga.getAll ().get ('clientId');
    console.log(req.body.name);
    // var result = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`, 
    //     {
    //     method: "POST",
    //     body: JSON.stringify({
    //         client_id: req.body.name,
    //         events: [{
    //         name: 'login',
    //         params: {method: 'Apple'},
    //         }]
    //     })
    // });
    console.log(req.body.name, req.body.login_method);
    var result = await send_login_ga4(req.body.name, req.body.login_method);
    res.status(200).send("testing ga4 sent event: " + result.toString());
});

async function send_login_ga4 (clientId, loginMethod) {
    var result = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`, 
        {
        method: "POST",
        body: JSON.stringify({
            client_id: clientId,
            events: [{
            name: 'login',
            params: {method: loginMethod},
            }]
        })
    });
    return result;
}

async function send_revenuecat_ga4(event) {
    var result = false;
    if(event != null)
    {
        var event_string = JSON.stringify(event);
        console.log("ga4 body: ", event_string);
        result = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurement_id}&api_secret=${api_secret}`, 
            {
            method: "POST",
            body: event_string
        });
        
    }

    var result = true;
    return result;
}

app.post('/revenuecat', async(req, res) => {
    res.status(200).send();
    console.log("Sent 200 code");
    try {
        console.log("event_type:", req.body.event.type);
        //console.log(JSON.stringify(req.body));
        var event = rcat.translate_event(req.body.event);
        console.log("about to send event");
        var result = await send_revenuecat_ga4(event);
        console.log("revenue cat GA4 send result:", result);
    }
    catch (err) {
        console.log("Error parsing JSON string:", err);
    }
    return;
});

app.post('/appstore', async(req, res) => {
    res.status(200).send();
    console.log("/appstore: Sent 200 code");
    try {
        console.log(responseBodyV2);
        // //console.log(JSON.stringify(req.body));
        // var event = rcat.translate_event(req.body.event);
        // console.log("about to send event");
        // var result = await send_revenuecat_ga4(event);
        // console.log("revenue cat GA4 send result:", result);
    }
    catch (err) {
        console.log("Error parsing JWS string:", err);
    }
    return;
});

const cyrb53 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for(let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

app.get('/test-cyrb53', async(req, res) => {
    var s = req.body.data;
    var n = cyrb53(s);
    console.log(s, "==>", n);
    var result = {
        str: s,
        num: n
    }
    res.json(result);
});

//
// greeting cards
//
// TODO implement these
app.post('/to_card_key', async (req, res) => {
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    const db = await _db.dbPromise;
    if (!uuid_validate(req.body.card_uuid)) {
        res.status(400).send('malformed card uuid');
        return;
    }
    // generate the card key object, used for retrieving cards
    // from short urls
    var key_uuid = generate_short_uuid();
    var key_data = {
        key_id: key_uuid,
        recipient_name: req.body.recipient,
        card_uuid: req.body.card_uuid,
        has_envelope: req.body.has_envelope,
    };
    var insert_result = await insert_into_db('card_key', key_data);
    // TODO make sure it succeeded
    key_data['obj_type'] = 'card_key';
    key_data['url'] = `https://${process.env.k9_domain_name}/c/${key_uuid}`;
    res.json(key_data);
});

app.get('/privacy.html', async(req, res) => {
    res.sendFile(path.join(__dirname + '/public/puppet/privacy.html'));
});

app.get('/TermsOfUse.html', async(req, res) => {
    res.sendFile(path.join(__dirname + '/public/puppet/TermsOfUse.html'));
});

app.get('/support.html', async(req, res) => {
    res.sendFile(path.join(__dirname + '/public/puppet/supportq.html'));
});


// TODO refactor these three endpoints


app.get('/c/:card_key', async (req, res) => {
    // copy the steps for /card, with the additional step of
    // retrieving the card id and message from the db
    function show_error_page () {
        res.sendFile(path.join(__dirname + '/public/puppet/error-page.html'));
    }

    const db = await _db.dbPromise;
    var card_key = await db.get('select * from card_key where key_id = ?', req.params.card_key);
    if (_.isUndefined(card_key)) {
        //res.status(404).send('card does not exist');
        show_error_page();
        return;
    }
    var card = await db.get('select * from greeting_cards where uuid = ?', card_key.card_uuid);
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
    fs.readFile('public/puppet/puppet.html', 'utf-8', function (error, source) {
        var template = handlebars.compile(source);
        var html = template({
            uuid: req.params.card_key,
            // asset bucket fps
            card_audio_bucket_fp: card_audio.bucket_fp,
            image_bucket_fp: image.bucket_fp,
            decoration_image_bucket_fp: decoration_image.bucket_fp,
            // animation
            image_coordinates_json: image.coordinates_json,
            animation_json: card.animation_json,
            // card text
            name: card.name,
            recipient_name: card_key.recipient_name, // NOTE this is actually used with short urls
            mouth_color: image.mouth_color,
            lip_color: image.lip_color,
            lip_thickness: image.lip_thickness,
            domain_name: process.env.k9_domain_name,
            bucket_name: process.env.k9_bucket_name,
            has_envelope: card_key.has_envelope,
        });
        res.send(html);
    });
});
// app.get('/', (req, res, next) => {
//     // get actual data from other server and return it as our response
//     request('https://x4y.517.myftpupload.com/').pipe(res);
// });

// app.get('/', async (req, res) => {
//     res.send("testing...");
// });
//
// landing page
//
app.get('/index.html', async (req, res) => {
    res.sendFile(path.join(__dirname + '/public/puppet/index.html'));
});

app.get('/', async (req, res) => {
    function show_error_page () {
        res.sendFile(path.join(__dirname + '/public/puppet/error-page.html'));
    }

    console.log("I'm Redirecting to home page...");
    res.sendFile(path.join(__dirname + '/public/puppet/index.html'));
    //res.redirect("https://k-9karaoke.com/puppet/index.html");
    return;
    // var q = url.parse(req.url, true);
    // console.log("pathname: " + q.pathname);
    // if ( q.pathname == '/' || q.pathname == "/index.html" || q.pathname == "/index.htm" || q.pathname == "/index") {
    //     console.log("Redirecting to https://k-9karaoke.com/wordpress/" );
    //     res.redirect('https://k-9karaoke.com/wordpress/');
    //     return;
    // }

    var uuid = '9f8ee9b2-dba6-4023-9791-0940324f6ff9';
    const db = await _db.dbPromise;
    var card = await db.get('select * from greeting_cards where uuid = ?', uuid);
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
    fs.readFile('public/puppet/puppet.html', 'utf-8', function (error, source) {
        var template = handlebars.compile(source);
        var html = template({
            uuid: uuid,
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
            has_envelope: false,
        });
        res.send(html);
    });
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


async function manual_to_openid_confirmation (user) {
    // used by fb and google handlers below to
    // handle the case where a user signs up manually,
    // doesnt confirm their email,
    // then logs in with open id that has the same email
    // as their manual signup
    // TODO put this in the two open id endpoints below and test
    if (user.pending_confirmation) {
        console.log("Overriding previous email attempt to signup");
        try {
            const db = await _db.dbPromise;
            // todo: update account_type = google.
            var update_query = await db.run('update users set pending_confirmation = 0, set account_type = ? where user_id = ?',
                'google',
                user.user_id,
            );
            // subprocess to add stock objects
            add_stock_objects_to_user(user.user_id);
            console.log("Override successful, user has full account.");
        }
        catch(err) {
            console.log(err);
        }
    }
}

/**
 * Added jmf 7/26/22
 * Needs device_id mods
 */
async function complete_apple_registration(appleid, email) {
    try {
        const db = await _db.dbPromise;
        // todo: update account_type to apple.
        var update_query = await db.run(
            'update users set pending_confirmation = 0, email_confirmation_string = ?, account_type = ? where user_id = ?',
            email,
            'apple',
            appleid,
        );
        
        // subprocess to add stock objects
        add_stock_objects_to_user(appleid);
        console.log("Apple registration successful, user has full account.");
    }
    catch(err) {
        console.log(err);
    }
}

async function finish_google_signin(email, req, res) {
    req.session.openid_platform = 'google';
    var user_obj = await user_sess.get_user_no_password(email);
    // added jmf: 6-22-23
    devmgr.signin_registered_user(req.session.user_id, req.session.device_id);
    console.log("About to send successful response");
    await send_login_ga4(req.session.user_id, "Google");
    return res.json({ success: true, error: null, user: user_obj });
}

app.post('/openid-token/:platform', async (req, res) => {
    try {
        var payload;
// ************************ Old Google Signin        
        // if (req.params.platform === 'android') {
        //     payload = await verify.android_verify(req.body);
        // }
        // if (req.params.platform === 'ios') {
        //     payload = await verify.ios_verify(req.body);
        // }
// *********************** new google signin 
        var id_token = req.body.id_token;
        // added jmf 6/22/23
        req.session.device_id = req.session.user_id;
        if(id_token == null) {
            throw new Error("bad request");
        }
        console.log("Platform ============>", req.session.openid_platform);
        console.log(id_token);
        console.log("GOOGLE LOGIN", req.session.user_id);
        var credential = GoogleAuthProvider.credential(id_token);

        // Sign in with credential from the Google user.
        const auth = getAuth();
        signInWithCredential(auth, credential)
        .then((userCredential)=> {
            console.log("userCredential===> ", userCredential.user.email);
            console.log("Google signin: Successful login");
            payload = userCredential.user;
            //res.send({ success: true, user: userCredential });
            // back to existing google signin code
            req.session.openid_profile = payload;
            console.log("payload2:", payload);
            // see if an account with the payload's email as user_id exists
            var user = user_sess.get_user(payload.email)
            .then((user) => {
            if (user) {
                // attach the user_id to the session
                req.session.user_id = payload.email;
                // if the account was created with manual sign in, but they never confirmed
                // this will handle that. if they did, this does nothing
                manual_to_openid_confirmation(user);
                finish_google_signin(payload.email, req, res);
            } else {
                // create a new user object
                user_sess.add_user(payload.email, payload.name, payload.email)
                .then(()=>{
                    // should verify that db insert worked-
                    req.session.user_id = payload.email;
                    // subprocess to add stock objects
                    add_stock_objects_to_user(payload.email)
                    finish_google_signin(payload.email, req, res);
                });
            }
            // req.session.openid_platform = 'google';
            // var user_obj = await user_sess.get_user_no_password(payload.email);
            // console.log("About to send successful response");
            // return res.json({ success: true, error: null, user: user_obj });

            });
            // // added jmf: 6-22-23
            // devmgr.signin_registered_user(req.session.user_id, req.session.device_id);

        })      
        .catch((error) => {
            // Handle Errors here.
            var errorCode = error.code;
            var errorMessage = error.message;
            console.log("Error from signin with credential", errorMessage);
            // The email of the user's account used.
            // var email = error.email;
            // // The firebase.auth.AuthCredential type that was used.
            // var credential = error.credential;
            // ...
            throw new Error(errorMessage);
        });
//********************************* end new google signin */        
        // req.session.openid_profile = payload;
        // console.log("payload2:", payload);
        // // see if an account with the payload's email as user_id exists
        // var user = await user_sess.get_user(payload.email);
        // if (user) {
        //     // attach the user_id to the session
        //     req.session.user_id = payload.email;
        //     // if the account was created with manual sign in, but they never confirmed
        //     // this will handle that. if they did, this does nothing
        //     manual_to_openid_confirmation(user);
        // } else {
        //     // create a new user object
        //     await user_sess.add_user(payload.email, payload.name, payload.email);
        //     // should verify that db insert worked-
        //     req.session.user_id = payload.email;
        //     // subprocess to add stock objects
        //     add_stock_objects_to_user(payload.email)
        // }
        // req.session.openid_platform = 'google';
        // var user_obj = await user_sess.get_user_no_password(payload.email);
        // console.log("About to send successful response");
        // return res.json({ success: true, error: null, user: user_obj });
    } catch (err) {
        console.log("Caught exception: " + err);
        return res.json({ success: false, error: err, user: null });
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
            // if the account was created with manual sign in, but they never confirmed
            // this will handle that. if they did, this does nothing
            manual_to_openid_confirmation(user);
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
        var user_obj = await user_sess.get_user_no_password(payload.email);
        return res.json({ success: true, error: null, user: user_obj });
    } catch (err) {
        console.log(err);
        return res.json({ success: false, error: err, user: null });
    }
});

////////////////////////////////
// JMF 07/07/22: Add Apple SignIn
//
/**
 *  else {
            // create a new user object
            await user_sess.add_user(payload.email, payload.name, payload.email);
            // should verify that db insert worked
            req.session.user_id = payload.email;
            // subprocess to add stock objects
            add_stock_objects_to_user(payload.email)
        }
        req.session.openid_platform = 'google';
        var user_obj = await user_sess.get_user_no_password(payload.email);
        return res.json({ success: true, error: null, user: user_obj });
    } catch (err) {
        return res.json({ success: false, error: err, user: null });
    }
 */
const tokenService = require('./apple_token');

app.post('/authenticateAppleSignin', async (req, res) => {
    try {
        console.log("Entering authenticateAppleSignin for", req.session.user_id);
        req.session.device_id = req.session.user_id; // added jmf 6-22-23
        const { token, email, name, apple_id } = req.body;
        const registeredUser = { apple_id, name, email };
        var loggedInUser = {apple_id, name, email }; //

        console.log("authenticateAppleSignin");
        console.log("Parameters", token, email, registeredUser);

    // todo: validate parameters
        //res.status(200).send(registeredUser);  
        
        // attempt login
        console.log("Checking whether user at " + apple_id + " exits.");
        var user = await user_sess.get_user(apple_id);

        // if(!user) {
        //     user = await user_sess.get_user_by_email(email);
        // }

        // added jmf: 6-22-23
        await devmgr.signin_registered_user(req.session.user_id, req.session.device_id);

        if (user) {
            // login user
            console.log("User exists , logging in.");
            user.account_type = "Apple";
            if (email && email !== user.email) {

                await user_sess.update_email(apple_id, email);
                user.email = email;
                console.log("updated user's email to ", email);
            }
            req.session.user_id = apple_id;
            req.session.openid_profile = loggedInUser;
            req.session.openid_platform = "apple";
            console.log("About to return from Apple signin");
            console.log("user:", user);
            await send_login_ga4(req.session.user_id, "Apple");
            return res.json({success: true, error:null, user: user});
        }
        else {
            // register user
            console.log("Calling tokenService with token", token);
            tokenService.verify(token, (r) => {
                if (!r.success) {
                    console.log("apple validation failed with error ", r.error);
                    res.json(r);
                } 
                else {
                    console.log("apple validation succeeded, starting registration of apple user ");
                    console.log("returned from validation:", r);
                    user_sess.add_user(r.sessionId, "Canine Friend", r.email);
                    req.session.user_id = r.sessionId;
                    complete_apple_registration(apple_id, email);
                    console.log("apple validation completed");
                    req.session.openid_profile = loggedInUser;
                    req.session.openid_platform = "apple";
                    var user_obj = user_sess.get_user_no_password(apple_id);
                    console.log("Returning user object for user: ", apple_id, "\n", user_obj);
                    send_login_ga4(appleid, "Apple");
                    return res.json({success: true, error:null, user: user_obj});
                }
            });
        }
    }
    catch (err) {
        console.log("Apple signin error: ", err)
        return res.json({ success: false, error: err, user: null });
    }
});

// app.post("/sign_in_with_apple", async (request, response) => {
//     const auth = new AppleAuth(
//       {
//         // use the bundle ID as client ID for native apps, else use the service ID for web-auth flows
//         // https://forums.developer.apple.com/thread/118135
//         client_id:
//           request.query.useBundleId === "true"
//             ? process.env.BUNDLE_ID
//             : process.env.SERVICE_ID,
//         team_id: process.env.TEAM_ID,
//         redirect_uri:
//           "https://k-9karaoke.com/sign_in_with_apple", // does not matter here, as this is already the callback that verifies the token after the redirection
//         key_id: process.env.KEY_ID
//       },
//       process.env.KEY_CONTENTS.replace(/\|/g, "\n"),
//       "text"
//     );
  
//     console.log(request.query);
  
//     const accessToken = await auth.accessToken(request.query.authCode);
  
//     const idToken = JSON.parse(accessToken.id_token);
  
//     const userID = idToken.sub;
  
//     console.log(idToken);
  
//     // `userEmail` and `userName` will only be provided for the initial authorization with your app
//     const userEmail = idToken.email;
//     const userName = `${request.query.firstName} ${request.query.lastName}`;
  
//     // 👷🏻‍♀️ TODO: Use the values provided create a new session for the user in your system
//     var user = await user_sess.get_user(userEmail);
//     if (user) {
//         console.log('user exists');
//         // attach the user_id to the session
//         req.session.user_id = userEmail
//         // if the account was created with manual sign in, but they never confirmed
//         // this will handle that. if they did, this does nothing
//         manual_to_openid_confirmation(user);
//     } else {
//         // create a new user object
//         console.log('create new user');
//         await user_sess.add_user(userEmail, userName, userEmail);
//         // should verify that db insert worked
//         // subprocess to add stock objects
//         add_stock_objects_to_user(userEmail)
//         req.session.user_id = userEmail;
//     }
//     req.session.openid_platform = 'apple';
//     var user_obj = await user_sess.get_user_no_password(userEmail);
//     return res.json({ success: true, error: null, user: user_obj });
//   });

//
// manual account stuff
//


app.post('/manual-login', async (req, res) => {
    console.log("Manual login session id before ===>", req.session.user_id);
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
            error: 'unconfirmed account',
        });
        return;
    }

    var accept_password = await bcrypt.compare(req.body.password, user_obj.password);

    var user_obj = await user_sess.get_user_no_password(req.body.email);
    if (accept_password) {
        req.session.user_id = req.body.email;
        await devmgr.signin_registered_user(req.session.user_id, req.body.deviceId);
        req.session.openid_platform = 'manual';
        await send_login_ga4(req.body.email, "manual");
        res.json({
            success: true,
            error: null,
            user: user_obj,
        });
    } else {
        res.json({
            success: false,
            error: 'incorrect password',
        });
    }
});



//--------------------------------------------------- create account

function sendEmail(email, html) {
    var transporter = nodemailer.createTransport({
        host: email_config.GMAIL_SERVICE_HOST,
        port: email_config.GMAIL_SERVICE_PORT,
        secure: email_config.GMAIL_SERVICE_SECURE,
        auth: {
            user: email_config.GMAIL_USER_NAME,
            pass: email_config.GMAIL_USER_PASSWORD,
        },
    });

    return transporter.sendMail({
        from: '"K-9 Karaoke" <no-reply@turboblasterunlimited.com>', // sender address
        to: email,
        subject: 'K-9 Karaoke email confirmation ✔', // Subject line
        html: html,
    });
}

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
            // Since apple created accounts secured by apple_id, we can't get here
            // unless account created via Google Sign-In
            var message = 'account already exists, created using Google Sign-In';
            res.json({
                success: false,
                error: message,
//                error: 'account already exists, but was created with openid, not password',
            });
            return;
        }

        var accept_password = await bcrypt.compare(req.body.password, user_obj.password);
        if (accept_password) {
            var user_obj = await user_sess.get_user_no_password(req.body.email);
            req.session.user_id = req.body.email;
            req.session.openid_platform = 'manual';
            res.json({
                success: true,
                user: user_obj,
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
    var result = await insert_into_db('users', {
        'user_id': req.body.email,
        'name': 'Canine Friend',
        'email': req.body.email,
        'password': password,
        'email_confirmation_string': email_confirmation_string,
        'pending_confirmation': 1,
        'account_uuid': uuidv4(),
    });

 //   console.log("GMAIL config: " + JSON.stringify(email_config));

   
    var url_root = `https://${process.env.k9_domain_name}/confirm/` || 'https://k-9karaoke.com/confirm/';
    var email_confirmation_url = url_root + email_confirmation_string;



    var html = null;
    await fs.readFile('public/puppet/confirmation_email.html', 'utf-8', function (error, source) {
        var template = handlebars.compile(source);
        html = template({
            confirmation_link: email_confirmation_url,
        });
      
        try {
            //sendEmail(req.body.email, html);
            sendgrid_result = sendgrid.sendmail(req.body.email, 'no-reply@turboblasterunlimited.com'
                                                ,'K-9 Karaoke email confirmation ✔', html);
            console.log("Send comfirmation mail succeeded");
        }
        catch(error){
            console.log("Send mail Error: " + JSON.stringify(error));
        }
    });

    

    var user_obj = await user_sess.get_user_no_password(req.body.email);
    res.json({
        success: true,
        user: user_obj,
        account_already_exists: false,
    });
 
});

app.post('/resend-confirm', async (req, res) => {
    console.log("app.resend-confirm: resend requested");
    // check that we have a email
    if (!req.body.email) {
        console.log("app.resend-confirm error: email missing");
        res.json({
            success: false,
            error: 'missing email',
        });
        return;
    }
    if (!validator.validate(req.body.email)) {
        console.log("app.resend-confirm error: email missing");
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
            // nothing to do but continue to send reconfirmation
            // res.json({
            //     success: false,
            //     error: 'account already exists, but email hasnt been confirmed',
            // });
            // return;
            
        }
        else {
            console.log("app already confirmed, no action taken.")
            res.json({
                success: false,
                error: 'Account already confirmed, no action taken.',
            })
        }
    }
    else {
        console.log("app.resend-confirm error: account doesn't exist");
        res.json({
            success: false,
            error: "Account doesn't exist -- can't send confirmation email.",
        });
        return;
    }

    // get database reference
    const db = await _db.dbPromise;

    if (user_obj.pending_confirmation) {
    var email_confirmation_string = uuidv4();
    var update_query = await db.run('update users set email_confirmation_string = ? where user_id = ?',
                                            email_confirmation_string, user_obj.user_id,
                            );
        
    }


    // resend confirmation email.
    var url_root = `https://${process.env.k9_domain_name}/confirm/` || 'https://k-9karaoke.com/confirm/';
    var email_confirmation_url = url_root + email_confirmation_string;



    var html = null;
    await fs.readFile('public/puppet/confirmation_email.html', 'utf-8', function (error, source) {
        var template = handlebars.compile(source);
        html = template({
            confirmation_link: email_confirmation_url,
        });
      
        try {
            //sendEmail(req.body.email, html);
            sendgrid_result = sendgrid.sendmail(req.body.email, 'no-reply@turboblasterunlimited.com'
                                                ,'K-9 Karaoke email confirmation ✔', html);
            console.log("Send comfirmation mail succeeded");
        }
        catch(error){
            console.log("Send mail Error: " + JSON.stringify(error));
        }
    });

    

    var user_obj = await user_sess.get_user_no_password(req.body.email);
    console.log("app.resend-confirm success: email sent");

    res.json({
        success: true,
        user: user_obj,
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
    // todo: update account_type for email login
    var update_query = await db.run('update users set pending_confirmation = 0, account_type = ? where user_id = ?',
        'email',
        result.user_id,
    );
    // subprocess to add stock objects
    add_stock_objects_to_user(result.user_id)

    //res.send('K9 Karaoke has confirmed your email address, go to the app to log in!');
    res.sendFile(path.join(__dirname + '/public/puppet/confirm-page.html'));
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
        var user_obj = await user_sess.get_user_no_password(req.session.user_id);
        res.json({
            success: true,
            user: user_obj,
        });
    } else {
        res.json({
            success: false,
            error: 'incorrect password',
        });
    }
});


app.post('/temp-password', async (req, res) => {
    var user_obj = await user_sess.get_user(req.body.email);
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

    var url_host = "https://" + req.headers.host + "/puppet/reset.html?id=" + temp_hash_password;

    // await transporter.sendMail({
    //     from: '"K-9 Karaoke" <no-reply@turboblasterunlimited.com>', // sender address
    //     to: user_obj.email,
    //     subject: 'K9 Karaoke account recovery ✔', // Subject line
    //     text: 'please use this link to reset your password: ' + url_host,
    // });
    // jmf -- 02-nov-2021: comment out call to sendme.
    // await transporter.sendMail({
    //     from: '"K-9 Karaoke" <no-reply@turboblasterunlimited.com>', // sender address
    //     to: user_obj.email,
    //     subject: 'K9 Karaoke account recovery ✔', // Subject line
    //     text: `please use this temporary password to log in to your account: ${temp_password}`,
    // });
    sendgrid.sendmail(user_obj.email, '"K-9 Karaoke" <no-reply@turboblasterunlimited.com>'
                        ,'K9 Karaoke account recovery ✔'
                        ,  `please use this temporary password to log in to your account: ${temp_password}`);

    var user_obj = await user_sess.get_user_no_password(req.body.user_id);
    res.json({
        success: true,
        user: user_obj,
    });
});

//////////////////////////////// jmf -- reset password stuff
const maxMillisResetTokenIsValid = 1000 * 60 * 60 * 24; // token is valid for 24 hours
app.post('/complete-reset-password', async (req, res) => {
    console.log("complete-reset-password");
     console.log(req.body.user_id);
     console.log(req.body.new_password);

    if (!req.body.user_id) {
        res.json({
            success: false,
            error: 'missing token',
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
    const db = await _db.dbPromise;
    var result = await db.get('select hidden, user_id from users where email_confirmation_string = ?',
       req.body.user_id,
    );

    if (!_.get(result, 'user_id')) {
        res.json ({
            success: false,
            error: 'bad token',
        });
        return;
    }
    
    var elapsedTime = Date.now() - result.hidden;

    if(elapsedTime > maxMillisResetTokenIsValid) {
        res.json({
            success: false,
            error: 'expired token',
        });
        return;
    }

    console.log("result from db: " + JSON.stringify(result));

    var user_id = _.get(result, 'user_id');
    console.log(user_id);

    var password = await hash_password(req.body.new_password);

    var result2 = await db.run('update users set password = ?, hidden = 0, email_confirmation_string = "" where user_id = ?'
                        , password, result.user_id);

    res.json({
        success:true,
        result: result2,
    });
    return;

});

app.get('/support.html', function(req, res){
    console.log("support.html route called")
    res.sendFile(support.html, {root: './public'});
});
const authSender = "no-reply@turboblasterunlimited.com";
const supportEmail = "support@turboblasterunlimited.com";

app.post('/email-support', async (req, res) => {
    console.log("email-support web service called");
    //  console.log(req.body.email);
    //  console.log(req.body.subject);
    //  console.log(req.body.message);
     
    // validate payload
     if (!validator.validate(req.body.email)) {
        res.json({
            success: false,
            error: 'invalid email',
        });
        console.log("Email-support error, Invalid email");
        return;
    }
    if(!req.body.subject || req.body.subject.length == 0) {
        res.json({
            success: false,
            error: 'no subject'
        });
        console.log("Email-support error, No Subject");
        return;
    }
    if(!req.body.message || req.body.message.length == 0) {
        res.json({
            success: false,
            error: 'no message'
        });
        console.log("email-support error, no message.");
        return;
    }
    var to = supportEmail;
    var from = authSender;
    var subject = req.body.subject;
    var message = req.body.email + " ======" + req.body.message;

    result = sendgrid.sendmail(to, from, subject, message);
    console.log("sending support email: " + result);
    res.json ({
        success:true,
        text:result
    });

    return;

    // validated, let's send it!
    // console.log(JSON.stringify(email_config));
    // var transporter = nodemailer.createTransport({
    //     host: email_config.GMAIL_SERVICE_HOST,
    //     port: email_config.GMAIL_SERVICE_PORT,
    //     secure: email_config.GMAIL_SERVICE_SECURE,
    //     auth: {
    //         user: email_config.GMAIL_USER_NAME,
    //         pass: email_config.GMAIL_USER_PASSWORD,
    //     },
    // });
    // await transporter.sendMail({
    //     from: req.body.email, // sender address
    //     to: 'turboblasterllc@gmail.com',
    //     subject: req.body.subject, // Subject line
    //     text: req.body.message
    // }, );


});

app.get('/reset/:uuid', async (req, res) => {
    console.log('start-reset-password');
    console.log(req.params.uuid);
    var uuid = req.params.uuid;
    
    fs.readFile('public/puppet/reset.html', 'utf-8', function (error, source) {
        var template = handlebars.compile(source);

        var url = "https://" + req.get('host') + "/complete-reset-password";
    
        var html = template({
            userId: uuid,
            nextUrl: url,
        });
        res.send(html);
    });
}
);
// CREATE TABLE users (
//     user_id TEXT PRIMARY KEY,
//     name TEXT,
//     email TEXT,
//     password TEXT,
//     hidden INTEGER DEFAULT 0,
//     email_confirmation_string TEXT,
//     pending_confirmation INTEGER DEFAULT 0
// , user_agreed_to_terms_v1 INTEGER DEFAULT 0, account_uuid TEXT);

app.post('/request-reset-password', async (req, res) => {

    const db = await _db.dbPromise;

    //var user_obj = await user_sess.get_user(req.body.email);
    var user_id = req.body.email;
    
    // check if user exists;
    // Todo: 2/16/23
    var user_check = await db.get('select user_id from users where user_id=?', user_id);

    if(!user_check) {
        res.json({
            success: false,
            error: 'no user found',
        });
        return;
    }


    // generate temp one time token
    var token = uuidv4();
    var timestamp = Date.now(); // so that identifier can be timed.    

    
    var result = await db.run('update users set email_confirmation_string = ?, hidden = ? where user_id = ?',
        token,
        timestamp,
        user_id
    );

    console.log("token: " + token + ", timestamp: " + timestamp);
    console.log(JSON.stringify(email_config));
 
    // Jmf 6-dec-21: replace by SendGrid
    // var transporter = nodemailer.createTransport({
    //     host: email_config.GMAIL_SERVICE_HOST,
    //     port: email_config.GMAIL_SERVICE_PORT,
    //     secure: email_config.GMAIL_SERVICE_SECURE,
    //     auth: {
    //         user: email_config.GMAIL_USER_NAME,
    //         pass: email_config.GMAIL_USER_PASSWORD,
    //     },
    // });

    // var url_root = `https://${process.env.k9_domain_name}/reset/` 
    // || 'https://k-9karaoke.com/reset/';

    var url_root = "https://" + req.get("host") + "/reset/";

    //url_root = "http://localhost:3000/reset/";

    var email_confirmation_url = url_root + token;

    var result = "";

    fs.readFile('public/puppet/request_reset_email.html', 'utf-8', function (error, source) {
        var template = handlebars.compile(source);
        var html = template({
            confirmation_link: email_confirmation_url,
        });

        var to = req.body.email;
        var from = '"K-9 Karaoke" <no-reply@turboblasterunlimited.com>';
        var subject = 'K-9 Karaoke email confirmation ✔';
        var message = html;

        result = sendgrid.sendmail(to, from, subject, message);
        console.log("sending password reset " + result);
    
        // jmf -- replaced by SendGrid
        // transporter.sendMail({
        //     from: '"K-9 Karaoke" <no-reply@turboblasterunlimited.com>', // sender address
        //     to: req.body.email,
        //     subject: 'K-9 Karaoke email confirmation ✔', // Subject line
        //     html: html,
        // }, function(error, info){
        //     if (error) {
        //       console.log(error);
        //     } else {
        //       console.log('Email sent: ' + JSON.stringify(info));
        //     }
        //   } );
    });

    res.json ({
        success:true,
        text:result
    });

// jmf -- replaced by SendGrid
    // res.json({
    //     success: true,
    // });
});

function EmailCallback(errorObject, messageObject) {
    if(errorObject) {
        console.log("Error occurred sending mail: " + JSON.stringify(errorObject));
        console.log(JSON.stringify(messageObject));
    }
}

//////////////////////////////// jmf -- end password reset



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

// var devmgr = require('./device_signin')
app.post('/signin-device', async(req, res) => {
    console.log("/signin-dev===>")
    state = await devmgr.signin_device(req, res);
    console.log("signin-device.state =>", state);
    if(state.new_user) {
        console.log("/signin-device: adding stock objects for", req.session.user_id);
        add_stock_objects_to_user(req.session.user_id);        
    }
    else {
        console.log("signin-device, existing user:", req.session.user_id);
    }
    await send_login_ga4(req.session.user_id, "Device");
    res.json(state);
});

// for checking if logged in
// Needs device_id mods
app.get('/is-logged-in', async (req, res) => {
    console.log("Entering is-logged-in");
    try {
    var state = {
        logged_in: false,
        user_obj: null,
        user_id: false,
    };

    console.log("request.session: ", req.session.user_id);
//    console.log("result_session:", res.session);

    console.log("about to check request session for user_id");
    if (!_.get(req.session, 'user_id', false)) {
        state.user_id = false;
        console.log("is-logged-in exit early, no user_id");
        res.json(state);
        return;
    }
    console.log("about to check record in database");
    const db = await _db.dbPromise;
    console.log("Got database object");
    console.log("Fetching on ", req.session.user_id);
    var is_user = await db.get('select 1 from users where user_id = ?', req.session.user_id);
    console.log("Got user object", is_user);
    console.log("_get(is_user) returns ", _.get(is_user, '1', false));
    if (_.get(is_user, '1', false)) {
        console.log("about to call get_user_no_password");
        var sstate = state != null ? "defined" : "null";
        console.log("state is", sstate);
        state.logged_in = true;
        state.user_id = req.session.user_id;
        state.user_obj = await user_sess.get_user_no_password(req.session.user_id);
    }
    console.log("is-logged-in exits normally");
    res.json(state);
}
catch(e) {
    console.log("is-logged-in, exception: ", e);
    res.json(state);
}
});


// disassociate user id from session
app.get('/logout', (req, res) => {
    delete req.session.user_id;
    res.json({ success: true });
});


function handle_delete_account (user_id) {
    // when new accounts are created, this runs a python script that will add
    // db entries for stock objects for the new user
    console.log("About to delete database records for user", user_id);
    var python_env_script = `${__dirname}/../audio_processing/.env/bin/activate`;
    var add_stock_script = `${__dirname}/../audio_processing/delete_account.py`;
    var app_credentials = ' export GOOGLE_APPLICATION_CREDENTIALS="../credentials/bucket-credentials.json"';
    var cmd = `source ${python_env_script} && ${app_credentials} &&  python ${add_stock_script} --user-id "${user_id}"`;
    console.log("handle_delete_account calling", cmd);
    exec(cmd, { shell: '/bin/bash' }, () => { console.log(`handle_delete_account: deleted ${user_id}`); });
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
    console.log("/delete_account finished.");
    res.json({ success: true });
});


// puppet
// nginx handles this
//app.get('/puppet', (req, res) => {
//    res.setHeader('Cache-Control', 'no-cache');
//    res.sendFile(path.join(__dirname, 'public/puppet_002/puppet.html'));
//});


// model descriptions
if (process.env.k9_dev) {
    app.get('/describe', (req, res) => {
        res.json(models);
    });
}


// when a user agrees to terms
// jmf - 2/23/23
app.post('/agree-to-terms-device', async (req, res) => {
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    const db = await _db.dbPromise;
    await db.run('update devices set accepted_terms = 1 where device_id = ?', req.session.user_id);
    res.json({
        success: true,
    });
})

app.post('/agree-to-terms', async (req, res) => {
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    const db = await _db.dbPromise;
    await db.run('update users set user_agreed_to_terms_v1 = 1 where user_id = ?', req.session.user_id);
    res.json({
        success: true,
    });
})

//
// audio processing apis
//
async function terms_agreed (req) {
    // users cant do anything until they agree to terms
    var user_obj = await user_sess.get_user_by_device(req.session.device_id);
    return user_obj.accepted_terms;
}


// signed uploads from app instead of giving them the credential
app.post('/signed-upload-url', async (req, res) => {
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    var agreed = await terms_agreed(req);
    if (!agreed) {
        res.status(401).send('you must have agree to terms to access this resource');
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



// process raw audio into cropped pieces ..._in the cloud_...
// Needs device_id mods user_id => device_id
app.post('/cloud/to_crops', async function (req, res) {
    console.log('TO_CROPS BODY START:', req.body);
    // auth
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }

    console.log("Requested by", req.session.user_id);


    var agreed = await terms_agreed(req);
    if (!agreed) {
        res.status(401).send('you must have agree to terms to access this resource');
        return;
    }
    const db = await _db.dbPromise;
    // check that raw exists
    if (!uuid_validate(req.body.uuid)) {
        res.status(400).send('malformed raw uuid');
        return;
    }

    console.log("To crops Body End.  Now about to create raw object in python script below");

    // NOTE raw object is created in the python script below
    if (req.body.image_id) {
        // check that image exists
        if (!uuid_validate(req.body.image_id)) {
            console.log("400 error, malformed image uuid");
            res.status(400).send('malformed image uuid');
            return;
        }
        var image_exists = await db.get('select 1 from images where uuid = ? and user_id = ?', [
            req.body.image_id,
            req.session.user_id,
        ]);
        if (!_.get(image_exists, '1', false)) {
            console.log("400 error, image object not found");
            res.status(400).send('image object not found');
            return;
        }
    }

    console.log("To crops is about to make request to cloud endpoint to split barks");
    // now that the stuff is all validated, make a request to the cloud endpoint for the actual
    // splitting
    var crop_data = await cloud_request('to_crops', {
        uuid: req.body.uuid,
        bucket: process.env.k9_bucket_name,
    })
    if (_.has(crop_data, 'stderr')) {
        res.status(503).send(`cloud request failed - ${crop_data.stderr}`);
        return;
    }

    console.log("crop_data: ", crop_data);

    // response looks like
    // {
    //   crops: [
    //     {
    //       uuid: '58c7642b-17af-43f8-a7cd-e8a2d057b20a',
    //       bucket_filepath: 'gs://song_barker_sequences/100288f3-dbc2-45fd-b051-c90b5c53d851/cropped/58c7642b-17af-43f8-a7cd-e8a2d057b20a.aac',
    //       duration: 1.3520408163265305
    //     },
    //     ...

    // db stuff
    // TODO maybe this should be one big transaction

    console.log("About to insert ids");

    try {
        await insert_into_db('raws', {
            uuid: req.body.uuid,
            user_id: req.session.user_id,
        });
    } catch (err) {
        // probably unique constraint error, nbd
        console.log('error inserting raw row', err);
    }
    // TODO this is susceptible to timing issues
    var name_info = await data_for_name(req.body.image_id, req.session.user_id);
    //looks like :
    //{
    //    base_name: 'some-name',
    //    count: 4
    //}

    console.log("ids:", name_info);
    console.log("About to insert crops");

    for (var i = 0; i < crop_data.crops.length; i++) {
        // dont respond until everything is in the db?
        // i dont remember how this
        await insert_into_db('crops', {
            uuid: crop_data.crops[i].uuid,
            raw_id: req.body.uuid,
            user_id: req.session.user_id,
            name: `${name_info.base_name} ${name_info.count + 1 + i}`,
            bucket_url: `gs://${req.body.uuid}/cropped/${crop_data.crops[i].uuid}.aac`,
            bucket_fp: `${req.body.uuid}/cropped/${crop_data.crops[i].uuid}.aac`,
            stream_url: null,
            hidden: 0,
            duration_seconds: crop_data.crops[i].duration,
        });
    }

    console.log("Inserts succeeded");

    // everythings in the db now, so respond to client with new crops
    // by selecting them out of the db (so they mimic the rest api)
    var crop_qs = _.join(_.map(crop_data.crops, (crop) => { return '?'; }), ', ');
    var all_crops_sql = `select * from crops
        where uuid in (
            ${crop_qs}
        );`;
    var crops = await db.all(all_crops_sql, _.map(crop_data.crops, 'uuid'));
    _.map(crops, (crop) => {
        crop.obj_type = 'crop';
    });


    console.log("selection to mimic apis succeeded, returning crop info to client");
    res.json(crops);
});


// sequence audio into a song
// Needs device_id mods
app.post('/cloud/to_sequence', async function (req, res) {
    console.log('TO SEQUENCE BODY:', req.body);
    // validation
    var device_id = req.session.device_id;
    console.log("TO SEQUENCE device:", device_id);
    // auth
    if (!req.session.user_id) {
        res.status(401).send('you must have a valid user_id to access this resource');
        return;
    }
    var agreed = await terms_agreed(req);
    if (!agreed) {
        res.status(401).send('you must have agree to terms to access this resource');
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
        var crop_exists 
            = await db.get('select 1 from crops where uuid = ? and (user_id = ? or user_id = ?)', [
                uuid,
                req.session.user_id,
                req.session.device_id,
        ]);
        if (!_.get(crop_exists, '1', false)) {
            return false;
        } else {
            return true;
        }
    });
    if (crops_exist.includes(false)) {
        console.trace("Crop object not found");
        res.status(400).send('crop object not found');
        return;
    }
    // check song
    var song_exists = await db.get('select 1 from songs where id = ?', req.body.song_id);
    if (!_.get(song_exists, '1', false)) {
        console.trace("Song not found");
        res.status(400).send('song not found');
        return;
    }

    // generate sequence
    var song_obj = await db.get('select * from songs where id = ?', req.body.song_id);
    song_obj.name
    var crop_objs = await Promise.all(_.map(req.body.uuids, async (uuid) => {
        var row = await db.get('select * from crops where uuid = ? and (user_id = ? or user_id = ?)'
        , [
            uuid,
            req.session.user_id,
            req.session.device_id,
        ]);
        return row;
    }));

    // hack to handle apostrophes in 
    // song names, since you dont need the name
    // on the cloud
    function no_name (so) {
        so.name = '';
        return so;
    }

    var sequence_data = await cloud_request('to_sequence', {
        song: no_name(song_obj),
        crops: crop_objs,
        bucket: process.env.k9_bucket_name,
    })
    console.log("Sequence data:", sequence_data);
    console.log("crop objs: " + crop_objs);
    console.log("bucket: " + process.env.k9_bucket_name);
    if (_.has(sequence_data, 'stderr')) {
        res.status(503).send(`cloud request failed - ${sequence_data.stderr}`);
        return;
    }
    // response looks like:
    //     {
    //         "uuid": "2555fdc7-2ae2-441f-b490-1fd578f78da6",
    //         "song_id": 1,
    //         "crop_id": "ab9bcc7f-31cd-49e3-8d36-42857fa348c9 4fddd98c-d2af-42c2-81fc-ae97947d1f25 f1253b68-0da9-4bdf-9536-164d0b981f19",
    //         "bucket_url": "gs://song_barker_sequences/f763e606-25d2-461e-ad73-a864face28d6/sequences/2555fdc7-2ae2-441f-b490-1fd578f78da6.aac",
    //         "bucket_fp": "f763e606-25d2-461e-ad73-a864face28d6/sequences/2555fdc7-2ae2-441f-b490-1fd578f78da6.aac",
    //         "backing_track_fp": "backing_tracks/1/6.aac",
    //         "backing_track_url": "gs://song_barker_sequences/backing_tracks/1/6.aac",
    //         "stream_url": null,
    //         "hidden": 0
    //     }
    // NOTE need to add user_id and name before inserting

    // get sequence count for name
    var sequence_count_sql = `
        SELECT count(*) FROM sequences
        WHERE
            user_id = ?
        AND
            name LIKE ?
        ;
    `;
    var sequence_row = await db.get(sequence_count_sql, [
        req.session.user_id,
        `%${song_obj.name}%`,
    ]);
    var sequence_count = parseInt(sequence_row['count(*)']) || 0;
    sequence_data['name'] = `${song_obj.name} ${sequence_count + 1}`;
    sequence_data['user_id'] = req.session.user_id;

    /* JMF -- server mods for guest accounts **/
    /* sequence structure
    CREATE TABLE sequences (
    uuid TEXT PRIMARY KEY,
    song_id TEXT,
    crop_id TEXT,
    user_id TEXT,
    name TEXT,
    backing_track_url TEXT,
    backing_track_fp TEXT,
    bucket_url TEXT,
    bucket_fp TEXT,
    stream_url TEXT,
    hidden INTEGER DEFAULT 0,
    created INTEGER DEFAULT CURRENT_TIMESTAMP
);
    */

    // begin jmf code insert 12/27/2022
    var sequence_obj = false;
    // disabling for now as doesn't work.
    if(false && req.session.user_id == guest_account) {
        console.log("===================> Skipping insert for GUEST");
        sequence_obj = sequence_data;
    }
    else {
        console.log("===================> regular account, inserting new sequence into database.");
        var insert_result = await insert_into_db('sequences', sequence_data);
        sequence_obj = await db.get('select * from sequences where uuid = ?', sequence_data.uuid);
    }
    // end jmf code insert 12/27/2022

    // begin jmf old code remove 12/27/2022
    // var insert_result = await insert_into_db('sequences', sequence_data);
    // var sequence_obj = await db.get('select * from sequences where uuid = ?', sequence_data.uuid);
    // end jmf remove

    sequence_obj.obj_type = 'sequence';

    res.json(sequence_obj);
});

// fetch registered ids associated with devices

// rest api
(async () => {
    // await _db.initialize_db(models);
    const db = await _db.dbPromise;
    _.each(models, (def) => {
        if (def.disable_rest) {
            // do not include this object in the rest api
            // pass
        } else {
            _.each(rest_api.obj_rest_api(def, db), (route_def) => {
                app[route_def.request_method](route_def.endpoint, route_def.handler);
            });
        }
    });

    // any other url
    app.get('*', async (req, res) => {
        res.sendFile(path.join(__dirname + '/public/puppet/error-page.html'));
    });
})();

//// for local dev with app
// var fs = require('fs');
// var https = require('https');
// var privateKey  = fs.readFileSync('../credentials/server.key', 'utf8');
// var certificate = fs.readFileSync('../credentials/server.cert', 'utf8');
// var credentials = {key: privateKey, cert: certificate};
// var httpsServer = https.createServer(credentials, app);
// httpsServer.listen(8443);


// uncomment to run on local server
// const https = require('https');
// //const fs = require('fs');
// const credentials = {
//   key: fs.readFileSync('./localhost-key.pem'),
//   cert: fs.readFileSync('./localhost.pem'),
// };
// const credentials2 = {
//     key: fs.readFileSync('./public/puppet/certs/development.key'),
//     cert: fs.readFileSync('./public/puppet/certs/development.crt'),
//     ca: fs.readFileSync('./public/puppet/certs/development-ca.crt'),
  
// }
// var httpsServer = https.createServer(credentials2, app);
// httpsServer.listen(443);

module.exports = app.listen(port, () => console.log(`listening on port ${port}!`));
