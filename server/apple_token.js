const dotenv = require('dotenv').config();
const AppleAuth = require("apple-auth");
const jwt = require("jsonwebtoken");
const request = require('request');


// we pass the user and a callback
function verify (apple_id, callback) {

  k = process.env.KEY_ID;
  b = process.env.BUNDLE_ID;
  t = process.env.TEAM_ID;
  kc = process.env.KEY_CONTENTS;
  console.log("KEY_ID", k);
  console.log("BUNDLE_ID", b);
  console.log("TEAM_ID", t);
  console.log("APPLE_TOKEN", apple_id);

  const auth = new AppleAuth(
    {
      // use the bundle ID as client ID for native apps, else use the service ID for web-auth flows
      // https://forums.developer.apple.com/thread/118135
      client_id:process.env.BUNDLE_ID,
     team_id: process.env.TEAM_ID,
      redirect_uri:
        "https://flutter-sign-in-with-apple-example.glitch.me/callbacks/sign_in_with_apple", // does not matter here, as this is already the callback that verifies the token after the redirection
      key_id: process.env.KEY_ID
    },
    process.env.KEY_CONTENTS.replace(/\|/g, "\n"),
    "text"
  );

  const accessTokenPromise = auth.accessToken(apple_id);
  try {
    console.log("About to call auth");
    accessTokenPromise.then(function(accessToken) {
      console.log("Access token returned from apple: ",accessToken);

      const idToken = jwt.decode(accessToken.id_token);
    
      const userID = idToken.sub;
    
      console.log("Id token:",idToken);
    
      // `userEmail` and `userName` will only be provided for the initial authorization with your app
      const userEmail = idToken.email;
      //const userName = `${request.query.firstName} ${request.query.lastName}`;
    
      // 👷🏻‍♀️ TODO: Use the values provided create a new session for the user in your system
      const sessionID = userID;
    
      console.log('sessionID = ${sessionID}');
    
      try {
        callback({success:true, sessionId:userID, email:userEmail});
      }
      catch(f) {
        console.log("Error in success case: ", f);
      }
    }, function(err) {
        console.log("Promise error path");
        console.log(err)
        callback({success: false, error: err});
      });
    }
    catch(e) {
      console.log("error occurred calling: ", e);
    }

  // const accessTokenPromise = apple_auth.accessToken(apple_id);
  // const accessToken = await accessTokenPromise;
  // console.log(accessToken);
  // return accessToken;
  
}

module.exports = {
    verify
};