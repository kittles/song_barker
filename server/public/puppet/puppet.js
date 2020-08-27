/* global _, Print, THREE, $, Stats, math */

/*
card TODO
    - play button change to pause while playing (mobile and desktop)
    - cursor pointer on share icons and playback controls and app icon links and badges
    - performance! why does it suck
*/

var fp = _.noConflict(); // lodash fp and lodash at the same time

// so nginx can server static assets
var static_root = '/puppet';

// for turning images into base64 strings, for testing
var image_canvas;
var image_ctx;

// where the render canvas lives in the dom
var container;

// the loading spinner that shows before your first create puppet call
var loading_spinner;

// three js objects
var scene;
var camera;
var renderer;
var render_pixels = 128 * 4; // use a constant canvas resolution and scale it in css as needed

var card = window.greeting_card || undefined;

// for inspecting the scene
var controls;

// the id of the RAF loop if you want to cancel it
var animation_frame;

// some vars for debugging
var debug_face_mesh = false;
var enable_controls = false;

// show threejs stats about fps and mb
var show_fps = false;
var show_rendering_stats = true;
var stats;

// iOS webviews need 20 extra pixels
// so store whether its on ios or not here
var iOS;

// getting the window size is platform and version specific
// store the results of that here
var window_width;
var window_height;
var zoom_factor = 1; // gets set to a real value in init

// TODO handle window resizing

// store the coordinates of the features here
var features = {
    // NOTE coordinate system is [-0.5 to 0.5, -0.5 to 0.5]
    // defaults here work with dog3.jpg
    leftEyePosition:  new THREE.Vector2(-0.126, 0.308),
    rightEyePosition: new THREE.Vector2(0.007, 0.314),
    mouthPosition:    new THREE.Vector2(-0.058, 0.160),
    mouthLeft:        new THREE.Vector2(-0.103, 0.143),
    mouthRight:       new THREE.Vector2(-0.0108, 0.135),
    headTop:          new THREE.Vector2(-0.062, 0.438),
    headBottom:       new THREE.Vector2(-0.056, 0.117),
    headLeft:         new THREE.Vector2(-0.255, 0.301),
    headRight:        new THREE.Vector2(0.151, 0.334),
};

// Segments for the deformation mesh
// NOTE this can be lowered to around 50 for less memory use, but the
// quality seems to drop off a bit
var segments = 200;

// this is the config for the face animation shader
var face_animation_shader = {
    uniforms: {
        resolution:         { type: 'v2', value: new THREE.Vector2() },
        leftEyePosition:    { type: 'v2', value: new THREE.Vector2() },
        rightEyePosition:   { type: 'v2', value: new THREE.Vector2() },

        mouthPosition:      { type: 'v2', value: new THREE.Vector2() },
        mouthLeft:          { type: 'v2', value: new THREE.Vector2() },
        mouthRight:         { type: 'v2', value: new THREE.Vector2() },
        mouthOpen:          { type: 'f', value: 0.0 },

        blinkLeft:          { type: 'f', value: 0.0 },
        blinkRight:         { type: 'f', value: 0.0 },
        aspectRatio:        { type: 'f', value: 1.0 },
        petImage:           { type: 't', value: new THREE.Texture() },
        // Head Sway
        head_displacement:  { type: 'v2', value: new THREE.Vector2() },
        faceEllipse_ST:     { type: 'v4', value: new THREE.Vector4() },
        animationNoise:     { type: 't', value: new THREE.Texture() },
        swayTime:           { type: 'f', value: 0.0 },
        swaySpeed:          { type: 'f', value: 0.1 },
        swayAmplitude:      { type: 'f', value: 0.0 },
        // Eyebrows
        eyebrowLeftOffset:  { type: 'f', value: 0.0 },
        eyebrowRightOffset: { type: 'f', value: 0.0 },
        worldToFaceMatrix:  { type: 'm4', value: new THREE.Matrix4() },
    },
    // shaders get vertex and fragment shaders from server
    // so the files can have syntax highlighting
    vertexShader:   null,
    fragmentShader: null,
};

// this is the config for the mouth animation shader
var mouth_shader = {
    uniforms: {
        resolution:        { type: 'v2', value: new THREE.Vector2() },
        leftEyePosition:   { type: 'v2', value: new THREE.Vector2() },
        rightEyePosition:  { type: 'v2', value: new THREE.Vector2() },

        mouthPosition:     { type: 'v2', value: new THREE.Vector2() },
        mouthLeft:         { type: 'v2', value: new THREE.Vector2() },
        mouthRight:        { type: 'v2', value: new THREE.Vector2() },
        mouthOpen:         { type: 'f', value: 0.0 },
        mouthColor:        { type: 'v3', value: new THREE.Vector3() },

        // Head Sway
        head_displacement: { type: 'v2', value: new THREE.Vector2() },
        faceEllipse_ST:    { type: 'v4', value: new THREE.Vector4() },
        animationNoise:    { type: 't', value: new THREE.Texture() },
        swayTime:          { type: 'f', value: 0.0 },
        swaySpeed:         { type: 'f', value: 0.0 },
        swayAmplitude:     { type: 'f', value: 0.0 }
    },
    // shaders get vertex and fragment shaders from server
    // so the files can have syntax highlighting
    vertexShader:   null,
    fragmentShader: null,
};


// make the threejs objects global, since we only create them once
// and just change them when we make new puppets
var background_mesh;
var face_mesh;
var face_mesh_material;
var mouth_gltf; // this is a "Group"
var mouth_mesh; // this is the mesh that comes from the gltf
var pet_image_texture;
var pet_material;
var animation_noise_texture; // what head sway uses

// some animation defaults
var head_sway_amplitude = 1;
var head_sway_speed = 1;


// just for checking how long the initialization process takes
// set this to performance.now() at the beginning of something you want to
// see durations for
var start_time;
// log messages include time since init
var show_timing = false;

// set to true if you want to see mouse position in three coordinate space
// for setting features etc
var log_mouse_position = false;

var post_init = _.noop // for cards, this gets replaced with a card init function, after general init is done


// wrap output so it can be sent to the app through a javascript channel
function log (msg) {
    // this gets picked up clientside through a "javascript channel"
    // if its in a webview in the app
    if (typeof Print !== 'undefined') {
        msg = '[puppet.js postMessage] ' + msg;
        Print.postMessage(msg);
        if (show_timing) {
            Print.postMessage(`[puppet.js timing] ${performance.now() - start_time}`);
        }
    } else {
        // a hack... the timing message goes with the log that directly preceeds it
        // tovi string compares on some of the logs, so we cant just include the
        // timing in them directly
        console.log('[puppet.js console.log] ' + msg);
        if (show_timing) {
            console.log(`[puppet.js timing] ${((performance.now() - start_time) / 1000).toFixed(2)} seconds`);
        }
    }
}


$('document').ready(() => {
    if (card) {
        card_init();
    } else {
        init();
    }
});

function wide_mode () {
    return (document.body.offsetWidth / document.body.offsetHeight) > 1.56;
}

