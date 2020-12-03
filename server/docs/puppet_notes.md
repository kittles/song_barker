# debugging guide

## initial setup
the app is an express server, so to run the server first install the dependencies with `npm install` from the server directory.
the following npm commands should also be run from the /server directory.
the puppet debug page uses a transpiled javascript file, so in order to see the changes you make to javascript files, youll need
to have the transpiler recompile everything if there is a change. this is handled by running `npm run watch`. NOTE- if you stop
seeing your changes, theres a chance the transpiler is failing on a parse error, so be sure to check the output of that process.
once the transpiler is running, you can start a server with `npm run dev`. make sure port 3000 is unoccupied

## loading a test case
the server runs by default on port 3000, and the debug page can be found at `http://localhost:3000/puppet/puppet-debug.html` when the server is running.
there are a few query parameters you can include in this url to make things a little easier:

    * `debug=true`

which will call the debug init sequence on document.ready, which is a streamlined version of the init sequence. you can modify the `init_debug` function as you see fit.

    * `dog=problem-dog.jpg`

which will automatically call `test()` with the value you assign to dog in the url. 
`problem-dog.jpg` is set up to show the current issue with the mouth. the mouth is at a straight diagonal line instead of curved one.
 fixing the bug means the mouth will contour around the middle mouth position instead of a straight line like it currently. later in this
doc is a bit about comparing to an earlier version that did not have this problem

you can modify the placement of dog features by altering the `feature_map` object near the end of the puppet.js file.
you should still have all (or at least most of, im not sure) the testing functions from before available to you via the javascript console.

## project structure notes
the shaders and gltf reside in the same dir (or some subdir) of the /server/public/puppet. puppet.js is the primary file which makes use of those, and is responsible for
running the show both on the web and in the webview. the output of the transpiler is in /server/public/build.

## comparison to old version
there was an old version of the puppet that didnt have this problem. ive added the problem dog example to it, and made a branch called `compare-old-mouth`. to check that,
you would check out that branch, run the server with `npm run dev` (you dont need watch in this case as it wasnt being transpiled back then) and then go to `http://localhost:3000/puppet_002/puppet.html`,
open the console, and call `test('problem-dog.jpg')`
