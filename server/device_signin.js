var _ = require('lodash');
var _db = require('./database.js');
var insert_into_db = require('./db_insert.js').insert_into_db;

async function insert_device(device_id) {
    try {
        var result = await insert_into_db('devices', {
            'device_id': device_id,
        });
    }
    catch(e) {
        console.log("Exception:", e);
    }
}

async function insert_device_user(device_id, user_id) {
    try {
        console.log("Insert device-user(", device_id, ", ", user_id, ")");
        var result = await insert_into_db('devices_users', {
            'device_id': device_id,
            'user_id':user_id
        });
    }
    catch(e) {
        console.log("Exception:", e);
    }
}

async function user_exists(user_id) {
    var db = await _db.dbPromise;
    var sql = 'SELECT count(*) FROM users WHERE user_id = ?';
    var sequence_row = await db.get(sql, [user_id]);
    var sequence_count = parseInt(sequence_row['count(*)']) || 0;
    console.log("user found?", sequence_count);
    return sequence_count > 0;
}

async function get_user(user_id) {
    reg_user = {
        reg_user_id: "",
        email: "",
    };
    var db = await _db.dbPromise;
    var sql = 'SELECT email, account_type FROM users WHERE user_id = ?';
    var sequence_row = await db.get(sql, [user_id]);
    reg_user.account_type = sequence_row['user_id'];
    reg_user.email = sequence_row['email']; 
    return sequence_row;
}

async function device_exists(device_id) {
    var db = await _db.dbPromise;
    var sql = 'SELECT count(*) FROM devices WHERE device_id = ?';
    var sequence_row = await db.get(sql, [device_id]);
    var sequence_count = parseInt(sequence_row['count(*)']) || 0;
    console.log("device found?", sequence_count);
    return sequence_count > 0;
}

async function device_user_exists(device_id, user_id) {
    var db = await _db.dbPromise;
    var sql = 'SELECT count(*) FROM devices_users WHERE device_id = ? AND user_id = ?';
    var sequence_row = await db.get(sql, [device_id, user_id]);
    var sequence_count = parseInt(sequence_row['count(*)']) || 0;
    console.log("device-user found?", sequence_count);
    return sequence_count > 0;
}

async function get_device(device_id) {
    user = {
        device_id: device_id,
        accepted_terms: -1 
    }
    var db = await _db.dbPromise;
    var sql = 'SELECT * FROM devices WHERE device_id = ?';
    var sequence_row = await db.get(sql, [device_id]);
    user.accepted_terms = sequence_row['accepted_terms']
    return user;
}

async function signin_registered_user(user_id, deviceId) {
    console.log("Entering signin_registered_user");
    if(!await device_user_exists(deviceId, user_id)) {
        insert_device_user(deviceId, user_id);
    }
}

async function signin_device(req, res) {
    console.log("Entering signin_device(", );
    const { deviceId } = req.body;
    const user_id = req.session.user_id;
    var state = {
        logged_in: false,
        user_obj: null,
        reg_obj: null,
        user_id: deviceId,
        new_user:false,
    };
    console.log("DeviceId: ", deviceId);
    console.log("UserId: ", user_id);
    // always set device_id
    req.session.device_id = deviceId;

    if (!_.get(req.session, 'user_id', false)) {
        console.log("signin-device: no session, logging in.");
        req.session.user_id = deviceId;
        state.logged_in = true;
    }
    else {
        state.logged_in = true;
        console.log(user_id, "Already signed in")
    }

    // check if in devices table
    if(!await device_exists(deviceId)) {
        console.log("adding", deviceId, "to devices.");
        insert_device(deviceId);
        state.new_user =  true;
    }
    else {
        console.log("Device:", deviceId, "already exists");
    }

    // check if in users table (registration)
    if(user_id && user_id != deviceId) {
        // must be a registered user, make sure
        if(!await user_exists(user_id)) {
            // something is wrong -- send out alert
            console.error("Signin_device: Unknown user", user_id);
        }
        else if(!await device_user_exists(deviceId, user_id)) {
            insert_device_user(deviceId, user_id);
        }
    }
    

    user = await(get_device(deviceId));
    if(user_id && user_id != deviceId) {
        var reg_user = await(get_user(user_id));
        user.reg_email = reg_user.email;
        user.account_type = reg_user.account_type;
    }
    user.signed_in_as = user_id;
    console.log("user:", user);
    state.user_obj = user;
    return state;

    // try {
    //     console.log("Entering authenticateAppleSignin");
    //     const { token, email, name, apple_id } = req.body;
    //     const registeredUser = { apple_id, name, email };
    //     var loggedInUser = {apple_id, name, email }; //

    //     console.log("authenticateAppleSignin");
    //     console.log("Parameters", token, email, registeredUser);

    // // todo: validate parameters
    //     //res.status(200).send(registeredUser);  
        
    //     // attempt login
    //     console.log("Checking whether user at " + apple_id + " exits.");
    //     var user = await user_sess.get_user(apple_id);

    //     // if(!user) {
    //     //     user = await user_sess.get_user_by_email(email);
    //     // }

    //     if (user) {
    //         // login user
    //         console.log("User exists , logging in.");
    //         user.account_type = "Apple";
    //         if (email && email !== user.email) {

    //             await user_sess.update_email(apple_id, email);
    //             user.email = email;
    //             console.log("updated user's email to ", email);
    //         }
    //         req.session.user_id = apple_id;
    //         req.session.openid_profile = loggedInUser;
    //         req.session.openid_platform = "apple";
    //         console.log("About to return from Apple signin");
    //         return res.json({success: true, error:null, user: user});
    //     }
    //     else {
    //         // register user
    //         console.log("Calling tokenService with token", token);
    //         tokenService.verify(token, (r) => {
    //             if (!r.success) {
    //                 console.log("apple validation failed with error ", r.error);
    //                 res.json(r);
    //             } 
    //             else {
    //                 console.log("apple validation succeeded, starting registration of apple user ");
    //                 console.log("returned from validation:", r);
    //                 user_sess.add_user(r.sessionId, "Canine Friend", r.email);
    //                 req.session.user_id = r.sessionId;
    //                 complete_apple_registration(apple_id, email);
    //                 console.log("apple validation completed");
    //                 req.session.openid_profile = loggedInUser;
    //                 req.session.openid_platform = "apple";
    //                 var user_obj = user_sess.get_user_no_password(apple_id);
    //                 console.log("Returning user object for user: ", apple_id, "\n", user_obj);
    //                 return res.json({success: true, error:null, user: user_obj});
    //             }
    //         });
    //     }
    // }
    // catch (err) {
    //     console.log("Apple signin error: ", err)
    //     return res.json({ success: false, error: err, user: null });
    // }
};

exports.signin_device = signin_device;
exports.signin_registered_user = signin_registered_user;