async function card_init () {


    function vh () {
        return window.innerHeight / 100;
    }


    // iOS webview sizing shim
    // TODO figure out why webviews dimensions come out undersized on ios
    iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    log(`navigator.userAgent: ${navigator.userAgent}`);
    log(`iOS = ${iOS}`);
    if (iOS) {
        window_width = document.body.offsetWidth + 20;
        window_height = document.body.offsetHeight + 20;
    } else {
        window_width = document.body.offsetWidth;
        window_height = document.body.offsetHeight;
    }
    log(`WIDTH INFO:
    window.innerWidth: ${window.innerWidth}
    document.body.offsetWidth: ${document.body.offsetWidth}
    document.body.clientWidth: ${document.body.clientWidth}
    USING:
    window_width: ${window_width}
    window_height: ${window_height}
    `);

    // this just holds the three.js render element
    container = document.getElementById('puppet-container');

    // client is using cropped images that are always square
    // so expect a square viewport as well
    var viewport_aspect = 1;
    zoom_factor = Math.min(window_width, window_height) / render_pixels;

    var image_url =            `https://storage.googleapis.com/song_barker_sequences/${card.image_bucket_fp}`;
    var decoration_image_url = `https://storage.googleapis.com/song_barker_sequences/${card.decoration_image_bucket_fp}`;
    var fts = card.image_coordinates_json;
    features = {
        leftEyePosition: fts.leftEye,
        rightEyePosition: fts.rightEye,
        mouthPosition: fts.mouth,
        mouthLeft: fts.mouthLeft,
        mouthRight: fts.mouthRight,
        headTop: fts.headTop,
        headBottom: fts.headBottom,
        headLeft: fts.headLeft,
        headRight: fts.headRight,
    };
    _.each(features, (v, k) => {
        features[k] = new THREE.Vector2(v[0], v[1]);
    });

    // so theres room for some playback ui
    zoom_factor = zoom_factor * 0.8;

    // this gets called at the end of the init
    //post_init = async () => {
    //    await create_puppet(image_url);
    //    $('#container').css('transform', 'translateY(0px)');
    //    $('.playback-image').css('top', $('#container > canvas').width() * zoom_factor * 0.5);
    //    init_audio();
    //    $('#volume-slider').css('width', $('#container > canvas').width() * zoom_factor * 0.5);
    //    //$('#volume').css('left', ($('#container > canvas').width() * zoom_factor * 0.25) - 50);
    //    setTimeout(() => {
    //        $('#volume').css('opacity', 1);
    //        $('#volume').css('transform', 'translateY(0px)');
    //        $('#controls').css('opacity', 1);
    //        $('#controls').css('transform', 'translateY(0px)');
    //    }, 1000);
    //};
    //}

    await load_shader_files();
    animation_noise_texture = await load_texture('noise_2D.png');
    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer();
    //renderer.autoClear = false;
    scene.background = new THREE.Color(0x2E2E46);
    camera = new THREE.OrthographicCamera(
        -0.5 * viewport_aspect,
        0.5 * viewport_aspect,
        0.5,
        -0.5,
        0.001,
        1000
    );
    camera.position.z = 1;
    pet_material = new THREE.MeshBasicMaterial(); // map: pet_image_texture happens later, when we know what the pet image is
    background_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), pet_material);
    background_mesh.scale.x = 1; // this will get set when we know what the pet image is
    background_mesh.renderOrder = 0;
    face_mesh_material = new THREE.ShaderMaterial({
        uniforms:       face_animation_shader.uniforms,
        vertexShader:   face_animation_shader.vertexShader,
        fragmentShader: face_animation_shader.fragmentShader,
        depthFunc:      debug_face_mesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
        side:           THREE.DoubleSide,
        wireframe:      debug_face_mesh,
    });
    face_mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, segments, segments), face_mesh_material);
    face_mesh.renderOrder = 1;
    mouth_gltf = await load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');
    mouth_mesh = mouth_gltf.scene.children[0].children[0];
    mouth_mesh.material = new THREE.ShaderMaterial({
        uniforms:       mouth_shader.uniforms,
        vertexShader:   mouth_shader.vertexShader,
        fragmentShader: mouth_shader.fragmentShader,
        depthFunc:      THREE.AlwaysDepth,
        side:           THREE.DoubleSide,
        blending:       THREE.CustomBlending,
        blendEquation:  THREE.AddEquation,
        blendSrc:       THREE.SrcAlphaFactor,
        blendDst:       THREE.OneMinusSrcAlphaFactor,
        vertexColors:   true
    });
    mouth_mesh.renderOrder = 2;
    scene.add(background_mesh);
    scene.add(face_mesh);
    scene.add(mouth_gltf.scene); // this adds mouth_mesh because its a child of this
    renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
    container.appendChild(renderer.domElement);
    renderer.setSize(render_pixels, render_pixels);
    //$(renderer.domElement).css('zoom', zoom_factor);

    // set the pet image on the mesh and on the shader
    pet_image_texture = await load_texture(image_url);
    pet_material.map = pet_image_texture;
    face_animation_shader.uniforms.petImage.value = pet_image_texture;

    // TODO which of these is actually necessary
    background_mesh.needsUpdate = true;
    pet_material.needsUpdate = true;
    face_mesh.needsUpdate = true;
    face_mesh_material.needsUpdate = true;

    // TODO weird place for default mouth color
    mouth_color(0.5686274509, 0.39607843137, 0.43137254902);

    // use features to determine locations of stuff
    sync_objects_to_features();
    update_shaders();
    direct_render();
    animate();
    head_sway(head_sway_amplitude, head_sway_speed);

    console.log('card init');

    // jquery handles on dom elements
    var content = $('#content');
    var global_scale_el = $('#content-holder');
    //var global_scale_el = $('body');
    var card_container = $('#card-container');
    var back_pieces = $('.envelope-back-piece');
    var flap = $('#envelope-flap');
    var flap_underside = $('#envelope-flap-underside');
    var desktop_logo = $('#k9-logo-desktop');
    var desktop_controls = $('#desktop-controls');
    var desktop_app_links = $('#desktop-app-links');
    var mobile_logo = $('#k9-logo');
    var decoration_image = $('#decoration-image')
    var mobile_bottom_controls = $('#mobile-bottom-controls');
    var big_button_container = $('#big-button-container');
    var puppet_container = $('#puppet-container');

    var card_opened = false;

    var card_has_frame;
    var frame_aspect_ratio = 656 / 787;

    // decoration images can include a 72 pixel a side frame
    // load the decoration image here to see if its framed or not
    var img_for_dimensions = new Image();
    img_for_dimensions.onload = prep_card_for_display;
    // this will trigger the rest of the init sequence
    img_for_dimensions.src = decoration_image_url;


    function card_width () {
        return card_has_frame ? 512 - 72 : 512;
    }
    function card_height () {
        return 512 * (1 / frame_aspect_ratio);
    }
    // just an alias for width, to avoid saying height: width
    function card_square_side () {
        return card_has_frame ? 512 - 72 : 512;
    }
    function set_card_dimensions () {
        card_container.css({
            width: card_width(),
            height: card_height(),
            top: 0,
            left: 0,
        });
        big_button_container.css({
            width: card_square_side(),
            height: card_square_side(),
            top: 0,
            left: 0,
        });
        puppet_container.css({
            width: card_square_side(),
            height: card_square_side(),
            top: 0,
            left: 0,
        });
        $('#puppet-container > canvas ').css({
            width: card_square_side(),
            height: card_square_side(),
        });
        if (card_has_frame) {
            decoration_image.css({
                width: card_square_side(),
                height: (1 / frame_aspect_ratio) * card_square_side(),
                top: 0,
                left: 0,
            });
        } else {
            decoration_image.css({
                width: 512,
                height: 512,
                top: 0,
                left: 0,
            });
        }
    }

    function get_url_param (name) {
        var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
        if (results==null) {
           return null;
        }
        return decodeURI(results[1]) || 0;
    }


    function prep_card_for_display () {
        // set the recipient name from url param
        var recipient_name = get_url_param('recipient_name') || 'You';
        $('#envelope-flap').text(`To: ${recipient_name}`);


        // this scales the whole assembly up or down depending on
        // viewport
        global_scale_el.css({
            transform: `scale(${page_scale()}`,
        });

        // determine if card has a frame here, since the image has
        // now been loaded and dimensions can be inspected
        if (img_for_dimensions.width === 656) {
            // 512 x 512 image with 72px frame
            console.log('decoration image with frame');
            //decoration_image.css({
            //    top: -72,
            //    left: 20 - 72,
            //});
            // need to shrink the puppet so the overall
            // card size is the same
            card_has_frame = true;
        } else {
            card_has_frame = false;
        }
        decoration_image.attr('src', decoration_image_url);

        // set the dimensions of the actual card assembly
        set_card_dimensions();

        // layout the entire page
        layout_elements();
        $(window).resize(_.debounce(layout_elements, 125, { trailing: true }));

        // handle opening the envelope
        back_pieces.click(open_envelope);
        flap.click(open_envelope);

        // hide mobile replay button on wide mode
        if (wide_mode()) {
            $('#big-play-button-overlay').show();
        } else {
            $('#big-play-button-overlay').show();
            $('#mobile-replay-button').show();
        }

        // queue up the card coming in to view
        setTimeout(() => {
            // card drops in from above, waiting to be opened
            $('#content').fadeIn({queue: false, duration: 300});
            $('#content').css({top: '0px'}); // more performant to have this css transitioned
        }, 200);

    };



    // layout in the js for maxiumum job security
    function layout_elements () {
        // desktop controls
        // w/frame: left -284 top -202
        // w/o: left -306 top -202

        // desktop app links
        // w/frame: left 200 top -135
        // w/o: left 228 top -202


        // this is called whenever the window is resized

        // set the page scale (except for logo)
        global_scale_el.css({
            transform: `scale(${page_scale()}`,
        });

        // move the controls and copy horzontally to account for a frame
        if (card_has_frame) {
            desktop_controls.css({
                left: -284,
                top: -202,
            });
            desktop_app_links.css({
                left: 200,
                top: -135,
            });
            $('#big-play-button-overlay').css({
                left: 157,
            });
            $('#mobile-replay-button').css({
                left: 157,
            });
        } else { // no frame
            desktop_controls.css({
                left: -306,
                top: -210,
            });
            desktop_app_links.css({
                left: 228,
                top: -135,
            });
            $('#big-play-button-overlay').css({
                left: 200,
            });
            $('#mobile-replay-button').css({
                left: 200,
            });
        }

        // if the mode has changed between wide and regular,
        // elements fade out or in
        var fade_duration = 500;

        if (card_opened) {
            if (wide_mode()) {
                //fade_flex(desktop_controls, fade_duration);
                desktop_controls.fadeIn(fade_duration);
                desktop_app_links.fadeIn(fade_duration);
                mobile_bottom_controls.hide();
            } else {
                desktop_controls.hide();
                desktop_app_links.hide();
                mobile_bottom_controls.fadeIn(fade_duration);
            }
            if (!wide_mode()) {
                $('body').css({
                    overflow: 'scroll',
                });
            } else {
                $('body').css({
                    overflow: 'hide',
                });
            }
        }
        if (wide_mode()) {
            desktop_logo.fadeIn(fade_duration);
            mobile_logo.hide();
        } else {
            mobile_logo.fadeIn(fade_duration);
            desktop_logo.hide();
        }
    }

    var card_maximize_scale = 0.8;


    function page_scale () {
        var zoom_width = window.innerWidth / (card_maximize_scale * card_width());
        var zoom_height = window.innerHeight / (card_maximize_scale * card_height());
        console.log('card width', card_width(), 'card height', card_height());
        console.log('zoom width', zoom_width, 'zoom height', zoom_height);
        var zoom = Math.min(zoom_width, zoom_height);
        zoom *= 0.9;
        //var zoom = Math.max(zoom, 1);
        console.log(wide_mode() ? zoom * 1 : zoom);
        return wide_mode() ? zoom * 1 : zoom;
    }

    function open_envelope () {
        card_opened = true;
        setTimeout(layout_elements, 1800);

        // prepare for playback
        // remove the envelope
        // show the full card
        // scale up the card

        init_audio();

        // stop the animation, but retain the translation that was included in it
        $('#content').css({
            animation: 'none',
            transform: `translate(-50% -50%)`,
        });

        // trigger css transform on envelope flap
        $('.envelope-flap-piece').toggleClass('opened');

        // remove clip path on content when its coming out of envelope
        // do in a couple steps (i didnt have luck trying to transition this)
        // this is so the card doesn't extend outside the envelope at any point
        setTimeout(() => {
            $('#card-container').css('clip-path', 'polygon(0 0, 100% 0, 100% 60%, 0 60%)');
        }, 500);
        setTimeout(() => {
            $('#card-container').css('clip-path', 'none');
        }, 650);

        // slide the envelope away, resize the card
        setTimeout(() => {

            //// after flap has flipped up, change z and transition for sliding behind card
            //flap_underside.css({
            //    transition: 'transform 0.8s cubic-bezier(0.63, -0.14, 1, 0.29)',
            //    zIndex: 1,
            //});
            //flap.css({
            //    transition: 'transform 0.8s cubic-bezier(0.63, -0.14, 1, 0.29)',
            //    zIndex: 1,
            //});

            // overwrite css transforms on envelope pieces
            flap_underside.css({
                transition: 'top 1s',
            });
            back_pieces.css({
                transition: 'top 1s',
            });

            setTimeout(() => {
                var y_dist = 600;
                back_pieces.css({top: y_dist});
                flap_underside.css({top: y_dist});

                setTimeout(on_complete, 1000);

                function on_complete () {
                    back_pieces.fadeOut(100);
                    flap_underside.fadeOut(100);
                    flap.fadeOut(100);
                    if (!wide_mode()) {
                        $('body').css({
                            overflow: 'scroll',
                        });
                    } else {
                        $('body').css({
                            overflow: 'hide',
                        });
                    }
                }
            }, 100);
            setTimeout(() => {
                $('#card-container').css({
                    transform: `translateX(-50%) translateY(-45%) scale(${card_maximize_scale})`,
                    //transform: `translateX(-50%) translateY(-45%)`,
                });
            }, 750);
        }, 250);
    }
}


