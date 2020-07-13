const {OAuth2Client} = require('google-auth-library');

const ANDROID_CLIENT_ID = '885484185769-05vl2rnlup9a9hdkrs78ao1jvmn1804t.apps.googleusercontent.com'
const IOS_CLIENT_ID = '885484185769-b78ks9n5vlka0enrl33p6hkmahhg5o7i.apps.googleusercontent.com'

const android_client = new OAuth2Client(ANDROID_CLIENT_ID);
const ios_client = new OAuth2Client(IOS_CLIENT_ID);


async function android_verify (token) {
  const ticket = await android_client.verifyIdToken({
      idToken: token.id_token,
      audience: ANDROID_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return payload;
}
exports.android_verify = android_verify;


async function ios_verify (token) {
  const ticket = await ios_client.verifyIdToken({
      idToken: token.id_token,
      audience: IOS_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return payload;
}
exports.ios_verify = ios_verify;
