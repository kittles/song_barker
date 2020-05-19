const {OAuth2Client} = require('google-auth-library');
const CLIENT_ID = '885484185769-05vl2rnlup9a9hdkrs78ao1jvmn1804t.apps.googleusercontent.com'
const client = new OAuth2Client(CLIENT_ID);


async function verify (token) {
  const ticket = await client.verifyIdToken({
      idToken: token.id_token,
      audience: CLIENT_ID,
  });
  const payload = ticket.getPayload();
  console.log(payload);
  return payload;
}
exports.verify = verify;