// prepare a threejs scene for puppet creation
// this includes establishing info about the environment
// and creating the actual threejs scene and objects.
// nothing is rendered yet because that depends on
// what image the app wants to use
async function init () {
    start_time = performance.now();
    log('puppet.js initializing');

    stats = new Stats();

    // iOS webview sizing shim
    // TODO figure out why webviews dimensions come out undersized on ios
    iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    log(`navigator.userAgent: ${navigator.userAgent}`);
    log(`iOS = ${iOS}`);
    if (iOS) {
        window_width = document.body.offsetWidth + 20;
        window_height = document.body.offsetHeight + 20;
    } else {
        window_width = document.body.offsetWidth;
        window_height = document.body.offsetHeight;
    }
    log(`WIDTH INFO:
    window.innerWidth: ${window.innerWidth}
    document.body.offsetWidth: ${document.body.offsetWidth}
    document.body.clientWidth: ${document.body.clientWidth}
    USING:
    window_width: ${window_width}
    window_height: ${window_height}
    `);

    // for turning images into b64
    // this is just to help test in a browser
    image_canvas = document.getElementById('image-canvas');
    image_ctx = image_canvas.getContext('2d');

    // this just holds the three.js render element
    container = document.getElementById('container');

    // client is using cropped images that are always square
    // so expect a square viewport as well
    var viewport_aspect = 1;
    zoom_factor = Math.min(window_width, window_height) / render_pixels;

    loading_spinner = document.getElementById('loading-spinner');

    // see fps and memory for debugging
    if (show_fps) {
        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(stats.dom);
        stats.dom.style.left = '120px';
    }

    // shader code lives in its on .hlsl files so they can be more easily
    // syntax highlighted
    // this loads the hlsl files, then populates the shader configs with the
    // shader code
    await load_shader_files();

    // this is an image that has red and green channels for x and y displacement
    // of the head
    animation_noise_texture = await load_texture('noise_2D.png');

    //
    // create the threejs geometry and materials for the scene
    //

    scene = new THREE.Scene();
    renderer = new THREE.WebGLRenderer();
    //renderer.autoClear = false;
    scene.background = new THREE.Color(0x2E2E46);

    // Camera left and right frustrum to make sure the camera size is the same as viewport size
    camera = new THREE.OrthographicCamera(
        -0.5 * viewport_aspect,
        0.5 * viewport_aspect,
        0.5,
        -0.5,
        0.001,
        1000
    );
    camera.position.z = 1;

    // Create the background plane
    // This is just the static pet image on the plane
    // Draw this if we aren't debugging the face mesh
    if (!debug_face_mesh) {
        pet_material = new THREE.MeshBasicMaterial(); // map: pet_image_texture happens later, when we know what the pet image is
        background_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), pet_material);
        background_mesh.scale.x = 1; // this will get set when we know what the pet image is
        background_mesh.renderOrder = 0;
    }

    // create the face mesh
    face_mesh_material = new THREE.ShaderMaterial({
        uniforms:       face_animation_shader.uniforms,
        vertexShader:   face_animation_shader.vertexShader,
        fragmentShader: face_animation_shader.fragmentShader,
        depthFunc:      debug_face_mesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
        side:           THREE.DoubleSide,
        wireframe:      debug_face_mesh,
    });

    // Adds the material to the geometry
    face_mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, segments, segments), face_mesh_material);

    // This object renders on top of the background
    face_mesh.renderOrder = 1;

    // mouth sprite - this is a group in threejs lingo,
    // the actual mouth mesh lives in mouth_mesh, a child of the group
    mouth_gltf = await load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');
    mouth_mesh = mouth_gltf.scene.children[0].children[0];
    mouth_mesh.material = new THREE.ShaderMaterial({
        uniforms:       mouth_shader.uniforms,
        vertexShader:   mouth_shader.vertexShader,
        fragmentShader: mouth_shader.fragmentShader,
        depthFunc:      THREE.AlwaysDepth,
        side:           THREE.DoubleSide,
        blending:       THREE.CustomBlending,
        blendEquation:  THREE.AddEquation,
        blendSrc:       THREE.SrcAlphaFactor,
        blendDst:       THREE.OneMinusSrcAlphaFactor,
        vertexColors:   true
    });
    mouth_mesh.renderOrder = 2;

    // add the meshes and stuff to the scene
    scene.add(background_mesh);
    scene.add(face_mesh);
    scene.add(mouth_gltf.scene); // this adds mouth_mesh because its a child of this

    // prepare for rendering
    renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
    container.appendChild(renderer.domElement);
    renderer.setSize(render_pixels, render_pixels);
    $(renderer.domElement).css('zoom', zoom_factor);
    log(`renderer zoom factor: ${zoom_factor}`);

    if (enable_controls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
    }

    if (log_mouse_position) {
        window.addEventListener('click', (e) => {
            var normalized_x = e.clientX / window.innerWidth;
            var normalized_y = e.clientY / window.innerHeight;
            var worldPos = screen_to_world_position(new THREE.Vector2(normalized_x, normalized_y));
            console.log(`worldPos: ${worldPos.x}, ${worldPos.y}`);
        });
    }

    // dont render anything yet, that should happen when the app
    // actually specifies an image

    // tell client the webview is ready to create a puppet
    log('finished init');
    post_init();

    //// check the dom for a card_id, if so, playback card
    //if (window.greeting_card) {
    //    log('greeting card yall');
    //    greeting_card_init();
    //    $('body').css('background', 'rgb(235,235,235)');
    //    $('#container').css('margin', 20);
    //    $('#container > canvas').css('box-shadow', '0 4px 9px 0 rgba(0,0,0,.25)');
    //}
}


