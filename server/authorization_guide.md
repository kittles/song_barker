# authorization guide


## overview
the server uses sessions. a user is "logged in" if `session.user_id` attribute is set on their session, and there is an entry for that user in the db.
you can check this with a get request to `/is-logged-in`.
to log in, the client will, by some means, get an openid token and post it to the server's endpoint at `/openid-token`.
the server sends this token to a 3rd party server, and uses the information that comes back (assuming its valid) to try to retrieve the user object
from the database.
if there isn't a user object already, the server creates one.
it then sets `session.user_id` to the user_id in the database object.


## client session cookie
the client should expect a `Set-Cookie` header coming backing from the server, to establish a session cookie.
the cookie will look something like
```
connect.sid=s%3AVU376MxSd_Ayt3imNndlY4lZGX8SwCMK.iS77jRVANlhvdLR8t6ns50k0Sfk%2BS4KDouAaS2mHV8s; Path=/; Expires=Thu, 18 Jun 2020 19:19:38 GMT; HttpOnly
```
the .sid variable is the session id that the server uses to pull up the session on the server side.
the client needs to make sure that requests to the server include a `Cookie` header with `connect.sid=s%3AVU376MxSd_Ayt3imNndlY4lZGX8SwCMK.iS77jRVANlhvdLR8t6ns50k0Sfk%2BS4KDouAaS2mHV8s` as the value,
to use the current example.
to summarize- the server sends a cookie with a session id, and the client needs to hold on to that and include it in all subsequent requests to the server as a cookie.
the client never has access to the session, just the session id.

i dont know which dart libraries are good for handling cookies, but i would expect there are some http request libraries that should handle setting cookies automatically. either way, its good
to know whats going on.


## client log in
the first time a user uses the app, they wont be logged in. the client needs to use an oauth2 library to make a requests to a 3rd party server for a token.
here is what i used to do the client->3rd party->client->server auth flow:
```dart
import 'package:openid_client/openid_client_io.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;

authenticate (String clientId, List<String> scopes) async {
    // create the client
    var issuer = await Issuer.discover(Issuer.google);
    var client = new Client(issuer, clientId);

    // create a function to open a browser with an url
    urlLauncher(String url) async {
        if (await canLaunch(url)) {
          await launch(url, forceWebView: false);
        } else {
          throw 'Could not launch $url';
        }
    }

    // create an authenticator
    var authenticator = new Authenticator(
        client,
        scopes: scopes,
        port: 4000,
        urlLancher: urlLauncher
    );

    // starts the authentication
    var c = await authenticator.authorize();

    // close the webview when finished
    closeWebView();

    // return token for server
    return await c.getTokenResponse();

}
```
the function above can be used like below:
```dart
    // inside some auth flow function

    var client_id = '<platform specific client id>';
    var token = await authenticate(client_id, ['email', 'openid', 'profile']);

    var response = await http.post(
        '<server ip>/openid-token',
        body: json.encode(token),
        headers: {
            'Content-type': 'application/json',
            'Accept': 'application/json',
        }
    );
```

`client_id` is the id oauth2 credential that comes from a 3rd party when i set this up. it will depend on which
third party (google, facebook, etc) is used. currently, there are just two, both for google:

* ios_client_id: `885484185769-b78ks9n5vlka0enrl33p6hkmahhg5o7i.apps.googleusercontent.com`
* android_client_id: `885484185769-05vl2rnlup9a9hdkrs78ao1jvmn1804t.apps.googleusercontent.com`

the `authenticate` function accepts an array of scopes as well. id just pass the three in the example above.
when called, `authenticate` will open a browser (webviews are apparently deprecated for doing oauth now) where the user
can choose their google account and accept the request for information. assuming they do so, `authenticate` will
return a token which can then be sent to the server in a post request like the example above. a 200 from the endpoint `/openid-token`
means that the user is now logged in, and, if necessary, their user object has been created in the database.

i used the [openid_client](https://pub.dev/packages/openid_client) library in the above example


## rest api
the rest api no longer expects user_id's in the url- any time a user_id is needed it comes from the session.
any resources that are user_owned require a valid user_id to query. permissions are also determined by user_id-
a request to modify or get some resource that is owned by a different user than the one on session.user_id is rejected.


## audio api's
`/to_crops` and `/to_sequence` no longer expect a user_id in the body. it will be inferred from the session. requests
that try to use resources not owned by the session.user_id will be rejected.


## recommended flow
just off the dome, id guess a good way of handling auth would be the following:
* on app startup, check `/is-logged-in`, which will establish a session, and tell you if you need to do the oauth flow
* if logged in, you are good, and nothing needs to be done- just include the session cookie in all requests
* if you arent logged in- follow the steps in the client login section above

NOTE it may be helpful to log out for testing- a get request to `/logout` will log the user out (unset the user_id on the session)