// greeting card prep
async function init_audio () {
    var audio_url;
    var audio_el;
    var buffer_interval;
    var playing = false;
    var playback_btn = $('#play-control');
    var big_btn_container = $('#big-play-button-overlay');
    var big_btn = $('#big-play-button');
    var mobile_replay = $('#mobile-replay-button');
    var replay_btn = $('#replay-control');
    var decoration_img = $('#decoration-image');
    var desktop_volume_slider = $('#desktop-volume-slider');
    var mobile_volume_slider = $('#mobile-volume-slider');
    var desktop_replay = $('#desktop-replay');
    var desktop_play = $('#desktop-play');

    // TODO: update these
    var play_img = '/puppet/k9-icons/play-no-border-white.png';
    var pause_img = '/puppet/k9-icons/pause-no-border-white.png';
    var replay_img = '/puppet/k9-icons/replay-no-border-white.png';

    var control_play_img = '/puppet/k9-icons/play-no-border-white.png';
    var blue_play_img = '/puppet/k9-icons/play-blue.png';
    var control_pause_img = '/puppet/k9-icons/pause-no-border-white.png';
    var control_replay_img = '/puppet/k9-icons/replay-no-border-white.png';
    var control_volume_on_img = '/puppet/k9-icons/volume-on-no-border-white.png';
    var control_volume_off_img = '/puppet/k9-icons/volume-off-no-border-white.png';

    var mobile_play_img = '/puppet/k9-icons/play-blue.png';
    var mobile_pause_img = '/puppet/k9-icons/pause-blue.png';
    var mobile_replay_img = '/puppet/k9-icons/replay-blue.png';
    var mobile_volume_on_img = '/puppet/k9-icons/volume-on-no-border-blue.png';
    var mobile_volume_off_img = '/puppet/k9-icons/volume-off-no-border-blue.png';

    audio_url = `https://storage.googleapis.com/song_barker_sequences/${card.card_audio_bucket_fp}`;
    // TODO handle card audios that are actually sequences, by looking in a different part of the bucket
    $('body').append(`<audio crossorigin="anonymous" src="${audio_url}" type="audio/mp4"></audio>`);
    audio_el = document.querySelector('audio');
    audio_el.addEventListener('ended', handle_audio_end, { once: true });

    // TODO consolidate volume slider logic

    $('#mobile-volume-slider').on('input', () => {
        audio_el.volume = $('#mobile-volume-slider').val() / 100;
        if (audio_el.volume > 0) {
            $('#mobile-volume-icon').attr('src', mobile_volume_on_img);
        } else {
            $('#mobile-volume-icon').attr('src', mobile_volume_off_img);
        }
    });

    $('#desktop-volume-slider').on('input', () => {
        audio_el.volume = $('#desktop-volume-slider').val() / 100;
        if (audio_el.volume > 0) {
            $('#desktop-volume-icon > img').attr('src', control_volume_on_img);
        } else {
            $('#desktop-volume-icon > img').attr('src', control_volume_off_img);
        }
    });

    var last_slider_val = 75;

    $('#desktop-volume-icon').on('click', () => {
        if (desktop_volume_slider.val() > 0) {
            last_slider_val = desktop_volume_slider.val();
            desktop_volume_slider.val(0);
            $('#desktop-volume-icon > img').attr('src', control_volume_off_img);
        } else {
            desktop_volume_slider.val(last_slider_val);
            $('#desktop-volume-icon > img').attr('src', control_volume_on_img);
        }
        audio_el.volume = $('#desktop-volume-slider').val() / 100;
    });

    $('#mobile-volume-icon').on('click', () => {
        if (mobile_volume_slider.val() > 0) {
            last_slider_val = mobile_volume_slider.val();
            mobile_volume_slider.val(0);
            $('#mobile-volume-icon').attr('src', mobile_volume_off_img);
        } else {
            mobile_volume_slider.val(last_slider_val);
            $('#mobile-volume-icon').attr('src', mobile_volume_on_img);
        }
        audio_el.volume = $('#mobile-volume-slider').val() / 100;
    });

    playback_btn.click(handle_click);
    big_btn_container.click(handle_click);
    decoration_img.click(handle_click);
    desktop_play.click(handle_click);


    function card_play () {
        $('img', playback_btn).attr('src', pause_img);
        $('#desktop-play > img').attr('src', control_pause_img);
        play_audio();
        big_btn_container.fadeOut(250);
        if (!wide_mode()) {
            mobile_replay.fadeOut(250);
        }
    }


    function card_pause () {
        $('img', playback_btn).attr('src', play_img);
        $('#desktop-play > img').attr('src', control_play_img);
        pause_audio();
        big_btn_container.fadeIn(250);
        if (!wide_mode()) {
            mobile_replay.fadeIn(250);
        }
    }


    function handle_click () {
        big_btn.attr('src', play_img);
        if (playing) {
            card_pause();
        } else {
            card_play();
        }
    }


    replay_btn.click(handle_replay);
    desktop_replay.click(handle_replay);
    mobile_replay.click(handle_replay);

    function handle_replay () {
        clearInterval(buffer_interval);
        audio_el.currentTime = 0;
        $('img', playback_btn).attr('src', control_pause_img);
        $('img', desktop_play).attr('src', control_pause_img);
        play_audio();
        big_btn_container.fadeOut(250);
        if (!wide_mode()) {
            mobile_replay.fadeOut(250);
        }
    }


    function play_audio () {
        // play the audio and animate
        clearInterval(buffer_interval);
        audio_el.play();
        buffer_interval = setInterval(() => {
            // add the upcoming 250 ms of mouth animations based on current playback
            var start_idx = Math.floor(audio_el.currentTime * 60);
            feature_tickers.mouth.cancel();
            // add a little extra the interval gets delayed
            feature_tickers.mouth.add(card.animation_json.mouth_positions.slice(start_idx, start_idx + 60));
        }, 250);
        playing = true;
    }


    function pause_audio () {
        clearInterval(buffer_interval);
        audio_el.pause();
        feature_tickers.mouth.cancel();
        feature_tickers.mouth.add([0]);
        playing = false;
    }


    function handle_audio_end () {
        clearInterval(buffer_interval);
        big_btn.attr('src', replay_img);
        big_btn_container.fadeIn(500);
        // dont want two replay buttons
        //if (!wide_mode()) {
        //    mobile_replay.fadeIn(500);
        //}
        audio_el.currentTime = 0;
        playing = false;
    }
}


// create a puppet from an image url
// the app will pass a base64 string encoding to this
// TODO make the transition smooth looking
async function create_puppet (img_url) {
    start_time = performance.now();

    await fade_spinner(200, 0);
    stop_all_animations();
    await fade_container(500, 0);

    cancelAnimationFrame(animation_frame);

    img_url = (img_url === undefined ? await to_b64('dog3.jpg') : img_url);

    // need to do this so old three objects can be garbage collected
    if (pet_image_texture) {
        pet_image_texture.dispose();
    }

    // set the pet image on the mesh and on the shader
    pet_image_texture = await load_texture(img_url);
    pet_material.map = pet_image_texture;
    face_animation_shader.uniforms.petImage.value = pet_image_texture;

    // TODO which of these is actually necessary
    background_mesh.needsUpdate = true;
    pet_material.needsUpdate = true;
    face_mesh.needsUpdate = true;
    face_mesh_material.needsUpdate = true;

    // TODO weird place for default mouth color
    mouth_color(0.5686274509, 0.39607843137, 0.43137254902);

    // use features to determine locations of stuff
    sync_objects_to_features();
    update_shaders();
    direct_render();
    animate();
    head_sway(head_sway_amplitude, head_sway_speed);
    fade_spinner(500, 0);
    await $(container).fadeTo(500, 1);
    log('create_puppet finished');
}


//
// keeping the scene in sync when features change
//

function sync_objects_to_features () {
    // this should only get called when pet image texture exists,
    // so it can use it to set scales and ratios
    if (!pet_image_texture) {
        log('WARNING: pet_image_texture is undefined!');
    }

    background_mesh.scale.x = pet_image_texture.image.width / pet_image_texture.image.height;
    face_animation_shader.uniforms.aspectRatio.value = pet_image_texture.image.width / pet_image_texture.image.height;

    // use the eye locations to deduce other feature locations and orientations
    var leftEye = new THREE.Vector2(features.leftEyePosition.x, features.leftEyePosition.y);
    var rightEye = new THREE.Vector2(features.rightEyePosition.x, features.rightEyePosition.y);

    // We need to center this geometry at the face
    var eyeCenter = leftEye.add(rightEye).multiplyScalar(0.5);
    var eyeLine = rightEye.sub(leftEye);
    var mouthPosition = new THREE.Vector2(features.mouthPosition.x, features.mouthPosition.y);

    // Center the face mesh's position on the eyes
    face_mesh.position.x = eyeCenter.x;
    face_mesh.position.y = eyeCenter.y;

    // Center the mouth mesh's position on the eyes
    mouth_mesh.position.x = mouthPosition.x;
    mouth_mesh.position.y = mouthPosition.y;

    // Rotate the mouth mesh the same direction as the eyes, ease a bit with the moutline
    var leftMouth = new THREE.Vector2(features.mouthLeft.x, features.mouthLeft.y);
    var rightMouth = new THREE.Vector2(features.mouthRight.x, features.mouthRight.y);
    var mouthLine = rightMouth.sub(leftMouth);
    var mouthWidth = mouthLine.length();

    // scale the mouth mesh by the distance between eyes
    mouth_mesh.scale.set(mouthWidth, mouthWidth, mouthWidth);

    // Rotate the face and mouth mesh the same direction as the eyes
    var rads = Math.atan(eyeLine.y / eyeLine.x);
    face_mesh.rotation.set(0, 0, 0);
    face_mesh.rotateZ(rads);

    rads = Math.atan(mouthLine.y / mouthLine.x);
    mouth_mesh.rotation.y = -rads;

    // update the head ellipse
    var top = new THREE.Vector2(features.headTop.x, features.headTop.y);
    var bottom = new THREE.Vector2(features.headBottom.x, features.headBottom.y);
    var left = new THREE.Vector2(features.headLeft.x, features.headLeft.y);
    var right = new THREE.Vector2(features.headRight.x, features.headRight.y);
    var ellipseCenter = top.add(bottom).add(left).add(right).divideScalar(4);
    var distanceLeft = ellipseCenter.distanceTo(features.headLeft);
    var distanceRight = ellipseCenter.distanceTo(features.headRight);
    var distanceTop = ellipseCenter.distanceTo(features.headTop);
    var distanceBottom = ellipseCenter.distanceTo(features.headBottom);
    var extentsX = (distanceLeft + distanceRight) * 0.5;
    var extentsY = (distanceTop + distanceBottom) * 0.5;

    // This value is how the big the ellipse is for the head
    var ST_numerator = 0.3;
    var ellipseExtents = new THREE.Vector2(extentsX, extentsY);
    var faceEllipse_ST = new THREE.Vector4(
        ST_numerator / ellipseExtents.x,
        ST_numerator / ellipseExtents.y,
        ellipseCenter.x,
        ellipseCenter.y
    );
    face_animation_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
    mouth_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
}


function update_shaders () {
    face_animation_shader.uniforms.petImage.value = pet_image_texture;
    face_animation_shader.uniforms.animationNoise.value = animation_noise_texture;
    face_animation_shader.uniforms.resolution.value.x = window_width;
    face_animation_shader.uniforms.resolution.value.y = window_height;
    face_animation_shader.uniforms.leftEyePosition.value = features.leftEyePosition;
    face_animation_shader.uniforms.rightEyePosition.value = features.rightEyePosition;
    face_animation_shader.uniforms.mouthPosition.value = features.mouthPosition;
    face_animation_shader.uniforms.mouthLeft.value = features.mouthLeft;
    face_animation_shader.uniforms.mouthRight.value = features.mouthRight;

    mouth_shader.uniforms.animationNoise.value = animation_noise_texture;
    mouth_shader.uniforms.resolution.value.x = window.innerWidth;
    mouth_shader.uniforms.resolution.value.y = window.innerHeight;
    mouth_shader.uniforms.leftEyePosition.value = features.leftEyePosition;
    mouth_shader.uniforms.rightEyePosition.value = features.rightEyePosition;
    mouth_shader.uniforms.mouthPosition.value = features.mouthPosition;
    mouth_shader.uniforms.mouthLeft.value = features.mouthLeft;
    mouth_shader.uniforms.mouthRight.value = features.mouthRight;
}


// use this to set feature locations from the app
function set_position (key, x, y) { // eslint-disable-line no-unused-vars
    // set the feature on the features object
    log(`calling set_position('${key}', ${x}, ${y})`);
    features[key] = new THREE.Vector2(x, y);

    if (key === 'leftEyePosition' || key === 'rightEyePosition') {
        if (features.leftEyePosition.x > features.rightEyePosition.x) {
            log('WARNING: left eye x is greater than right eye x- left and right are from the viewers perspective');
        }
    }

    // sync
    sync_objects_to_features();
    update_shaders();
    direct_render();
}


function blink_left (val) { // eslint-disable-line no-unused-vars
    face_animation_shader.uniforms.blinkLeft.value = val;
    direct_render();
}


function blink_right (val) { // eslint-disable-line no-unused-vars
    face_animation_shader.uniforms.blinkRight.value = val;
    direct_render();
}


function blink (val) { // eslint-disable-line no-unused-vars
    face_animation_shader.uniforms.blinkRight.value = val;
    face_animation_shader.uniforms.blinkLeft.value = val;
    direct_render();
}


function eyebrow_left (val) { // eslint-disable-line no-unused-vars
    face_animation_shader.uniforms.eyebrowLeftOffset.value = val;
    direct_render();
}


function eyebrow_right (val) { // eslint-disable-line no-unused-vars
    face_animation_shader.uniforms.eyebrowRightOffset.value = val;
    direct_render();
}


function mouth_open (val) { // eslint-disable-line no-unused-vars
    mouth_shader.uniforms.mouthOpen.value = val;
    face_animation_shader.uniforms.mouthOpen.value = val;
    direct_render();
}


function mouth_color (fr, fg, fb) {
    mouth_shader.uniforms.mouthColor.value = new THREE.Vector3(fr, fg, fb);
    update_shaders();
    direct_render();
}


function update_head_sway (amplitude, speed) { // eslint-disable-line no-unused-vars
    head_sway_amplitude = amplitude;
    head_sway_speed = speed;
    head_sway(head_sway_amplitude, head_sway_speed);
}


function ramp_on_headsway (over_frames) { // eslint-disable-line no-unused-vars
    var amplitude = face_animation_shader.uniforms.swayAmplitude.value;
    var amplitude_step = 0.1 / over_frames; // amplitude gets divided by 10 in head_sway, so match that here
    var ramp_interval = setInterval(() => {
        amplitude = Math.min(amplitude + amplitude_step, 0.1);
        face_animation_shader.uniforms.swayAmplitude.value = amplitude;
        mouth_shader.uniforms.swayAmplitude.value = amplitude;
        head_sway_amplitude = amplitude * 10; // should match the input to head sway
        if (amplitude >= 0.1) {
            clearInterval(ramp_interval);
        }
    }, 17);
}


function ramp_off_headsway (over_frames) { // eslint-disable-line no-unused-vars
    var amplitude = face_animation_shader.uniforms.swayAmplitude.value;
    var amplitude_step = amplitude / over_frames;
    var ramp_interval = setInterval(() => {
        amplitude = Math.max(amplitude - amplitude_step, 0);
        face_animation_shader.uniforms.swayAmplitude.value = amplitude;
        mouth_shader.uniforms.swayAmplitude.value = amplitude;
        head_sway_amplitude = amplitude * 10; // should match the input to head sway
        if (amplitude <= 0) {
            clearInterval(ramp_interval);
        }
    }, 17);
}

// some prepackaged animations
// amplitude is range of motion
// speed is frames to complete motion
// duration is time until the feature starts to return to original position (in ms)


function left_brow_raise (amplitude, speed, duration) { // eslint-disable-line no-unused-vars
    amplitude = amplitude || 1;
    speed = speed || 15;
    duration = duration || 500;
    left_brow_to_pos(0, amplitude, speed);
    setTimeout(() => {
        left_brow_to_pos(amplitude, 0, speed);
    }, duration);
}


function left_brow_furrow (amplitude, speed, duration) { // eslint-disable-line no-unused-vars
    amplitude = amplitude || 1;
    speed = speed || 15;
    duration = duration || 500;
    left_brow_to_pos(0, -amplitude, speed);
    setTimeout(() => {
        left_brow_to_pos(-amplitude, 0, speed);
    }, duration);
}


function right_brow_raise (amplitude, speed, duration) { // eslint-disable-line no-unused-vars
    amplitude = amplitude || 1;
    speed = speed || 15;
    duration = duration || 500;
    right_brow_to_pos(0, amplitude, speed);
    setTimeout(() => {
        right_brow_to_pos(amplitude, 0, speed);
    }, duration);
}


function right_brow_furrow (amplitude, speed, duration) { // eslint-disable-line no-unused-vars
    amplitude = amplitude || 1;
    speed = speed || 15;
    duration = duration || 500;
    right_brow_to_pos(0, -amplitude, speed);
    setTimeout(() => {
        right_brow_to_pos(-amplitude, 0, speed);
    }, duration);
}


function left_blink_quick () { // eslint-disable-line no-unused-vars
    left_blink_to_pos(0, 1, 4, easings.easeInOutQuad);
    setTimeout(() => {
        left_blink_to_pos(1, 0, 8, easings.easeInOutQuad);
    });
}


function left_blink_slow () { // eslint-disable-line no-unused-vars
    left_blink_to_pos(0, 1, 15, easings.easeInOutQuad);
    setTimeout(() => {
        left_blink_to_pos(1, 0, 25, easings.easeInOutQuad);
    });
}


function right_blink_quick () { // eslint-disable-line no-unused-vars
    right_blink_to_pos(0, 1, 4, easings.easeInOutQuad);
    setTimeout(() => {
        right_blink_to_pos(1, 0, 8, easings.easeInOutQuad);
    });
}


function right_blink_slow () { // eslint-disable-line no-unused-vars
    right_blink_to_pos(0, 1, 15, easings.easeInOutQuad);
    setTimeout(() => {
        right_blink_to_pos(1, 0, 25, easings.easeInOutQuad);
    });
}


var mouth_track_interval;


function mouth_track_sound (amplitudes) { // eslint-disable-line no-unused-vars
    // starts animating when called
    clearInterval(mouth_track_interval);
    feature_tickers.mouth.cancel();
    var start_time = performance.now();
    feature_tickers.mouth.add(amplitudes);

    mouth_track_interval = setInterval(() => {
        // add the upcoming 250 ms of mouth animations based on current playback
        var start_idx = Math.floor(((performance.now() - start_time) / 1000) * 60);
        feature_tickers.mouth.cancel();
        // add a little extra the interval gets delayed
        var to_add = amplitudes.slice(start_idx, start_idx + 60)
        if (to_add.length < 1) {
            clearInterval(mouth_track_interval);
        } else {
            feature_tickers.mouth.add(to_add);
        }
    }, 250);
}


function head_displace (x, y) { // eslint-disable-line no-unused-vars
    face_animation_shader.uniforms.head_displacement.value = new THREE.Vector2(x, y);
    mouth_shader.uniforms.head_displacement.value = new THREE.Vector2(x, y);
    // TODO update mouth_mesh position
    direct_render();
}


// this one happens in the shader, using a noise texture and elapsed time
function head_sway (amplitude, speed) {
    // Amplitude is how far to move the uvs for the animation, Default value of 1 looks good.
    // Speed is a representation how often the animation loops in 1 minute.  Default value of 1 looks good
    // Adjust the input values to make them a bit more intuitive, otherwise you'll need to put in a very small amplitude/speed value
    amplitude /= 10;
    speed /= 60;

    var top = new THREE.Vector2(features.headTop.x, features.headTop.y);
    var bottom = new THREE.Vector2(features.headBottom.x, features.headBottom.y);
    var left = new THREE.Vector2(features.headLeft.x, features.headLeft.y);
    var right = new THREE.Vector2(features.headRight.x, features.headRight.y);
    var ellipseCenter = top.add(bottom).add(left).add(right).divideScalar(4);
    var distanceLeft = ellipseCenter.distanceTo(features.headLeft);
    var distanceRight = ellipseCenter.distanceTo(features.headRight);
    var distanceTop = ellipseCenter.distanceTo(features.headTop);
    var distanceBottom = ellipseCenter.distanceTo(features.headBottom);
    var extentsX = (distanceLeft + distanceRight) * 0.5;
    var extentsY = (distanceTop + distanceBottom) * 0.5;

    // This value is how the big the ellipse is for the head
    var ST_numerator = 0.3;
    var ellipseExtents = new THREE.Vector2(extentsX, extentsY);
    var faceEllipse_ST = new THREE.Vector4(ST_numerator / ellipseExtents.x, ST_numerator / ellipseExtents.y, ellipseCenter.x, ellipseCenter.y);
    face_animation_shader.uniforms.swaySpeed.value = speed;
    face_animation_shader.uniforms.swayAmplitude.value = amplitude;
    face_animation_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;

    mouth_shader.uniforms.swaySpeed.value = speed;
    mouth_shader.uniforms.swayAmplitude.value = amplitude;
    mouth_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
}


// these move smoothly between two positions

function left_brow_to_pos (start, end, n) { // eslint-disable-line no-unused-vars
    feature_tickers.left_brow.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function right_brow_to_pos (start, end, n) { // eslint-disable-line no-unused-vars
    feature_tickers.right_brow.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function left_blink_to_pos (start, end, n) { // eslint-disable-line no-unused-vars
    feature_tickers.left_blink.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function right_blink_to_pos (start, end, n) { // eslint-disable-line no-unused-vars
    feature_tickers.right_blink.add(to_positions(start, end, n, easings.easeInOutQuad));
}


function mouth_to_pos (start, end, n) { // eslint-disable-line no-unused-vars
    feature_tickers.mouth.add(to_positions(start, end, n, easings.easeInOutQuad));
}


// animation framework

// this holds the future positions of features.
// the animation loop with ask each of these for the next
// position for each, should there be one.
// adding motions is done by adding an array of positions
// to one of these features with their .add method
// use like this for custom animations:
// feature_tickers.<feature>.add(to_positions(<start>, <end>, 100, easings.easeInOutQuad))
var feature_tickers = {
    left_blink:  ticker(blink_left),
    right_blink: ticker(blink_right),
    left_brow:   ticker(eyebrow_left),
    right_brow:  ticker(eyebrow_right),
    mouth:       ticker(mouth_open),
};


// this gets called in the raf loop
// it advances all the feature tickers one tick
// and lets the caller know if any features actually moved
// and the scene needs to be rendered
function motion_handler_tick () {
    // check if there is any ticking needed
    var render_needed = false;
    _.each(feature_tickers, (t, key) => {
        if (t.needs_render()) {
            render_needed = true;
        }
    });
    _.invokeMap(feature_tickers, 'tick');
    return render_needed;
}


// you can call this directly when you want to render things
// independent of if they are needed as determined by the motion_handler_tick
function direct_render () {
    renderer.render(scene, camera);
}


var stop_anim_loop = _.noop; // eslint-disable-line no-unused-vars


// this starts the raf loop and manages its state
function animate () {
    if (enable_controls && controls !== undefined) {
        controls.update();
    }
    cancelAnimationFrame(animation_frame);

    var animation_start_time = performance.now();
    function do_animate () {
        var render_start = performance.now();
        if (stats) {
            stats.begin();
        }

        // Tell the shaders how many seconds have elapsed, this is for the headsway animation
        var elapsedMilliseconds = performance.now() - animation_start_time;
        var elapsedSeconds = elapsedMilliseconds / 1000.0;
        face_animation_shader.uniforms.swayTime.value = elapsedSeconds;
        mouth_shader.uniforms.swayTime.value = elapsedSeconds;

        // step a tick in the motion handler
        //if (motion_handler_tick()) {
        //    // only render new frames when needed
        //    direct_render();
        //};

        // gotta render ever time since head will be always swaying
        motion_handler_tick();
        direct_render();

        if (stats) {
            stats.end();
        }
        if (show_rendering_stats) {
            frame_render_times(performance.now() - render_start);
        }
        animation_frame = requestAnimationFrame(do_animate);
    }
    do_animate();
    stop_anim_loop = () => { cancelAnimationFrame(animation_frame); };
}


var _render_times = [];
var keep_n = 60 * 10;
function frame_render_times (time_ms) {
    if (_render_times.length === keep_n) {
        // log summary stats
        //log(`
        //    frame render ms summary (last ${keep_n} frames):
        //        MIN: ${Math.min(..._render_times).toFixed(2)} ms
        //        AVG: ${math.mean(_render_times).toFixed(2)} ms
        //        MAX: ${Math.max(..._render_times).toFixed(2)} ms
        //        STD: ${math.std(_render_times).toFixed(2)}
        //`);
        _render_times = [time_ms];
    } else {
        _render_times.push(time_ms);
    }
}


// stop all current and queued animations, and reset the puppet to default state
function stop_all_animations (stop_head_sway) {
    _.each(feature_tickers, (t, key) => {
        t.cancel();
    });
    // TODO smooth reset the dog to neutral position
    if (stop_head_sway) {
        head_sway(0, 0);
    }
    blink_left(0);
    blink_right(0);
    eyebrow_left(0);
    eyebrow_right(0);
    mouth_open(0);
    clearInterval(mouth_track_interval);
}


// this is a constructor that makes the ticker objects for each
// feature above
function ticker (handler) {
    var ticks = [];
    function next () {
        if (ticks.length > 0) {
            return ticks.shift();
        } else {
            return false;
        }
    }
    function add (xs) {
        ticks = ticks.concat(xs);
    }
    function cancel () {
        ticks = [];
    }
    function needs_render () {
        return ticks.length > 0;
    }
    function tick () {
        var val = next();
        if (val !== false) {
            handler(val);
        }
    }
    return {
        add:          add,
        cancel:       cancel,
        tick:         tick,
        needs_render: needs_render,
    };
}


function unit_linspace (n) {
    // creates evenly spaced 1d array of n points between 0 and 1 inclusive
    return _.map(_.range(n), (x) => { return x / (n - 1); });
}


function to_range (start, end, xs) {
    // convenince fn for affine transforms of unit_linspace arrays
    xs = _.map(xs, fp.multiply(Math.abs(start - end)));
    xs = _.map(xs, fp.add(_.min([start, end])));
    if (end < start) {
        xs = _.reverse(xs);
    }
    return xs;
}


function to_positions (start, end, n, easing) {
    // to generate an eased motion
    var xs = unit_linspace(n);
    xs = _.map(xs, easing);
    xs = to_range(start, end, xs);
    return xs;
}


var easings = {
    linear:         t => t,
    easeInQuad:     t => t * t,
    easeOutQuad:    t => t * (2 - t),
    easeInOutQuad:  t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic:    t => t * t * t,
    easeOutCubic:   t => (--t) * t * t + 1,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeInQuart:    t => t * t * t * t,
    easeOutQuart:   t => 1 - (--t) * t * t * t,
    easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
};


//
// loaders
//


function to_static (url) {
    return _.startsWith(url, static_root) ? url : `${static_root}/${url}`;
}


async function load_mouth_mesh (scene, model_path) {
    // Load the Mouth custom mesh
    // dont make more than one
    if (mouth_gltf) {
        return mouth_gltf;
    } else {
        mouth_gltf = await load_gltf(to_static(model_path));
        return mouth_gltf;
    }
}


async function load_texture (img_src) {
    return new Promise((resolve) => {
        new THREE.TextureLoader().load(img_src, resolve);
    });
}


async function load_image (img_src) {
    return new Promise((resolve) => {
        var i = new Image();
        i.onload = () => resolve(i);
        i.src = to_static(img_src);
    });
}


var gltf_memo = {};
async function load_gltf (model_path) {
    return new Promise((resolve) => {
        if (_.get(gltf_memo, model_path, false)) {
            log(`using cached gltf file: ${to_static(model_path)}`);
            resolve(gltf_memo[model_path]);
        } else {
            var loader = new THREE.GLTFLoader();
            // Load a glTF resource
            loader.load(to_static(model_path), (gltf) => {
                log(`gltf loaded: ${to_static(model_path)}`);
                gltf_memo[model_path] = gltf;
                resolve(gltf);
            }, () => {
                log(`gltf file loading: ${to_static(model_path)}`);
            }, (error) => {
                log(`error loading gltf file: ${to_static(model_path)}`);
                log(error);
            });
        }
    });
}


async function load_hlsl_text (url) {
    var response = await fetch(to_static(url));
    var text = await response.text();
    return text;
}


async function load_shader_files () {
    if (face_animation_shader.fragmentShader == null) {
        face_animation_shader.fragmentShader = await load_hlsl_text('face_fragment_shader.hlsl');
    }
    if (face_animation_shader.vertexShader == null) {
        face_animation_shader.vertexShader = await load_hlsl_text('face_vertex_shader.hlsl');
    }
    if (mouth_shader.fragmentShader == null) {
        mouth_shader.fragmentShader = await load_hlsl_text('mouth_fragment_shader.hlsl');
    }
    if (mouth_shader.vertexShader == null) {
        mouth_shader.vertexShader = await load_hlsl_text('mouth_vertex_shader.hlsl');
    }
    log('finished loaded shader files');
}


async function to_b64 (img_src) {
    var img = await load_image(img_src);
    image_canvas.width = img.width;
    image_canvas.height = img.height;
    image_ctx.drawImage(img, 0, 0);
    return image_canvas.toDataURL();
}


//
// loading animations
//


async function fade_spinner (duration, opacity) {
    return new Promise((resolve) => {
        $(loading_spinner).fadeTo(duration, opacity, resolve);
    });
}


async function fade_container (duration, opacity) {
    return new Promise((resolve) => {
        $(container).fadeTo(duration, opacity, resolve);
    });
}


//
// testing in browser
//


function screen_to_world_position (screen_pos) {
    var cameraSize = new THREE.Vector2(Math.abs(camera.left) + Math.abs(camera.right), -1.0);
    var offset = new THREE.Vector2(camera.left, 0.5);
    var worldPos = screen_pos.multiply(cameraSize);
    return worldPos.add(offset);
}


var feature_map = {
    'dog1.jpg': {
        leftEyePosition:  new THREE.Vector2(-0.094, 0.261),
        rightEyePosition: new THREE.Vector2(0.165, 0.267),
        mouthPosition:    new THREE.Vector2(0.040, -0.089),
        mouthLeft:        new THREE.Vector2(-0.04, -0.1091),
        mouthRight:       new THREE.Vector2(0.134, -0.1060),
        headTop:          new THREE.Vector2(0.027, 0.475),
        headBottom:       new THREE.Vector2(0.042, -0.147),
        headLeft:         new THREE.Vector2(-0.304, 0.232),
        headRight:        new THREE.Vector2(0.394, 0.260),
    },
    'dog2.jpg': {
        leftEyePosition:  new THREE.Vector2(-0.048, 0.217),
        rightEyePosition: new THREE.Vector2(0.091, 0.131),
        mouthPosition:    new THREE.Vector2(-0.109, -0.027),
        mouthLeft:        new THREE.Vector2(-0.171, -0.023),
        mouthRight:       new THREE.Vector2(-0.0601, -0.0666),
        headTop:          new THREE.Vector2(0.131, 0.359),
        headBottom:       new THREE.Vector2(-0.122, -0.087),
        headLeft:         new THREE.Vector2(-0.170, 0.287),
        headRight:        new THREE.Vector2(0.252, 0.072),
    },
    'dog3.jpg': {
        leftEyePosition:  new THREE.Vector2(-0.126, 0.308),
        //leftEyePosition:  new THREE.Vector2(-0.18448098663926, 0.30565552699228793),
        rightEyePosition: new THREE.Vector2(0.007, 0.314),
        //rightEyePosition: new THREE.Vector2(0.06474820143884885, 0.31645244215938306),
        mouthPosition:    new THREE.Vector2(-0.058, 0.171),
        mouthLeft:        new THREE.Vector2(-0.103, 0.143),
        mouthRight:       new THREE.Vector2(-0.0108, 0.135),
        headTop:          new THREE.Vector2(-0.062, 0.438),
        headBottom:       new THREE.Vector2(-0.056, 0.117),
        headLeft:         new THREE.Vector2(-0.255, 0.301),
        headRight:        new THREE.Vector2(0.151, 0.334),
    },
    'dog4.jpg': {
        leftEyePosition:  new THREE.Vector2(-0.196, 0.191),
        rightEyePosition: new THREE.Vector2(0.191, 0.235),
        mouthPosition:    new THREE.Vector2(0.015, -0.242),
        mouthLeft:        new THREE.Vector2(-0.086, -0.348),
        mouthRight:       new THREE.Vector2(0.168, -0.345),
        headTop:          new THREE.Vector2(-0.006, 0.400),
        headBottom:       new THREE.Vector2(0.035, -0.417),
        headLeft:         new THREE.Vector2(-0.282, 0.087),
        headRight:        new THREE.Vector2(0.304, 0.142),
    },
    'chihuahua.png': {
        leftEyePosition:  new THREE.Vector2(-0.20290964777947934, -0.05130168453292494),
        rightEyePosition: new THREE.Vector2(0.13935681470137828, -0.07120980091883611),
        mouthPosition:    new THREE.Vector2(-0.05283307810107196, -0.3131699846860643),
        mouthLeft:        new THREE.Vector2(-0.13935681470137826, -0.31929555895865236),
        mouthRight:       new THREE.Vector2(0.017611026033690635, -0.3208269525267994),
        headTop:          new THREE.Vector2(-0.03062787136294029, 0.2549770290964778),
        headBottom:       new THREE.Vector2(-0.05283307810107196, -0.44869831546707506),
        headLeft:         new THREE.Vector2(-0.3281010719754977, -0.01225114854517606),
        headRight:        new THREE.Vector2(0.2676110260336907, -0.03369065849923425),
    },
    'dog_tilt.jpg': {
        leftEyePosition:  new THREE.Vector2(-0.00041631062825520836, 0.25017178853352867),
        rightEyePosition: new THREE.Vector2(0.18442967732747395, 0.07359710693359374),
        mouthPosition:    new THREE.Vector2(-0.0908203125, -0.026812065972222222),
        mouthLeft:        new THREE.Vector2(-0.16325993855794277, -0.00015928480360243055),
        mouthRight:       new THREE.Vector2(-0.05085362752278652, -0.09760852389865451),
        headTop:          new THREE.Vector2(0.041215667724609356, 0.36011451721191406),
        headBottom:       new THREE.Vector2(-0.03788508097330726, -0.20125976562499998),
        headLeft:         new THREE.Vector2(-0.2235636901855469, 0.16604894002278645),
        headRight:        new THREE.Vector2(0.3, 0.0),
    },
};


var anims = [];


function stop_test_animation () { // eslint-disable-line no-unused-vars
    _.map(anims, clearInterval);
    stop_all_animations();
}


// this will load a dog and animate it like its having a stroke
async function test (img_url) { // eslint-disable-line no-unused-vars
    _.map(anims, clearInterval);
    img_url = (img_url === undefined ? 'dog3.jpg' : img_url);
    await create_puppet(img_url);
    features = feature_map[img_url];
    sync_objects_to_features();
    update_shaders();

    // do some animations
    left_blink_slow();
    right_blink_slow();
    feature_tickers.mouth.add(_.map(_.range(60 * 60), (i) => {
        return (1 + Math.sin(i / 5)) / 2;
    }));
    anims.push(setInterval(left_blink_quick, 500));
    anims.push(setInterval(right_blink_quick, 800));
    anims.push(setInterval(left_brow_furrow, 900));
    anims.push(setInterval(right_brow_furrow, 700));
    head_sway(head_sway_amplitude, head_sway_speed);
}


// use this to load a dog and have it sit still for feature assignment
async function find_features (img_url) { // eslint-disable-line no-unused-vars
    _.map(anims, clearInterval);
    img_url = (img_url === undefined ? 'dog3.jpg' : img_url);
    await create_puppet(img_url);
    head_sway(0, 0);
}
