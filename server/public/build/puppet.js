"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

/* global _, Print, THREE, $, Stats, math */

/*
card TODO
    - play button change to pause while playing (mobile and desktop)
    - cursor pointer on share icons and playback controls and app icon links and badges
    - performance! why does it suck
*/
var fp = _.noConflict(); // lodash fp and lodash at the same time
// so nginx can server static assets


var static_root = '/puppet'; // for turning images into base64 strings, for testing

var image_canvas;
var image_ctx; // where the render canvas lives in the dom

var container; // the loading spinner that shows before your first create puppet call

var loading_spinner; // three js objects

var scene;
var camera;
var renderer;
var render_pixels = 128 * 4; // use a constant canvas resolution and scale it in css as needed

var card = window.greeting_card || undefined; // for inspecting the scene

var controls; // the id of the RAF loop if you want to cancel it

var animation_frame; // some vars for debugging

var debug_face_mesh = false;
var enable_controls = false; // show threejs stats about fps and mb

var show_fps = false;
var show_rendering_stats = true;
var stats; // iOS webviews need 20 extra pixels
// so store whether its on ios or not here

var iOS; // getting the window size is platform and version specific
// store the results of that here

var window_width;
var window_height;
var zoom_factor = 1; // gets set to a real value in init
// TODO handle window resizing
// store the coordinates of the features here

var features = {
  // NOTE coordinate system is [-0.5 to 0.5, -0.5 to 0.5]
  // defaults here work with dog3.jpg
  leftEyePosition: new THREE.Vector2(-0.126, 0.308),
  rightEyePosition: new THREE.Vector2(0.007, 0.314),
  mouthPosition: new THREE.Vector2(-0.058, 0.160),
  mouthLeft: new THREE.Vector2(-0.103, 0.143),
  mouthRight: new THREE.Vector2(-0.0108, 0.135),
  headTop: new THREE.Vector2(-0.062, 0.438),
  headBottom: new THREE.Vector2(-0.056, 0.117),
  headLeft: new THREE.Vector2(-0.255, 0.301),
  headRight: new THREE.Vector2(0.151, 0.334)
}; // Segments for the deformation mesh
// NOTE this can be lowered to around 50 for less memory use, but the
// quality seems to drop off a bit

var segments = 200; // this is the config for the face animation shader

var face_animation_shader = {
  uniforms: {
    resolution: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    leftEyePosition: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    rightEyePosition: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthPosition: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthLeft: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthRight: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthOpen: {
      type: 'f',
      value: 0.0
    },
    blinkLeft: {
      type: 'f',
      value: 0.0
    },
    blinkRight: {
      type: 'f',
      value: 0.0
    },
    aspectRatio: {
      type: 'f',
      value: 1.0
    },
    petImage: {
      type: 't',
      value: new THREE.Texture()
    },
    // Head Sway
    head_displacement: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    faceEllipse_ST: {
      type: 'v4',
      value: new THREE.Vector4()
    },
    animationNoise: {
      type: 't',
      value: new THREE.Texture()
    },
    swayTime: {
      type: 'f',
      value: 0.0
    },
    swaySpeed: {
      type: 'f',
      value: 0.1
    },
    swayAmplitude: {
      type: 'f',
      value: 0.0
    },
    // Eyebrows
    eyebrowLeftOffset: {
      type: 'f',
      value: 0.0
    },
    eyebrowRightOffset: {
      type: 'f',
      value: 0.0
    },
    worldToFaceMatrix: {
      type: 'm4',
      value: new THREE.Matrix4()
    }
  },
  // shaders get vertex and fragment shaders from server
  // so the files can have syntax highlighting
  vertexShader: null,
  fragmentShader: null
}; // this is the config for the mouth animation shader

var mouth_shader = {
  uniforms: {
    resolution: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    leftEyePosition: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    rightEyePosition: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthPosition: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthLeft: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthRight: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    mouthOpen: {
      type: 'f',
      value: 0.0
    },
    mouthColor: {
      type: 'v3',
      value: new THREE.Vector3()
    },
    // asis addition
    lipsColor: {
      type: 'v3',
      value: new THREE.Vector3()
    },
    lipsThickness: {
      type: 'f',
      value: 0.0
    },
    // Head Sway
    head_displacement: {
      type: 'v2',
      value: new THREE.Vector2()
    },
    faceEllipse_ST: {
      type: 'v4',
      value: new THREE.Vector4()
    },
    animationNoise: {
      type: 't',
      value: new THREE.Texture()
    },
    swayTime: {
      type: 'f',
      value: 0.0
    },
    swaySpeed: {
      type: 'f',
      value: 0.0
    },
    swayAmplitude: {
      type: 'f',
      value: 0.0
    }
  },
  // shaders get vertex and fragment shaders from server
  // so the files can have syntax highlighting
  vertexShader: null,
  fragmentShader: null
}; // make the threejs objects global, since we only create them once
// and just change them when we make new puppets

var background_mesh;
var face_mesh;
var face_mesh_material;
var mouth_gltf; // this is a "Group"

var mouth_mesh; // this is the mesh that comes from the gltf

var pet_image_texture;
var pet_material;
var animation_noise_texture; // what head sway uses

var noise_url = '/puppet/noise_2D.png'; // some animation defaults

var head_sway_amplitude = 1;
var head_sway_speed = 1; // just for checking how long the initialization process takes
// set this to performance.now() at the beginning of something you want to
// see durations for

var start_time; // log messages include time since init

var show_timing = false; // set to true if you want to see mouse position in three coordinate space
// for setting features etc

var log_mouse_position = false;
var post_init = _.noop; // for cards, this gets replaced with a card init function, after general init is done
// wrap output so it can be sent to the app through a javascript channel

function log(msg) {
  // this gets picked up clientside through a "javascript channel"
  // if its in a webview in the app
  if (typeof Print !== 'undefined') {
    msg = '[puppet.js postMessage] ' + msg;
    Print.postMessage(msg);

    if (show_timing) {
      Print.postMessage("[puppet.js timing] ".concat(performance.now() - start_time));
    }
  } else {
    // a hack... the timing message goes with the log that directly preceeds it
    // tovi string compares on some of the logs, so we cant just include the
    // timing in them directly
    console.log('[puppet.js console.log] ' + msg);

    if (show_timing) {
      console.log("[puppet.js timing] ".concat(((performance.now() - start_time) / 1000).toFixed(2), " seconds"));
    }
  }
}

function get_url_param(name) {
  var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);

  if (results == null) {
    return null;
  }

  return decodeURI(results[1]) || 0;
}

$('document').ready(function () {
  if (card) {
    prepare_card(); //if (card.has_envelope) {
    //    prepare_card();
    //} else {
    //    prepare_card_no_envelope();
    //}
  } else {
    if (get_url_param('debug')) {
      init_debug();
    } else {
      init();
    }
  }
});

function prepare_card() {
  return _prepare_card.apply(this, arguments);
} // prepare a threejs scene for puppet creation
// this includes establishing info about the environment
// and creating the actual threejs scene and objects.
// nothing is rendered yet because that depends on
// what image the app wants to use


function _prepare_card() {
  _prepare_card = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
    var recipient_name, switch_class, envelope_top, envelope_middle, envelope_below, envelope_tilt_right, envelope_tilt_left, envelope_no_tilt, is_jiggling, envelope_jiggle, jiggle_interval, cancel_jiggle, wide_mode, flap_open_ms, envelope_move_ms, message_zoom_ms, ready_to_display, open_flap, message_width, message_height, zoom_message, _zoom_message, present_envelope, skip_envelope, img_for_dimensions, card_has_frame, decoration_image_url, check_decoration_image, _check_decoration_image, create_decoration_image, create_overlay_buttons, _create_overlay_buttons, overlay_two_buttons, overlay_one_button, overlay_right_button, ui_to_show, ui_to_hide, handle_mode, display_ui, prepare_audio, prepare_puppet, _prepare_puppet;

    return regeneratorRuntime.wrap(function _callee9$(_context9) {
      while (1) {
        switch (_context9.prev = _context9.next) {
          case 0:
            _prepare_puppet = function _prepare_puppet3() {
              _prepare_puppet = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8() {
                return regeneratorRuntime.wrap(function _callee8$(_context8) {
                  while (1) {
                    switch (_context8.prev = _context8.next) {
                      case 0:
                        return _context8.abrupt("return", new Promise( /*#__PURE__*/function () {
                          var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(r) {
                            var viewport_aspect, image_url, fts, frame_margin, random_gesture;
                            return regeneratorRuntime.wrap(function _callee7$(_context7) {
                              while (1) {
                                switch (_context7.prev = _context7.next) {
                                  case 0:
                                    random_gesture = function _random_gesture() {
                                      var blinks = [[left_blink_quick, right_blink_quick], [left_blink_medium, right_blink_medium]];

                                      function random_blink() {
                                        var fns = Math.random() > 0.5 ? blinks[0] : blinks[1];

                                        if (!document.hidden) {
                                          _.each(fns, function (f) {
                                            f();
                                          });
                                        }

                                        setTimeout(random_blink, Math.random() * 6000);
                                      }

                                      random_blink();
                                      var brows = [[left_brow_furrow, right_brow_furrow], [left_brow_raise, right_brow_raise]];

                                      function random_brow() {
                                        var fns = Math.random() > 0.5 ? brows[0] : brows[1];
                                        var amplitude = 0.7 * (0.25 + Math.random() / 4);
                                        var speed = Math.max(Math.floor(Math.random() * 25), 10);
                                        var duration = 250 + Math.random() * 500;

                                        if (!document.hidden) {
                                          _.each(fns, function (f) {
                                            f(amplitude, speed, duration);
                                          });
                                        }

                                        setTimeout(random_brow, duration + Math.random() * 6000);
                                      }

                                      random_brow();
                                    };

                                    viewport_aspect = 1;
                                    image_url = "https://storage.googleapis.com/".concat(card.bucket_name, "/").concat(card.image_bucket_fp);
                                    fts = card.image_coordinates_json;
                                    features = {
                                      leftEyePosition: fts.leftEye,
                                      rightEyePosition: fts.rightEye,
                                      mouthPosition: fts.mouth,
                                      mouthLeft: fts.mouthLeft,
                                      mouthRight: fts.mouthRight,
                                      headTop: fts.headTop,
                                      headBottom: fts.headBottom,
                                      headLeft: fts.headLeft,
                                      headRight: fts.headRight
                                    };

                                    _.each(features, function (v, k) {
                                      features[k] = new THREE.Vector2(v[0], v[1]);
                                    });

                                    _context7.next = 8;
                                    return load_shader_files();

                                  case 8:
                                    _context7.next = 10;
                                    return load_texture(noise_url);

                                  case 10:
                                    animation_noise_texture = _context7.sent;
                                    scene = new THREE.Scene();
                                    renderer = new THREE.WebGLRenderer(); //renderer.autoClear = false;

                                    scene.background = new THREE.Color(0x2E2E46);
                                    camera = new THREE.OrthographicCamera(-0.5 * viewport_aspect, 0.5 * viewport_aspect, 0.5, -0.5, 0.001, 1000);
                                    camera.position.z = 1;
                                    pet_material = new THREE.MeshBasicMaterial(); // map: pet_image_texture happens later, when we know what the pet image is

                                    background_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), pet_material);
                                    background_mesh.scale.x = 1; // this will get set when we know what the pet image is

                                    background_mesh.renderOrder = 0;
                                    face_mesh_material = new THREE.ShaderMaterial({
                                      uniforms: face_animation_shader.uniforms,
                                      vertexShader: face_animation_shader.vertexShader,
                                      fragmentShader: face_animation_shader.fragmentShader,
                                      depthFunc: debug_face_mesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
                                      side: THREE.DoubleSide,
                                      wireframe: debug_face_mesh
                                    });
                                    face_mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, segments, segments), face_mesh_material);
                                    face_mesh.renderOrder = 1;
                                    _context7.next = 25;
                                    return load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');

                                  case 25:
                                    mouth_gltf = _context7.sent;
                                    mouth_mesh = mouth_gltf.scene.children[0].children[0];
                                    mouth_mesh.material = new THREE.ShaderMaterial({
                                      uniforms: mouth_shader.uniforms,
                                      vertexShader: mouth_shader.vertexShader,
                                      fragmentShader: mouth_shader.fragmentShader,
                                      depthFunc: THREE.AlwaysDepth,
                                      side: THREE.DoubleSide,
                                      blending: THREE.CustomBlending,
                                      blendEquation: THREE.AddEquation,
                                      blendSrc: THREE.SrcAlphaFactor,
                                      blendDst: THREE.OneMinusSrcAlphaFactor,
                                      vertexColors: true
                                    });
                                    mouth_mesh.renderOrder = 2;
                                    scene.add(background_mesh);
                                    scene.add(face_mesh);
                                    scene.add(mouth_gltf.scene); // this adds mouth_mesh because its a child of this

                                    renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
                                    $('#message').append(renderer.domElement);
                                    renderer.setSize(render_pixels, render_pixels); // if the card has a frame, it needs to be 72 * 2 smaller
                                    // in width and height

                                    frame_margin = 72;

                                    if (card_has_frame()) {
                                      // card_has_frame is determined in the create_decoration_image fn
                                      console.log('has frame');
                                      $(renderer.domElement).css({
                                        width: message_width - frame_margin * 2,
                                        height: message_width - frame_margin * 2,
                                        left: 72,
                                        top: 72,
                                        position: 'absolute',
                                        zIndex: 1
                                      });
                                    } else {
                                      $(renderer.domElement).css({
                                        width: message_width,
                                        height: message_width,
                                        // always a square
                                        zIndex: 1
                                      });
                                    } // set the pet image on the mesh and on the shader


                                    _context7.next = 39;
                                    return load_texture(image_url);

                                  case 39:
                                    pet_image_texture = _context7.sent;
                                    pet_material.map = pet_image_texture;
                                    face_animation_shader.uniforms.petImage.value = pet_image_texture; // TODO which of these is actually necessary

                                    background_mesh.needsUpdate = true;
                                    pet_material.needsUpdate = true;
                                    face_mesh.needsUpdate = true;
                                    face_mesh_material.needsUpdate = true;

                                    if (card.mouth_color) {
                                      mouth_color.apply(void 0, _toConsumableArray(JSON.parse(card.mouth_color)));
                                    } else {
                                      mouth_color(0.5686274509, 0.39607843137, 0.43137254902);
                                    } // use features to determine locations of stuff


                                    sync_objects_to_features(); // asis lips addition

                                    if (card.lip_color) {
                                      lips_color.apply(void 0, _toConsumableArray(JSON.parse(card.lip_color)));
                                    } else {
                                      lips_color(0.1, 0.1, 0.1);
                                    }

                                    if (card.lip_thickness) {
                                      lips_thickness(parseFloat(card.lip_thickness));
                                    } else {
                                      lips_thickness(0.1);
                                    } //


                                    update_shaders();
                                    direct_render();
                                    animate();
                                    head_sway(head_sway_amplitude, head_sway_speed);
                                    random_gesture();
                                    r();

                                  case 56:
                                  case "end":
                                    return _context7.stop();
                                }
                              }
                            }, _callee7);
                          }));

                          return function (_x16) {
                            return _ref4.apply(this, arguments);
                          };
                        }()));

                      case 1:
                      case "end":
                        return _context8.stop();
                    }
                  }
                }, _callee8);
              }));
              return _prepare_puppet.apply(this, arguments);
            };

            prepare_puppet = function _prepare_puppet2() {
              return _prepare_puppet.apply(this, arguments);
            };

            prepare_audio = function _prepare_audio() {
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
              var overlay_background = $('#overlay-background'); // TODO: update these
              //var play_img = '/puppet/k9-icons/play-no-border-white.png';

              var play_img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAC6XpUWHRSYXcgcHJvZmlsZSB0eXBlIGV4aWYAAHja7ZdbktwgDEX/WUWWgCSExHIwmKrsIMvPBT+me2byquQnVW3KQAtZiHsw3R32b19H+IKLSuaQ1DyXnCOuVFLhio7H4yqrpphWva52jdGzPdwDDJOgleOj1dO/wq5vD9xxtmd78HOE/Qx0DlwBZc7M6PTHJGHnw07pDFT2o5OL22OqG59LOR1XKucttkLfQebn8GhIBpW6wkuYdyGJq/YjAznuittRsxj8CG0VlRTQkFxLgiBPy7vaGB8FehL56oX36t+9d+JzPe3yTst8aoTOpwOkn4u/JH6YWO6M+HnA5Ar1UeQxuo+xH6urKUPRfO6oGC515jNw3CC5rMcyiuFW9G2VguKxxgY4Pba4oTQqxKAyAiXqVGnQvtpGDSkm3hlMmLmxLJuDUeEmk1OahQabFOkgyNJ4DyIw850LrXnLmq+RY+ZOcGVCsIn6hyX8bPBPShijTYko+q0V8uK5c5HGJDdreAEIjZObLoGvcuKPD/sHWxUEdcnsWGCN2xFiU3rbW7I4C/wU7fFWULB+BoBEmFuRDAkIxEyilCkasxFBRwegisxZEm8gQKrckSQnEZxHxs5zbjxjtHxZOfM042wCCJUsBjZFKmClpNg/lhx7qKpoUtWsph60aM2SU9acs+V5yFUTS6aWzcytWHXx5OrZzd2L18JFcAZqycWKl1Jq5VAxUUWsCv8Ky8abbGnTLW+2+Va22rB9WmracrPmrbTauUvHMdFzt+699LpT2HFS7GnXPe+2+172OrDXhow0dORhw0cZ9aZ2Uv1Q/oAandR4kZp+dlODNZhdIWgeJzqZgRgnAnGbBLCheTKLTinxJDeZxcJ4KZSRpE42odMkBoRpJ9ZBN7s3cr/FLaj/Fjf+Fbkw0f0LcgHoPnL7hFqf33NtETvewqlpFLx98KnsAXeMqP62fQV6BXoFegV6BXoFegX6/wPJwI8H/IkN3wFptp3A/1Bd9QAAAYVpQ0NQSUNDIHByb2ZpbGUAAHicfZE9SMNAHMVfU7VFKg528GvIUJ2siIo4ahWKUCHUCq06mFz6ITRpSFJcHAXXgoMfi1UHF2ddHVwFQfADxMnRSdFFSvxfWmgR48FxP97de9y9A4RqkWlW2xig6baZjMfEdGZFDLwiiAF0oA+jMrOMWUlKwHN83cPH17soz/I+9+foUrMWA3wi8QwzTJt4nXhq0zY47xOHWUFWic+JR0y6IPEj15U6v3HOuyzwzLCZSs4Rh4nFfAsrLcwKpkY8SRxRNZ3yhXSdVc5bnLVimTXuyV8YyurLS1ynOYg4FrAICSIUlLGBImxEadVJsZCk/ZiHv9/1S+RSyLUBRo55lKBBdv3gf/C7Wys3MV5PCsWA9hfH+RgCArtAreI438eOUzsB/M/Ald70l6rA9CfplaYWOQK6t4GL66am7AGXO0DvkyGbsiv5aQq5HPB+Rt+UAXpugc7Vem+NfZw+ACnqKnEDHBwCw3nKXvN4d7C1t3/PNPr7AYH7cq12dKcRAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5AgbEzYOhq3JMAAABNNJREFUeNrt3U2oZnUdwPHvTSXfEJFUCMSBwsTkLgyGNMVgNi5yUYuCkijIRYiavWCFCmGJkGGCuNCsiIRaKJSVSRIJJr5gbxaaE9kisTEEX2HGysfF/8TJO2eiGYXk3s9nd3nm2fzu/c7/nP95znnWVqtVwLI3GQEIBAQCAgGBgEBAICAQEAgIBBAICAQEAgIBgYBAQCAgEBAICAQQCAgEBAICAYGAQEAgIBAQCCAQEAgIBAQCAgGBgEBAICAQEAggEBAICAQEAgIBgYBAQCAgEEAgIBAQCAgEBAICAYGAQEAgIBBAICAQEAgIBAQCb1QHG8HrYq06sTq0+ku120isINQh1aXVE9Xj1SPVM9Ut1duMZxP8z7darUzhwBxW/aR67z5e31NdW32lesG4rCBbzVf/SxxVb64+X/2xOs+4rCBbyXHTYdX+nMPdW11Y/cr4rCCb3Znt/wbHGdWD1U3VsUYokM3sLa9h3p+oHqsuzi6iQMxt0dHV16vfVjuMUyAsO6W6q7qt2mYcAmHZ+xvXUK6sDjcOgbC3Q6vLqkerDxmHQFh2QvW96hfVunEIhGVnN66Z3FAdYxwCYW8HVZ+sdlYXTD8jEDY4prp+WlHONg6BsGx9Ojf5/nSugkBY8MHGbtcVjd0vBMIGh1dfalw/+YBxCIRl26pbG1fk32kcAmHZjuo31XWNz3ohEDY4uLqo8Wnh8/1+BcKyY6sbG/efnGEcAmHZadUvq+9WbzUOgbDsI41747/QuFcegbDBkdVV1e+rc41DICx7e/XD6o7qHcYhEJadUz1cXVMdZRwCYW+HVJ9pbAt/vPEIVQTCBsdX36zuq7Ybh0BYtn2K5FtTNAIxAjZYqz42HXZ9djoMEwhscFTj+cO/q94lEFh2cnV346q8QGDBEdN5yZpAYNl6dbpAYN9OEwj4exEIB+QPAoFljzceOSQQ2OCfjS/++ZdA4NV2Ve+rfu6kC2b/qL5WnVTduVWH4DvyWHJHdUnjNt0tTSD8pz9NYfzIKBxiMXu+urTxZEZxWEGYrKrvNJ528qRxCITZA42nMN5vFA6xmP2tcf/5u8VhBWH2UuPB1ldO5xwIhMmPG7tTO41CIMweqz7VuK6BcxAmz1Wfq04VhxWE2ar6dmPbdpdxCITZfY1t2weNwiEWsyerjza+KEccVhAmL1XXVl+uXjAOgTC7vfp048OFCITJo41t2zuNwjkIs2enFWNdHFYQZi83nmj4xeop4xAIs3sb27YPGYVDLGZPVOdV7xGHFYTZnsZDEq6qXjQOgTD7wXQS/mejEAizR6qLq58ZhXOQzWT1Gt//TON6xro4rCCb0dMH+L6Xq29Ul1V/N8Y3vrXVamUK++/4xm7TQfvxnnsa27a/Nj6HWJvdrurm//Hf/rX6cHWWOKwgW8kR1U+rM/fx+u7qmurqbNtaQbagF6sd1eWNR+n8257qluqU6TVxWEHMsdpWHda4lrHbSAQCDrFAIIBAQCAgEBAICAQEAgIBgYBAAIGAQEAgIBAQCAgEBAICAYGAQACBgEBAICAQEAgIBAQCAgGBAAIBgYBAQCAgEBAICAQEAgIBgQACAYGAQEAgIBAQCAgEBAICAQQCAgGBgEBAICAQEAgIBAQCAgEEAgIBgYBA4P/lFcEDsFhKiMzLAAAAAElFTkSuQmCCr';
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
              audio_url = "https://storage.googleapis.com/".concat(card.bucket_name, "/").concat(card.card_audio_bucket_fp); // TODO handle card audios that are actually sequences, by looking in a different part of the bucket

              $('body').append("<audio crossorigin=\"anonymous\" src=\"".concat(audio_url, "\" type=\"audio/mp4\"></audio>"));
              audio_el = document.querySelector('audio');
              audio_el.addEventListener('ended', handle_audio_end); // TODO consolidate volume slider logic

              $('#mobile-volume-slider').on('input', function () {
                audio_el.volume = $('#mobile-volume-slider').val() / 100;

                if (audio_el.volume > 0) {
                  $('#mobile-volume-icon').attr('src', mobile_volume_on_img);
                } else {
                  $('#mobile-volume-icon').attr('src', mobile_volume_off_img);
                }
              });
              $('#desktop-volume-slider').on('input', function () {
                audio_el.volume = $('#desktop-volume-slider').val() / 100;

                if (audio_el.volume > 0) {
                  $('#desktop-volume-icon > img').attr('src', control_volume_on_img);
                } else {
                  $('#desktop-volume-icon > img').attr('src', control_volume_off_img);
                }
              });
              var last_slider_val = 75;
              $('#desktop-volume-icon').on('click', function () {
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
              $('#mobile-volume-icon').on('click', function () {
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


              function card_play() {
                $('#desktop-play > img').attr('src', control_pause_img);
                play_audio();
                overlay_background.fadeOut(250);
              }

              window.card_play = card_play;

              function card_pause() {
                $('#desktop-play > img').attr('src', control_play_img);
                pause_audio();
                overlay_two_buttons();
                overlay_background.fadeIn(250);
              }

              function handle_click() {
                if (playing) {
                  card_pause();
                } else {
                  card_play();
                }
              }

              replay_btn.click(handle_replay);
              desktop_replay.click(handle_replay);
              mobile_replay.click(handle_replay);
              $('#big-alt-button').click(handle_replay);

              function handle_replay() {
                clearInterval(buffer_interval);
                audio_el.currentTime = 0;
                $('img', desktop_play).attr('src', control_pause_img);
                play_audio();
                overlay_background.fadeOut(250);
              }

              function play_audio() {
                // play the audio and animate
                clearInterval(buffer_interval);
                audio_el.play();
                buffer_interval = setInterval(function () {
                  // add the upcoming 250 ms of mouth animations based on current playback
                  var start_idx = Math.floor(audio_el.currentTime * 60);
                  feature_tickers.mouth.cancel(); // add a little extra the interval gets delayed

                  feature_tickers.mouth.add(card.animation_json.mouth_positions.slice(start_idx, start_idx + 60));
                }, 250);
                playing = true;
              }

              function pause_audio() {
                clearInterval(buffer_interval);
                audio_el.pause();
                feature_tickers.mouth.cancel();
                feature_tickers.mouth.add([0]);
                playing = false;
              }

              function handle_audio_end() {
                log('audio ended');
                clearInterval(buffer_interval);
                overlay_right_button();
                overlay_background.fadeIn(500);
                audio_el.currentTime = 0;
                playing = false;
              }
            };

            display_ui = function _display_ui() {
              _.each(ui_to_show, function (ui_el) {
                ui_el.fadeIn(500);
              });

              _.each(ui_to_hide, function (ui_el) {
                ui_el.fadeOut(250);
              });
            };

            handle_mode = function _handle_mode() {
              if (wide_mode()) {
                log('wide mode'); // show stuff on either side of card

                ui_to_show = [$('#desktop-app-links'), $('#desktop-controls'), $('#k9-logo')];
                ui_to_hide = [$('#mobile-bottom-controls')];
              } else {
                log('mobile mode'); // hide stuff on either side of card

                ui_to_show = [$('#mobile-bottom-controls'), $('#k9-logo')];
                ui_to_hide = [$('#desktop-app-links'), $('#desktop-controls')];
              }
            };

            overlay_right_button = function _overlay_right_button() {
              $('#big-play-button-overlay').hide();
              $('#big-alt-button-overlay').removeClass('overlay-left');
              $('#big-alt-button-overlay').removeClass('overlay-right');
              $('#big-alt-button-overlay').addClass('overlay-center');
              $('#big-alt-button-overlay').show();
            };

            overlay_one_button = function _overlay_one_button() {
              $('#big-alt-button-overlay').hide();
              $('#big-play-button-overlay').removeClass('overlay-left');
              $('#big-play-button-overlay').removeClass('overlay-right');
              $('#big-play-button-overlay').addClass('overlay-center');
              $('#big-play-button-overlay').show();
            };

            overlay_two_buttons = function _overlay_two_buttons() {
              $('#big-play-button-overlay').removeClass('overlay-center');
              $('#big-alt-button-overlay').removeClass('overlay-center');
              $('#big-play-button-overlay').removeClass('overlay-right');
              $('#big-alt-button-overlay').removeClass('overlay-left');
              $('#big-play-button-overlay').addClass('overlay-left');
              $('#big-alt-button-overlay').addClass('overlay-right');
              $('#big-play-button-overlay').show();
              $('#big-alt-button-overlay').show();
            };

            _create_overlay_buttons = function _create_overlay_butto2() {
              _create_overlay_buttons = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
                var html_frag;
                return regeneratorRuntime.wrap(function _callee6$(_context6) {
                  while (1) {
                    switch (_context6.prev = _context6.next) {
                      case 0:
                        html_frag = "\n            <div id=\"overlay-background\" style=\"display: none;\">\n                <div id=\"big-play-button-overlay\" class=\"overlay-button overlay-left\">\n                    <img id=\"big-play-button\" src=\"/puppet/k9-icons/play-no-border-white.png\">\n                </div>\n                <div id=\"big-alt-button-overlay\" class=\"overlay-button overlay-right\">\n                    <img id=\"big-alt-button\" src=\"/puppet/k9-icons/replay-no-border-white.png\">\n                </div>\n            </div>\n        ";
                        $('#message').append(html_frag);

                        if (card_has_frame() == false) {
                          $('#overlay-background').css({
                            height: 656 // same as message width

                          });
                        } else {
                          $('#overlay-background').css({
                            height: 778
                          });
                        }

                        $('#overlay-background').show();
                        overlay_one_button();

                      case 5:
                      case "end":
                        return _context6.stop();
                    }
                  }
                }, _callee6);
              }));
              return _create_overlay_buttons.apply(this, arguments);
            };

            create_overlay_buttons = function _create_overlay_butto() {
              return _create_overlay_buttons.apply(this, arguments);
            };

            create_decoration_image = function _create_decoration_im() {
              $('#message').append("<img id=\"decoration-image\" src=".concat(decoration_image_url, "></img>"));
              $('#decoration-image').css({
                width: message_width,
                top: 0,
                left: 0,
                position: 'absolute',
                zIndex: 2
              });
            };

            _check_decoration_image = function _check_decoration_ima2() {
              _check_decoration_image = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
                return regeneratorRuntime.wrap(function _callee5$(_context5) {
                  while (1) {
                    switch (_context5.prev = _context5.next) {
                      case 0:
                        return _context5.abrupt("return", new Promise(function (r) {
                          // load the decoration image to get its natural dimensions
                          img_for_dimensions.onload = function () {
                            r(card_has_frame());
                          };

                          img_for_dimensions.onerror = _.noop;

                          if (card.decoration_image_bucket_fp) {
                            decoration_image_url = "https://storage.googleapis.com/".concat(card.bucket_name, "/").concat(card.decoration_image_bucket_fp);
                          } else {
                            // transparent 1x1 png
                            decoration_image_url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                          } // this will trigger the loading


                          img_for_dimensions.src = decoration_image_url;
                        }));

                      case 1:
                      case "end":
                        return _context5.stop();
                    }
                  }
                }, _callee5);
              }));
              return _check_decoration_image.apply(this, arguments);
            };

            check_decoration_image = function _check_decoration_ima() {
              return _check_decoration_image.apply(this, arguments);
            };

            card_has_frame = function _card_has_frame() {
              if (img_for_dimensions.width == 0) {
                return undefined;
              }

              return img_for_dimensions.width === 656;
            };

            skip_envelope = function _skip_envelope() {
              $('#message').addClass('above');
              $('#message').addClass('top-ease-in');
              $('#message').show();
              $('#message').removeClass('above');
              $('#message').addClass('middle');
              setTimeout( /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                  while (1) {
                    switch (_context2.prev = _context2.next) {
                      case 0:
                        _context2.next = 2;
                        return zoom_message();

                      case 2:
                        // wait till the message is full size before adding decoration image
                        create_decoration_image();
                        _context2.next = 5;
                        return prepare_puppet();

                      case 5:
                        _context2.next = 7;
                        return create_overlay_buttons();

                      case 7:
                        handle_mode();
                        prepare_audio(); // fade out loading spinner

                        $('.loading-spinner').fadeOut(250);
                        setTimeout(function () {
                          $('#message-cover').fadeOut(250);
                          setTimeout(function () {
                            // TODO this should be in a layout fn
                            //$('#mobile-bottom-controls').fadeIn(500);
                            //$('#k9-logo').fadeIn(500);
                            $('body').css({
                              'overflow-y': 'scroll'
                            });
                            ready_to_display = true;
                            display_ui();
                          }, 500);
                        }, 250);

                      case 11:
                      case "end":
                        return _context2.stop();
                    }
                  }
                }, _callee2);
              })), flap_open_ms + envelope_move_ms);
            };

            present_envelope = function _present_envelope() {
              // slide envelope into frame
              envelope_middle(); // start the envelope jiggling

              jiggle_interval = setInterval(envelope_jiggle, 2000);
              $('.envelope-piece').click(function () {
                cancel_jiggle(open_flap);
              });
            };

            _zoom_message = function _zoom_message3() {
              _zoom_message = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
                return regeneratorRuntime.wrap(function _callee4$(_context4) {
                  while (1) {
                    switch (_context4.prev = _context4.next) {
                      case 0:
                        return _context4.abrupt("return", new Promise( /*#__PURE__*/function () {
                          var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(r) {
                            var has_frame;
                            return regeneratorRuntime.wrap(function _callee3$(_context3) {
                              while (1) {
                                switch (_context3.prev = _context3.next) {
                                  case 0:
                                    _context3.next = 2;
                                    return check_decoration_image();

                                  case 2:
                                    has_frame = _context3.sent;
                                    log(has_frame);
                                    $('#message').css({
                                      transition: 'height 1s ease-in-out, width 1s ease-in-out',
                                      width: message_width,
                                      height: has_frame ? message_height : message_width
                                    }); // adjust the ui around the frame

                                    if (has_frame) {
                                      $('#mobile-bottom-controls').css({
                                        'margin-top': 'calc(40px + (765px / 2))'
                                      });
                                      $('#k9-logo').css({
                                        'transition': 'top 0.5s ease-in-out',
                                        'top': 'calc(50% - (778px / 2) + -17px)'
                                      });
                                      $('#logo-image').css({
                                        'transition': 'width 0.5s ease-in-out',
                                        'width': 'calc(470px / 2)'
                                      });
                                    }

                                    setTimeout(r, 1000);

                                  case 7:
                                  case "end":
                                    return _context3.stop();
                                }
                              }
                            }, _callee3);
                          }));

                          return function (_x15) {
                            return _ref3.apply(this, arguments);
                          };
                        }()));

                      case 1:
                      case "end":
                        return _context4.stop();
                    }
                  }
                }, _callee4);
              }));
              return _zoom_message.apply(this, arguments);
            };

            zoom_message = function _zoom_message2() {
              return _zoom_message.apply(this, arguments);
            };

            open_flap = function _open_flap() {
              // trigger the flap opening animation
              $('#flap').addClass('opened');
              $('#message').show();
              setTimeout(function () {
                // halfway through opening the flap,
                // remove text show it doesnt show through underside
                $('#flap').text(''); // prepare have flap go under message when sliding down

                $('#flap').css({
                  zIndex: 1
                });
              }, flap_open_ms / 2); // move the envelope away after the flap opens

              setTimeout(envelope_below, flap_open_ms); // the loading sequence after the envelope has been opened

              setTimeout( /*#__PURE__*/_asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        _context.next = 2;
                        return zoom_message();

                      case 2:
                        // wait till the message is full size before adding decoration image
                        create_decoration_image();
                        _context.next = 5;
                        return prepare_puppet();

                      case 5:
                        _context.next = 7;
                        return create_overlay_buttons();

                      case 7:
                        handle_mode();
                        prepare_audio(); // fade out loading spinner

                        $('.loading-spinner').fadeOut(250);
                        setTimeout(function () {
                          $('#message-cover').fadeOut(250);
                          setTimeout(function () {
                            // TODO this should be in a layout fn
                            //$('#mobile-bottom-controls').fadeIn(500);
                            //$('#k9-logo').fadeIn(500);
                            $('body').css({
                              'overflow-y': 'scroll'
                            });
                            ready_to_display = true;
                            display_ui();
                          }, 500);
                        }, 250);

                      case 11:
                      case "end":
                        return _context.stop();
                    }
                  }
                }, _callee);
              })), flap_open_ms + envelope_move_ms);
            };

            wide_mode = function _wide_mode() {
              //return document.body.offsetWidth > document.body.offsetHeight;
              return document.body.offsetWidth / document.body.offsetHeight > 1.1;
            };

            cancel_jiggle = function _cancel_jiggle(cb) {
              if (is_jiggling) {
                setTimeout(function () {
                  console.log('waiting');
                  cancel_jiggle(cb);
                }, 10);
              } else {
                clearInterval(jiggle_interval);
                cb();
              }
            };

            envelope_jiggle = function _envelope_jiggle() {
              is_jiggling = true;
              envelope_tilt_left();
              setTimeout(envelope_no_tilt, 75);
              setTimeout(envelope_tilt_right, 150);
              setTimeout(envelope_no_tilt, 225);
              setTimeout(function () {
                is_jiggling = false;
              }, 350);
            };

            envelope_no_tilt = function _envelope_no_tilt() {
              $('.envelope-piece').removeClass('rotate-right');
              $('.envelope-piece').removeClass('rotate-left');
            };

            envelope_tilt_left = function _envelope_tilt_left() {
              $('.envelope-piece').removeClass('rotate-right');
              $('.envelope-piece').addClass('rotate-left');
            };

            envelope_tilt_right = function _envelope_tilt_right() {
              $('.envelope-piece').removeClass('rotate-left');
              $('.envelope-piece').addClass('rotate-right');
            };

            envelope_below = function _envelope_below() {
              $('.envelope-piece').removeClass('middle');
              $('.envelope-piece').removeClass('top');
              $('.envelope-piece').addClass('top-ease-in');
              $('.envelope-piece').addClass('below'); // remove the elements entirely after sliding them out of view

              setTimeout(function () {
                $('.envelope-piece').remove();
              }, 1000);
            };

            envelope_middle = function _envelope_middle() {
              $('.envelope-piece').removeClass('top');
              $('.envelope-piece').removeClass('below');
              $('.envelope-piece').addClass('middle');
            };

            envelope_top = function _envelope_top() {
              $('.envelope-piece').removeClass('middle');
              $('.envelope-piece').removeClass('below');
              $('.envelope-piece').addClass('above');
            };

            switch_class = function _switch_class(el, old_class, new_class) {
              el.addClass(new_class);
              el.removeClass(old_class);
            };

            // add the recipient name to the card flap
            recipient_name = get_url_param('recipient_name');

            if (recipient_name == null) {
              // probably a short uuid
              recipient_name = card.recipient_name;
            }

            $('#flap').text("To: ".concat(recipient_name));
            console.log('CARD OBJ', card);

            if (card.has_envelope) {
              present_envelope();
            } else {
              skip_envelope();
            }

            is_jiggling = false;
            // these come from the css transitions
            flap_open_ms = 750;
            envelope_move_ms = 1000;
            message_zoom_ms = 1500;
            ready_to_display = false; // so resize events dont prematurely display ui

            message_width = 656;
            message_height = 778;
            ;
            // wider in scope because other things need to know if the card has a frame
            img_for_dimensions = new Image();
            ui_to_show = [];
            ui_to_hide = [];
            $(window).on('resize', _.debounce(function () {
              handle_mode();

              if (ready_to_display) {
                display_ui();
              }
            }, 125)); // greeting card prep

          case 46:
          case "end":
            return _context9.stop();
        }
      }
    }, _callee9);
  }));
  return _prepare_card.apply(this, arguments);
}

function init() {
  return _init.apply(this, arguments);
} // prepare scene for debugging
// this should be used in puppet-debug.html


function _init() {
  _init = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10() {
    var viewport_aspect;
    return regeneratorRuntime.wrap(function _callee10$(_context10) {
      while (1) {
        switch (_context10.prev = _context10.next) {
          case 0:
            start_time = performance.now();
            log('puppet.js initializing');
            stats = new Stats(); // iOS webview sizing shim
            // TODO figure out why webviews dimensions come out undersized on ios

            iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            log("navigator.userAgent: ".concat(navigator.userAgent));
            log("iOS = ".concat(iOS));

            if (iOS) {
              window_width = document.body.offsetWidth + 20;
              window_height = document.body.offsetHeight + 20;
            } else {
              window_width = document.body.offsetWidth;
              window_height = document.body.offsetHeight;
            }

            log("WIDTH INFO:\n    window.innerWidth: ".concat(window.innerWidth, "\n    document.body.offsetWidth: ").concat(document.body.offsetWidth, "\n    document.body.clientWidth: ").concat(document.body.clientWidth, "\n    USING:\n    window_width: ").concat(window_width, "\n    window_height: ").concat(window_height, "\n    ")); // for turning images into b64
            // this is just to help test in a browser

            image_canvas = document.getElementById('image-canvas');
            image_ctx = image_canvas.getContext('2d'); // this just holds the three.js render element

            container = document.getElementById('container'); // client is using cropped images that are always square
            // so expect a square viewport as well

            viewport_aspect = 1;
            zoom_factor = Math.min(window_width, window_height) / render_pixels;
            loading_spinner = document.getElementById('loading-spinner'); // see fps and memory for debugging

            if (show_fps) {
              stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

              document.body.appendChild(stats.dom);
              stats.dom.style.left = '120px';
            } // shader code lives in its on .hlsl files so they can be more easily
            // syntax highlighted
            // this loads the hlsl files, then populates the shader configs with the
            // shader code


            _context10.next = 17;
            return load_shader_files();

          case 17:
            _context10.next = 19;
            return load_texture(noise_url);

          case 19:
            animation_noise_texture = _context10.sent;
            //
            // create the threejs geometry and materials for the scene
            //
            scene = new THREE.Scene();
            renderer = new THREE.WebGLRenderer(); //renderer.autoClear = false;

            scene.background = new THREE.Color(0x2E2E46); // Camera left and right frustrum to make sure the camera size is the same as viewport size

            camera = new THREE.OrthographicCamera(-0.5 * viewport_aspect, 0.5 * viewport_aspect, 0.5, -0.5, 0.001, 1000);
            camera.position.z = 1; // Create the background plane
            // This is just the static pet image on the plane
            // Draw this if we aren't debugging the face mesh

            if (!debug_face_mesh) {
              pet_material = new THREE.MeshBasicMaterial(); // map: pet_image_texture happens later, when we know what the pet image is

              background_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), pet_material);
              background_mesh.scale.x = 1; // this will get set when we know what the pet image is

              background_mesh.renderOrder = 0;
            } // create the face mesh


            face_mesh_material = new THREE.ShaderMaterial({
              uniforms: face_animation_shader.uniforms,
              vertexShader: face_animation_shader.vertexShader,
              fragmentShader: face_animation_shader.fragmentShader,
              depthFunc: debug_face_mesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
              side: THREE.DoubleSide,
              wireframe: debug_face_mesh
            }); // Adds the material to the geometry

            face_mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, segments, segments), face_mesh_material); // This object renders on top of the background

            face_mesh.renderOrder = 1; // mouth sprite - this is a group in threejs lingo,
            // the actual mouth mesh lives in mouth_mesh, a child of the group

            _context10.next = 31;
            return load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');

          case 31:
            mouth_gltf = _context10.sent;
            mouth_mesh = mouth_gltf.scene.children[0].children[0];
            mouth_mesh.material = new THREE.ShaderMaterial({
              uniforms: mouth_shader.uniforms,
              vertexShader: mouth_shader.vertexShader,
              fragmentShader: mouth_shader.fragmentShader,
              depthFunc: THREE.AlwaysDepth,
              side: THREE.DoubleSide,
              blending: THREE.CustomBlending,
              blendEquation: THREE.AddEquation,
              blendSrc: THREE.SrcAlphaFactor,
              blendDst: THREE.OneMinusSrcAlphaFactor,
              vertexColors: true
            });
            mouth_mesh.renderOrder = 2; // add the meshes and stuff to the scene

            scene.add(background_mesh);
            scene.add(face_mesh);
            scene.add(mouth_gltf.scene); // this adds mouth_mesh because its a child of this
            // prepare for rendering

            renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
            container.appendChild(renderer.domElement);
            renderer.setSize(render_pixels, render_pixels); //$(renderer.domElement).css('zoom', zoom_factor);

            log("renderer zoom factor: ".concat(zoom_factor));

            if (enable_controls) {
              controls = new THREE.OrbitControls(camera, renderer.domElement);
            }

            if (log_mouse_position) {
              window.addEventListener('click', function (e) {
                var normalized_x = e.clientX / window.innerWidth;
                var normalized_y = e.clientY / window.innerHeight;
                var worldPos = screen_to_world_position(new THREE.Vector2(normalized_x, normalized_y));
                console.log("worldPos: ".concat(worldPos.x, ", ").concat(worldPos.y));
              });
            } // dont render anything yet, that should happen when the app
            // actually specifies an image
            // tell client the webview is ready to create a puppet


            log('finished init');
            post_init(); //// check the dom for a card_id, if so, playback card
            //if (window.greeting_card) {
            //    log('greeting card yall');
            //    greeting_card_init();
            //    $('body').css('background', 'rgb(235,235,235)');
            //    $('#container').css('margin', 20);
            //    $('#container > canvas').css('box-shadow', '0 4px 9px 0 rgba(0,0,0,.25)');
            //}

          case 46:
          case "end":
            return _context10.stop();
        }
      }
    }, _callee10);
  }));
  return _init.apply(this, arguments);
}

function init_debug() {
  return _init_debug.apply(this, arguments);
} // create a puppet from an image url
// the app will pass a base64 string encoding to this
// TODO make the transition smooth looking


function _init_debug() {
  _init_debug = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11() {
    var viewport_aspect;
    return regeneratorRuntime.wrap(function _callee11$(_context11) {
      while (1) {
        switch (_context11.prev = _context11.next) {
          case 0:
            start_time = performance.now();
            log('puppet.js DEBUG initializing');
            stats = new Stats();
            window.fade_spinner = _.noop; // just to simplify
            // for turning images into b64
            // this is just to help test in a browser

            image_canvas = document.getElementById('image-canvas');
            image_ctx = image_canvas.getContext('2d'); // this just holds the three.js render element

            container = document.getElementById('container'); // client is using cropped images that are always square
            // so expect a square viewport as well

            viewport_aspect = 1; // see fps and memory for debugging

            if (show_fps) {
              stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom

              document.body.appendChild(stats.dom);
              stats.dom.style.left = '120px';
            } // shader code lives in its on .hlsl files so they can be more easily
            // syntax highlighted
            // this loads the hlsl files, then populates the shader configs with the
            // shader code


            _context11.next = 11;
            return load_shader_files();

          case 11:
            _context11.next = 13;
            return load_texture(noise_url);

          case 13:
            animation_noise_texture = _context11.sent;
            //
            // create the threejs geometry and materials for the scene
            //
            scene = new THREE.Scene();
            renderer = new THREE.WebGLRenderer(); //renderer.autoClear = false;

            scene.background = new THREE.Color(0x2E2E46); // Camera left and right frustrum to make sure the camera size is the same as viewport size

            camera = new THREE.OrthographicCamera(-0.5 * viewport_aspect, 0.5 * viewport_aspect, 0.5, -0.5, 0.001, 1000);
            camera.position.z = 1; // Create the background plane
            // This is just the static pet image on the plane
            // Draw this if we aren't debugging the face mesh

            if (!debug_face_mesh) {
              pet_material = new THREE.MeshBasicMaterial(); // map: pet_image_texture happens later, when we know what the pet image is

              background_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), pet_material);
              background_mesh.scale.x = 1; // this will get set when we know what the pet image is

              background_mesh.renderOrder = 0;
            } // create the face mesh


            face_mesh_material = new THREE.ShaderMaterial({
              uniforms: face_animation_shader.uniforms,
              vertexShader: face_animation_shader.vertexShader,
              fragmentShader: face_animation_shader.fragmentShader,
              depthFunc: debug_face_mesh ? THREE.AlwaysDepth : THREE.GreaterDepth,
              side: THREE.DoubleSide,
              wireframe: debug_face_mesh
            }); // Adds the material to the geometry

            face_mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, segments, segments), face_mesh_material); // This object renders on top of the background

            face_mesh.renderOrder = 1; // mouth sprite - this is a group in threejs lingo,
            // the actual mouth mesh lives in mouth_mesh, a child of the group

            _context11.next = 25;
            return load_mouth_mesh(scene, 'MouthStickerDog1_out/MouthStickerDog1.gltf');

          case 25:
            mouth_gltf = _context11.sent;
            mouth_mesh = mouth_gltf.scene.children[0].children[0];
            mouth_mesh.material = new THREE.ShaderMaterial({
              uniforms: mouth_shader.uniforms,
              vertexShader: mouth_shader.vertexShader,
              fragmentShader: mouth_shader.fragmentShader,
              depthFunc: THREE.AlwaysDepth,
              side: THREE.DoubleSide,
              blending: THREE.CustomBlending,
              blendEquation: THREE.AddEquation,
              blendSrc: THREE.SrcAlphaFactor,
              blendDst: THREE.OneMinusSrcAlphaFactor,
              vertexColors: true
            });
            mouth_mesh.renderOrder = 2; // add the meshes and stuff to the scene

            scene.add(background_mesh);
            scene.add(face_mesh);
            scene.add(mouth_gltf.scene); // this adds mouth_mesh because its a child of this
            // prepare for rendering

            renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
            container.appendChild(renderer.domElement);
            renderer.setSize(2 * render_pixels, 2 * render_pixels);

            if (enable_controls) {
              controls = new THREE.OrbitControls(camera, renderer.domElement);
            }

            if (log_mouse_position) {
              window.addEventListener('click', function (e) {
                var normalized_x = e.clientX / window.innerWidth;
                var normalized_y = e.clientY / window.innerHeight;
                var worldPos = screen_to_world_position(new THREE.Vector2(normalized_x, normalized_y));
                console.log("worldPos: ".concat(worldPos.x, ", ").concat(worldPos.y));
              });
            } // dont render anything yet, that should happen when the app
            // actually specifies an image
            // tell client the webview is ready to create a puppet


            log('finished DEBUG init');

            if (get_url_param('dog')) {
              log('found test dog in url, loading...');
              test(get_url_param('dog'));
            }

          case 39:
          case "end":
            return _context11.stop();
        }
      }
    }, _callee11);
  }));
  return _init_debug.apply(this, arguments);
}

function create_puppet(_x) {
  return _create_puppet.apply(this, arguments);
} //
// keeping the scene in sync when features change
//


function _create_puppet() {
  _create_puppet = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12(img_url) {
    return regeneratorRuntime.wrap(function _callee12$(_context12) {
      while (1) {
        switch (_context12.prev = _context12.next) {
          case 0:
            start_time = performance.now();
            _context12.next = 3;
            return fade_spinner(200, 0);

          case 3:
            stop_all_animations();
            _context12.next = 6;
            return fade_container(500, 0);

          case 6:
            cancelAnimationFrame(animation_frame);

            if (!(img_url === undefined)) {
              _context12.next = 13;
              break;
            }

            _context12.next = 10;
            return to_b64('dog3.jpg');

          case 10:
            _context12.t0 = _context12.sent;
            _context12.next = 14;
            break;

          case 13:
            _context12.t0 = img_url;

          case 14:
            img_url = _context12.t0;

            // need to do this so old three objects can be garbage collected
            if (pet_image_texture) {
              pet_image_texture.dispose();
            } // set the pet image on the mesh and on the shader


            _context12.next = 18;
            return load_texture(img_url);

          case 18:
            pet_image_texture = _context12.sent;
            pet_material.map = pet_image_texture;
            face_animation_shader.uniforms.petImage.value = pet_image_texture; // TODO which of these is actually necessary

            background_mesh.needsUpdate = true;
            pet_material.needsUpdate = true;
            face_mesh.needsUpdate = true;
            face_mesh_material.needsUpdate = true; // TODO weird place for default mouth color

            mouth_color(0.5686274509, 0.39607843137, 0.43137254902); // use features to determine locations of stuff

            sync_objects_to_features();
            update_shaders();
            direct_render();
            animate();
            head_sway(head_sway_amplitude, head_sway_speed);
            fade_spinner(500, 0);
            _context12.next = 34;
            return $(container).fadeTo(500, 1);

          case 34:
            log('create_puppet finished');

          case 35:
          case "end":
            return _context12.stop();
        }
      }
    }, _callee12);
  }));
  return _create_puppet.apply(this, arguments);
}

function sync_objects_to_features() {
  // this should only get called when pet image texture exists,
  // so it can use it to set scales and ratios
  if (!pet_image_texture) {
    log('WARNING: pet_image_texture is undefined!');
  }

  background_mesh.scale.x = pet_image_texture.image.width / pet_image_texture.image.height;
  face_animation_shader.uniforms.aspectRatio.value = pet_image_texture.image.width / pet_image_texture.image.height; // use the eye locations to deduce other feature locations and orientations

  var leftEye = new THREE.Vector2(features.leftEyePosition.x, features.leftEyePosition.y);
  var rightEye = new THREE.Vector2(features.rightEyePosition.x, features.rightEyePosition.y); // We need to center this geometry at the face

  var eyeCenter = leftEye.add(rightEye).multiplyScalar(0.5);
  var eyeLine = rightEye.sub(leftEye);
  var mouthPosition = new THREE.Vector2(features.mouthPosition.x, features.mouthPosition.y); // Center the face mesh's position on the eyes

  face_mesh.position.x = eyeCenter.x;
  face_mesh.position.y = eyeCenter.y; // Center the mouth mesh's position on the eyes

  mouth_mesh.position.x = mouthPosition.x;
  mouth_mesh.position.y = mouthPosition.y; // Rotate the mouth mesh the same direction as the eyes, ease a bit with the moutline

  var leftMouth = new THREE.Vector2(features.mouthLeft.x, features.mouthLeft.y);
  var rightMouth = new THREE.Vector2(features.mouthRight.x, features.mouthRight.y);
  var mouthLine = rightMouth.sub(leftMouth);
  var mouthWidth = mouthLine.length(); // scale the mouth mesh by the distance between eyes

  mouth_mesh.scale.set(mouthWidth, mouthWidth, mouthWidth); // Rotate the face and mouth mesh the same direction as the eyes

  var rads = Math.atan(eyeLine.y / eyeLine.x);
  face_mesh.rotation.set(0, 0, 0);
  face_mesh.rotateZ(rads);
  rads = Math.atan(mouthLine.y / mouthLine.x);
  mouth_mesh.rotation.y = -rads; // update the head ellipse

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
  var extentsY = (distanceTop + distanceBottom) * 0.5; // This value is how the big the ellipse is for the head

  var ST_numerator = 0.3;
  var ellipseExtents = new THREE.Vector2(extentsX, extentsY);
  var faceEllipse_ST = new THREE.Vector4(ST_numerator / ellipseExtents.x, ST_numerator / ellipseExtents.y, ellipseCenter.x, ellipseCenter.y);
  face_animation_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
  mouth_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
}

function update_shaders() {
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
} // use this to set feature locations from the app


function set_position(key, x, y) {
  // eslint-disable-line no-unused-vars
  // set the feature on the features object
  log("calling set_position('".concat(key, "', ").concat(x, ", ").concat(y, ")"));
  features[key] = new THREE.Vector2(x, y);

  if (key === 'leftEyePosition' || key === 'rightEyePosition') {
    if (features.leftEyePosition.x > features.rightEyePosition.x) {
      log('WARNING: left eye x is greater than right eye x- left and right are from the viewers perspective');
    }
  } // sync


  sync_objects_to_features();
  update_shaders();
  direct_render();
}

function blink_left(val) {
  // eslint-disable-line no-unused-vars
  face_animation_shader.uniforms.blinkLeft.value = val;
  direct_render();
}

function blink_right(val) {
  // eslint-disable-line no-unused-vars
  face_animation_shader.uniforms.blinkRight.value = val;
  direct_render();
}

function blink(val) {
  // eslint-disable-line no-unused-vars
  face_animation_shader.uniforms.blinkRight.value = val;
  face_animation_shader.uniforms.blinkLeft.value = val;
  direct_render();
}

function eyebrow_left(val) {
  // eslint-disable-line no-unused-vars
  face_animation_shader.uniforms.eyebrowLeftOffset.value = val;
  direct_render();
}

function eyebrow_right(val) {
  // eslint-disable-line no-unused-vars
  face_animation_shader.uniforms.eyebrowRightOffset.value = val;
  direct_render();
}

function mouth_open(val) {
  // eslint-disable-line no-unused-vars
  mouth_shader.uniforms.mouthOpen.value = val;
  face_animation_shader.uniforms.mouthOpen.value = val;
  direct_render();
}

function mouth_color(fr, fg, fb) {
  mouth_shader.uniforms.mouthColor.value = new THREE.Vector3(fr, fg, fb);
  update_shaders();
  direct_render();
}

function lips_color(fr, fg, fb) {
  mouth_shader.uniforms.lipsColor.value = new THREE.Vector3(fr, fg, fb);
  update_shaders();
  direct_render();
}

function lips_thickness(val) {
  mouth_shader.uniforms.lipsThickness.value = val;
  update_shaders();
  direct_render();
}

function update_head_sway(amplitude, speed) {
  // eslint-disable-line no-unused-vars
  head_sway_amplitude = amplitude;
  head_sway_speed = speed;
  head_sway(head_sway_amplitude, head_sway_speed);
}

function ramp_on_headsway(over_frames) {
  // eslint-disable-line no-unused-vars
  var amplitude = face_animation_shader.uniforms.swayAmplitude.value;
  var amplitude_step = 0.1 / over_frames; // amplitude gets divided by 10 in head_sway, so match that here

  var ramp_interval = setInterval(function () {
    amplitude = Math.min(amplitude + amplitude_step, 0.1);
    face_animation_shader.uniforms.swayAmplitude.value = amplitude;
    mouth_shader.uniforms.swayAmplitude.value = amplitude;
    head_sway_amplitude = amplitude * 10; // should match the input to head sway

    if (amplitude >= 0.1) {
      clearInterval(ramp_interval);
    }
  }, 17);
}

function ramp_off_headsway(over_frames) {
  // eslint-disable-line no-unused-vars
  var amplitude = face_animation_shader.uniforms.swayAmplitude.value;
  var amplitude_step = amplitude / over_frames;
  var ramp_interval = setInterval(function () {
    amplitude = Math.max(amplitude - amplitude_step, 0);
    face_animation_shader.uniforms.swayAmplitude.value = amplitude;
    mouth_shader.uniforms.swayAmplitude.value = amplitude;
    head_sway_amplitude = amplitude * 10; // should match the input to head sway

    if (amplitude <= 0) {
      clearInterval(ramp_interval);
    }
  }, 17);
} // some prepackaged animations
// amplitude is range of motion
// speed is frames to complete motion
// duration is time until the feature starts to return to original position (in ms)


function left_brow_raise(amplitude, speed, duration) {
  // eslint-disable-line no-unused-vars
  amplitude = amplitude || 1;
  speed = speed || 15;
  duration = duration || 500;
  left_brow_to_pos(0, amplitude, speed);
  setTimeout(function () {
    left_brow_to_pos(amplitude, 0, speed);
  }, duration);
}

function left_brow_furrow(amplitude, speed, duration) {
  // eslint-disable-line no-unused-vars
  amplitude = amplitude || 1;
  speed = speed || 15;
  duration = duration || 500;
  left_brow_to_pos(0, -amplitude, speed);
  setTimeout(function () {
    left_brow_to_pos(-amplitude, 0, speed);
  }, duration);
}

function right_brow_raise(amplitude, speed, duration) {
  // eslint-disable-line no-unused-vars
  amplitude = amplitude || 1;
  speed = speed || 15;
  duration = duration || 500;
  right_brow_to_pos(0, amplitude, speed);
  setTimeout(function () {
    right_brow_to_pos(amplitude, 0, speed);
  }, duration);
}

function right_brow_furrow(amplitude, speed, duration) {
  // eslint-disable-line no-unused-vars
  amplitude = amplitude || 1;
  speed = speed || 15;
  duration = duration || 500;
  right_brow_to_pos(0, -amplitude, speed);
  setTimeout(function () {
    right_brow_to_pos(-amplitude, 0, speed);
  }, duration);
}

function left_blink_quick() {
  // eslint-disable-line no-unused-vars
  left_blink_to_pos(0, 1, 4, easings.easeInOutQuad);
  setTimeout(function () {
    left_blink_to_pos(1, 0, 8, easings.easeInOutQuad);
  });
}

function left_blink_medium() {
  // eslint-disable-line no-unused-vars
  left_blink_to_pos(0, 1, 7, easings.easeInOutQuad);
  setTimeout(function () {
    left_blink_to_pos(1, 0, 14, easings.easeInOutQuad);
  });
}

function left_blink_slow() {
  // eslint-disable-line no-unused-vars
  left_blink_to_pos(0, 1, 15, easings.easeInOutQuad);
  setTimeout(function () {
    left_blink_to_pos(1, 0, 25, easings.easeInOutQuad);
  });
}

function right_blink_quick() {
  // eslint-disable-line no-unused-vars
  right_blink_to_pos(0, 1, 4, easings.easeInOutQuad);
  setTimeout(function () {
    right_blink_to_pos(1, 0, 8, easings.easeInOutQuad);
  });
}

function right_blink_medium() {
  // eslint-disable-line no-unused-vars
  right_blink_to_pos(0, 1, 7, easings.easeInOutQuad);
  setTimeout(function () {
    right_blink_to_pos(1, 0, 14, easings.easeInOutQuad);
  });
}

function right_blink_slow() {
  // eslint-disable-line no-unused-vars
  right_blink_to_pos(0, 1, 15, easings.easeInOutQuad);
  setTimeout(function () {
    right_blink_to_pos(1, 0, 25, easings.easeInOutQuad);
  });
}

var mouth_track_interval;

function mouth_track_sound(amplitudes) {
  // eslint-disable-line no-unused-vars
  // starts animating when called
  clearInterval(mouth_track_interval);
  feature_tickers.mouth.cancel();
  var start_time = performance.now();
  feature_tickers.mouth.add(amplitudes);
  mouth_track_interval = setInterval(function () {
    // add the upcoming 250 ms of mouth animations based on current playback
    var start_idx = Math.floor((performance.now() - start_time) / 1000 * 60);
    feature_tickers.mouth.cancel(); // add a little extra the interval gets delayed

    var to_add = amplitudes.slice(start_idx, start_idx + 60);

    if (to_add.length < 1) {
      clearInterval(mouth_track_interval);
    } else {
      feature_tickers.mouth.add(to_add);
    }
  }, 250);
}

function head_displace(x, y) {
  // eslint-disable-line no-unused-vars
  face_animation_shader.uniforms.head_displacement.value = new THREE.Vector2(x, y);
  mouth_shader.uniforms.head_displacement.value = new THREE.Vector2(x, y); // TODO update mouth_mesh position

  direct_render();
} // this one happens in the shader, using a noise texture and elapsed time


function head_sway(amplitude, speed) {
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
  var extentsY = (distanceTop + distanceBottom) * 0.5; // This value is how the big the ellipse is for the head

  var ST_numerator = 0.3;
  var ellipseExtents = new THREE.Vector2(extentsX, extentsY);
  var faceEllipse_ST = new THREE.Vector4(ST_numerator / ellipseExtents.x, ST_numerator / ellipseExtents.y, ellipseCenter.x, ellipseCenter.y);
  face_animation_shader.uniforms.swaySpeed.value = speed;
  face_animation_shader.uniforms.swayAmplitude.value = amplitude;
  face_animation_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
  mouth_shader.uniforms.swaySpeed.value = speed;
  mouth_shader.uniforms.swayAmplitude.value = amplitude;
  mouth_shader.uniforms.faceEllipse_ST.value = faceEllipse_ST;
} // these move smoothly between two positions


function left_brow_to_pos(start, end, n) {
  // eslint-disable-line no-unused-vars
  feature_tickers.left_brow.add(to_positions(start, end, n, easings.easeInOutQuad));
}

function right_brow_to_pos(start, end, n) {
  // eslint-disable-line no-unused-vars
  feature_tickers.right_brow.add(to_positions(start, end, n, easings.easeInOutQuad));
}

function left_blink_to_pos(start, end, n) {
  // eslint-disable-line no-unused-vars
  feature_tickers.left_blink.add(to_positions(start, end, n, easings.easeInOutQuad));
}

function right_blink_to_pos(start, end, n) {
  // eslint-disable-line no-unused-vars
  feature_tickers.right_blink.add(to_positions(start, end, n, easings.easeInOutQuad));
}

function mouth_to_pos(start, end, n) {
  // eslint-disable-line no-unused-vars
  feature_tickers.mouth.add(to_positions(start, end, n, easings.easeInOutQuad));
} // animation framework
// this holds the future positions of features.
// the animation loop with ask each of these for the next
// position for each, should there be one.
// adding motions is done by adding an array of positions
// to one of these features with their .add method
// use like this for custom animations:
// feature_tickers.<feature>.add(to_positions(<start>, <end>, 100, easings.easeInOutQuad))


var feature_tickers = {
  left_blink: ticker(blink_left),
  right_blink: ticker(blink_right),
  left_brow: ticker(eyebrow_left),
  right_brow: ticker(eyebrow_right),
  mouth: ticker(mouth_open)
}; // this gets called in the raf loop
// it advances all the feature tickers one tick
// and lets the caller know if any features actually moved
// and the scene needs to be rendered

function motion_handler_tick() {
  // check if there is any ticking needed
  var render_needed = false;

  _.each(feature_tickers, function (t, key) {
    if (t.needs_render()) {
      render_needed = true;
    }
  });

  _.invokeMap(feature_tickers, 'tick');

  return render_needed;
} // you can call this directly when you want to render things
// independent of if they are needed as determined by the motion_handler_tick


function direct_render() {
  renderer.render(scene, camera);
}

var stop_anim_loop = _.noop; // eslint-disable-line no-unused-vars
// this starts the raf loop and manages its state

function animate() {
  if (enable_controls && controls !== undefined) {
    controls.update();
  }

  cancelAnimationFrame(animation_frame);
  var animation_start_time = performance.now();

  function do_animate() {
    var render_start = performance.now();

    if (stats) {
      stats.begin();
    } // Tell the shaders how many seconds have elapsed, this is for the headsway animation


    var elapsedMilliseconds = performance.now() - animation_start_time;
    var elapsedSeconds = elapsedMilliseconds / 1000.0;
    face_animation_shader.uniforms.swayTime.value = elapsedSeconds;
    mouth_shader.uniforms.swayTime.value = elapsedSeconds; // step a tick in the motion handler
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

  stop_anim_loop = function stop_anim_loop() {
    cancelAnimationFrame(animation_frame);
  };
}

var _render_times = [];
var keep_n = 60 * 10;

function frame_render_times(time_ms) {
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
} // stop all current and queued animations, and reset the puppet to default state


function stop_all_animations(stop_head_sway) {
  _.each(feature_tickers, function (t, key) {
    t.cancel();
  }); // TODO smooth reset the dog to neutral position


  if (stop_head_sway) {
    head_sway(0, 0);
  }

  blink_left(0);
  blink_right(0);
  eyebrow_left(0);
  eyebrow_right(0);
  mouth_open(0);
  clearInterval(mouth_track_interval);
} // this is a constructor that makes the ticker objects for each
// feature above


function ticker(handler) {
  var ticks = [];

  function next() {
    if (ticks.length > 0) {
      return ticks.shift();
    } else {
      return false;
    }
  }

  function add(xs) {
    ticks = ticks.concat(xs);
  }

  function cancel() {
    ticks = [];
  }

  function needs_render() {
    return ticks.length > 0;
  }

  function tick() {
    var val = next();

    if (val !== false) {
      handler(val);
    }
  }

  return {
    add: add,
    cancel: cancel,
    tick: tick,
    needs_render: needs_render
  };
}

function unit_linspace(n) {
  // creates evenly spaced 1d array of n points between 0 and 1 inclusive
  return _.map(_.range(n), function (x) {
    return x / (n - 1);
  });
}

function to_range(start, end, xs) {
  // convenince fn for affine transforms of unit_linspace arrays
  xs = _.map(xs, fp.multiply(Math.abs(start - end)));
  xs = _.map(xs, fp.add(_.min([start, end])));

  if (end < start) {
    xs = _.reverse(xs);
  }

  return xs;
}

function to_positions(start, end, n, easing) {
  // to generate an eased motion
  var xs = unit_linspace(n);
  xs = _.map(xs, easing);
  xs = to_range(start, end, xs);
  return xs;
}

var easings = {
  linear: function linear(t) {
    return t;
  },
  easeInQuad: function easeInQuad(t) {
    return t * t;
  },
  easeOutQuad: function easeOutQuad(t) {
    return t * (2 - t);
  },
  easeInOutQuad: function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  easeInCubic: function easeInCubic(t) {
    return t * t * t;
  },
  easeOutCubic: function easeOutCubic(t) {
    return --t * t * t + 1;
  },
  easeInOutCubic: function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },
  easeInQuart: function easeInQuart(t) {
    return t * t * t * t;
  },
  easeOutQuart: function easeOutQuart(t) {
    return 1 - --t * t * t * t;
  },
  easeInOutQuart: function easeInOutQuart(t) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
  }
}; //
// loaders
//

function to_static(url) {
  return _.startsWith(url, static_root) ? url : "".concat(static_root, "/").concat(url);
}

function load_mouth_mesh(_x2, _x3) {
  return _load_mouth_mesh.apply(this, arguments);
}

function _load_mouth_mesh() {
  _load_mouth_mesh = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee13(scene, model_path) {
    return regeneratorRuntime.wrap(function _callee13$(_context13) {
      while (1) {
        switch (_context13.prev = _context13.next) {
          case 0:
            if (!mouth_gltf) {
              _context13.next = 4;
              break;
            }

            return _context13.abrupt("return", mouth_gltf);

          case 4:
            _context13.next = 6;
            return load_gltf(to_static(model_path));

          case 6:
            mouth_gltf = _context13.sent;
            return _context13.abrupt("return", mouth_gltf);

          case 8:
          case "end":
            return _context13.stop();
        }
      }
    }, _callee13);
  }));
  return _load_mouth_mesh.apply(this, arguments);
}

function load_texture(_x4) {
  return _load_texture.apply(this, arguments);
}

function _load_texture() {
  _load_texture = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee14(img_src) {
    return regeneratorRuntime.wrap(function _callee14$(_context14) {
      while (1) {
        switch (_context14.prev = _context14.next) {
          case 0:
            return _context14.abrupt("return", new Promise(function (resolve) {
              new THREE.TextureLoader().load(img_src, resolve);
            }));

          case 1:
          case "end":
            return _context14.stop();
        }
      }
    }, _callee14);
  }));
  return _load_texture.apply(this, arguments);
}

function load_image(_x5) {
  return _load_image.apply(this, arguments);
}

function _load_image() {
  _load_image = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee15(img_src) {
    return regeneratorRuntime.wrap(function _callee15$(_context15) {
      while (1) {
        switch (_context15.prev = _context15.next) {
          case 0:
            return _context15.abrupt("return", new Promise(function (resolve) {
              var i = new Image();

              i.onload = function () {
                return resolve(i);
              };

              i.src = to_static(img_src);
            }));

          case 1:
          case "end":
            return _context15.stop();
        }
      }
    }, _callee15);
  }));
  return _load_image.apply(this, arguments);
}

var gltf_memo = {};

function load_gltf(_x6) {
  return _load_gltf.apply(this, arguments);
}

function _load_gltf() {
  _load_gltf = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee16(model_path) {
    return regeneratorRuntime.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            return _context16.abrupt("return", new Promise(function (resolve) {
              if (_.get(gltf_memo, model_path, false)) {
                log("using cached gltf file: ".concat(to_static(model_path)));
                resolve(gltf_memo[model_path]);
              } else {
                var loader = new THREE.GLTFLoader(); // Load a glTF resource

                loader.load(to_static(model_path), function (gltf) {
                  log("gltf loaded: ".concat(to_static(model_path)));
                  gltf_memo[model_path] = gltf;
                  resolve(gltf);
                }, function () {
                  log("gltf file loading: ".concat(to_static(model_path)));
                }, function (error) {
                  log("error loading gltf file: ".concat(to_static(model_path)));
                  log(error);
                });
              }
            }));

          case 1:
          case "end":
            return _context16.stop();
        }
      }
    }, _callee16);
  }));
  return _load_gltf.apply(this, arguments);
}

function load_hlsl_text(_x7) {
  return _load_hlsl_text.apply(this, arguments);
}

function _load_hlsl_text() {
  _load_hlsl_text = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee17(url) {
    var response, text;
    return regeneratorRuntime.wrap(function _callee17$(_context17) {
      while (1) {
        switch (_context17.prev = _context17.next) {
          case 0:
            _context17.next = 2;
            return fetch(to_static(url));

          case 2:
            response = _context17.sent;
            _context17.next = 5;
            return response.text();

          case 5:
            text = _context17.sent;
            return _context17.abrupt("return", text);

          case 7:
          case "end":
            return _context17.stop();
        }
      }
    }, _callee17);
  }));
  return _load_hlsl_text.apply(this, arguments);
}

function load_shader_files() {
  return _load_shader_files.apply(this, arguments);
}

function _load_shader_files() {
  _load_shader_files = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee18() {
    return regeneratorRuntime.wrap(function _callee18$(_context18) {
      while (1) {
        switch (_context18.prev = _context18.next) {
          case 0:
            if (!(face_animation_shader.fragmentShader == null)) {
              _context18.next = 4;
              break;
            }

            _context18.next = 3;
            return load_hlsl_text('face_fragment_shader.hlsl');

          case 3:
            face_animation_shader.fragmentShader = _context18.sent;

          case 4:
            if (!(face_animation_shader.vertexShader == null)) {
              _context18.next = 8;
              break;
            }

            _context18.next = 7;
            return load_hlsl_text('face_vertex_shader.hlsl');

          case 7:
            face_animation_shader.vertexShader = _context18.sent;

          case 8:
            if (!(mouth_shader.fragmentShader == null)) {
              _context18.next = 12;
              break;
            }

            _context18.next = 11;
            return load_hlsl_text('mouth_fragment_shader.hlsl');

          case 11:
            mouth_shader.fragmentShader = _context18.sent;

          case 12:
            if (!(mouth_shader.vertexShader == null)) {
              _context18.next = 16;
              break;
            }

            _context18.next = 15;
            return load_hlsl_text('mouth_vertex_shader.hlsl');

          case 15:
            mouth_shader.vertexShader = _context18.sent;

          case 16:
            log('finished loaded shader files');

          case 17:
          case "end":
            return _context18.stop();
        }
      }
    }, _callee18);
  }));
  return _load_shader_files.apply(this, arguments);
}

function to_b64(_x8) {
  return _to_b.apply(this, arguments);
} //
// loading animations
//


function _to_b() {
  _to_b = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee19(img_src) {
    var img;
    return regeneratorRuntime.wrap(function _callee19$(_context19) {
      while (1) {
        switch (_context19.prev = _context19.next) {
          case 0:
            _context19.next = 2;
            return load_image(img_src);

          case 2:
            img = _context19.sent;
            image_canvas.width = img.width;
            image_canvas.height = img.height;
            image_ctx.drawImage(img, 0, 0);
            return _context19.abrupt("return", image_canvas.toDataURL());

          case 7:
          case "end":
            return _context19.stop();
        }
      }
    }, _callee19);
  }));
  return _to_b.apply(this, arguments);
}

function fade_spinner(_x9, _x10) {
  return _fade_spinner.apply(this, arguments);
}

function _fade_spinner() {
  _fade_spinner = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee20(duration, opacity) {
    return regeneratorRuntime.wrap(function _callee20$(_context20) {
      while (1) {
        switch (_context20.prev = _context20.next) {
          case 0:
            return _context20.abrupt("return", new Promise(function (resolve) {
              $(loading_spinner).fadeTo(duration, opacity, resolve);
            }));

          case 1:
          case "end":
            return _context20.stop();
        }
      }
    }, _callee20);
  }));
  return _fade_spinner.apply(this, arguments);
}

function fade_container(_x11, _x12) {
  return _fade_container.apply(this, arguments);
} //
// testing in browser
//


function _fade_container() {
  _fade_container = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee21(duration, opacity) {
    return regeneratorRuntime.wrap(function _callee21$(_context21) {
      while (1) {
        switch (_context21.prev = _context21.next) {
          case 0:
            return _context21.abrupt("return", new Promise(function (resolve) {
              $(container).fadeTo(duration, opacity, resolve);
            }));

          case 1:
          case "end":
            return _context21.stop();
        }
      }
    }, _callee21);
  }));
  return _fade_container.apply(this, arguments);
}

function screen_to_world_position(screen_pos) {
  var cameraSize = new THREE.Vector2(Math.abs(camera.left) + Math.abs(camera.right), -1.0);
  var offset = new THREE.Vector2(camera.left, 0.5);
  var worldPos = screen_pos.multiply(cameraSize);
  return worldPos.add(offset);
}

var feature_map = {
  'dog1.jpg': {
    leftEyePosition: new THREE.Vector2(-0.094, 0.261),
    rightEyePosition: new THREE.Vector2(0.165, 0.267),
    mouthPosition: new THREE.Vector2(0.040, -0.089),
    mouthLeft: new THREE.Vector2(-0.04, -0.1091),
    mouthRight: new THREE.Vector2(0.134, -0.1060),
    headTop: new THREE.Vector2(0.027, 0.475),
    headBottom: new THREE.Vector2(0.042, -0.147),
    headLeft: new THREE.Vector2(-0.304, 0.232),
    headRight: new THREE.Vector2(0.394, 0.260)
  },
  'dog2.jpg': {
    leftEyePosition: new THREE.Vector2(-0.048, 0.217),
    rightEyePosition: new THREE.Vector2(0.091, 0.131),
    mouthPosition: new THREE.Vector2(-0.109, -0.027),
    mouthLeft: new THREE.Vector2(-0.171, -0.023),
    mouthRight: new THREE.Vector2(-0.0601, -0.0666),
    headTop: new THREE.Vector2(0.131, 0.359),
    headBottom: new THREE.Vector2(-0.122, -0.087),
    headLeft: new THREE.Vector2(-0.170, 0.287),
    headRight: new THREE.Vector2(0.252, 0.072)
  },
  'dog3.jpg': {
    leftEyePosition: new THREE.Vector2(-0.126, 0.308),
    //leftEyePosition:  new THREE.Vector2(-0.18448098663926, 0.30565552699228793),
    rightEyePosition: new THREE.Vector2(0.007, 0.314),
    //rightEyePosition: new THREE.Vector2(0.06474820143884885, 0.31645244215938306),
    mouthPosition: new THREE.Vector2(-0.058, 0.171),
    mouthLeft: new THREE.Vector2(-0.103, 0.143),
    mouthRight: new THREE.Vector2(-0.0108, 0.135),
    headTop: new THREE.Vector2(-0.062, 0.438),
    headBottom: new THREE.Vector2(-0.056, 0.117),
    headLeft: new THREE.Vector2(-0.255, 0.301),
    headRight: new THREE.Vector2(0.151, 0.334)
  },
  'dog4.jpg': {
    leftEyePosition: new THREE.Vector2(-0.196, 0.191),
    rightEyePosition: new THREE.Vector2(0.191, 0.235),
    mouthPosition: new THREE.Vector2(0.015, -0.242),
    mouthLeft: new THREE.Vector2(-0.086, -0.348),
    mouthRight: new THREE.Vector2(0.168, -0.345),
    headTop: new THREE.Vector2(-0.006, 0.400),
    headBottom: new THREE.Vector2(0.035, -0.417),
    headLeft: new THREE.Vector2(-0.282, 0.087),
    headRight: new THREE.Vector2(0.304, 0.142)
  },
  'chihuahua.png': {
    leftEyePosition: new THREE.Vector2(-0.20290964777947934, -0.05130168453292494),
    rightEyePosition: new THREE.Vector2(0.13935681470137828, -0.07120980091883611),
    mouthPosition: new THREE.Vector2(-0.05283307810107196, -0.3131699846860643),
    mouthLeft: new THREE.Vector2(-0.13935681470137826, -0.31929555895865236),
    mouthRight: new THREE.Vector2(0.017611026033690635, -0.3208269525267994),
    headTop: new THREE.Vector2(-0.03062787136294029, 0.2549770290964778),
    headBottom: new THREE.Vector2(-0.05283307810107196, -0.44869831546707506),
    headLeft: new THREE.Vector2(-0.3281010719754977, -0.01225114854517606),
    headRight: new THREE.Vector2(0.2676110260336907, -0.03369065849923425)
  },
  'dog_tilt.jpg': {
    leftEyePosition: new THREE.Vector2(-0.00041631062825520836, 0.25017178853352867),
    rightEyePosition: new THREE.Vector2(0.18442967732747395, 0.07359710693359374),
    mouthPosition: new THREE.Vector2(-0.0908203125, -0.026812065972222222),
    mouthLeft: new THREE.Vector2(-0.16325993855794277, -0.00015928480360243055),
    mouthRight: new THREE.Vector2(-0.05085362752278652, -0.09760852389865451),
    headTop: new THREE.Vector2(0.041215667724609356, 0.36011451721191406),
    headBottom: new THREE.Vector2(-0.03788508097330726, -0.20125976562499998),
    headLeft: new THREE.Vector2(-0.2235636901855469, 0.16604894002278645),
    headRight: new THREE.Vector2(0.3, 0.0)
  },
  'problem-dog.jpg': {
    leftEyePosition: new THREE.Vector2(-0.1064453125, 0.2108425564236111),
    rightEyePosition: new THREE.Vector2(0.109130859375, 0.22840711805555555),
    mouthPosition: new THREE.Vector2(0.043701171875, 0.0025770399305555555),
    mouthLeft: new THREE.Vector2(-0.0498046875, -0.06065538194444445),
    mouthRight: new THREE.Vector2(0.11572265625, -0.026529947916666668),
    headTop: new THREE.Vector2(-0.013671875, 0.3528645833333333),
    headBottom: new THREE.Vector2(0.024658203125, -0.12940809461805555),
    headLeft: new THREE.Vector2(-0.200927734375, 0.07383897569444445),
    headRight: new THREE.Vector2(0.212646484375, 0.07735188802083333)
  }
};
var anims = [];

function stop_test_animation() {
  // eslint-disable-line no-unused-vars
  _.map(anims, clearInterval);

  stop_all_animations();
} // this will load a dog and animate it like its having a stroke


function test(_x13) {
  return _test.apply(this, arguments);
} // use this to load a dog and have it sit still for feature assignment


function _test() {
  _test = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee22(img_url) {
    return regeneratorRuntime.wrap(function _callee22$(_context22) {
      while (1) {
        switch (_context22.prev = _context22.next) {
          case 0:
            // eslint-disable-line no-unused-vars
            _.map(anims, clearInterval);

            img_url = img_url === undefined ? 'dog3.jpg' : img_url;
            _context22.next = 4;
            return create_puppet(img_url);

          case 4:
            features = feature_map[img_url];
            sync_objects_to_features();
            update_shaders(); // do some animations

            left_blink_slow();
            right_blink_slow();
            feature_tickers.mouth.add(_.map(_.range(60 * 60), function (i) {
              return (1 + Math.sin(i / 5)) / 2;
            }));
            anims.push(setInterval(left_blink_quick, 500));
            anims.push(setInterval(right_blink_quick, 800));
            anims.push(setInterval(left_brow_furrow, 900));
            anims.push(setInterval(right_brow_furrow, 700));
            head_sway(head_sway_amplitude, head_sway_speed);

          case 15:
          case "end":
            return _context22.stop();
        }
      }
    }, _callee22);
  }));
  return _test.apply(this, arguments);
}

function find_features(_x14) {
  return _find_features.apply(this, arguments);
}

function _find_features() {
  _find_features = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee23(img_url) {
    return regeneratorRuntime.wrap(function _callee23$(_context23) {
      while (1) {
        switch (_context23.prev = _context23.next) {
          case 0:
            // eslint-disable-line no-unused-vars
            _.map(anims, clearInterval);

            img_url = img_url === undefined ? 'dog3.jpg' : img_url;
            _context23.next = 4;
            return create_puppet(img_url);

          case 4:
            head_sway(0, 0);

          case 5:
          case "end":
            return _context23.stop();
        }
      }
    }, _callee23);
  }));
  return _find_features.apply(this, arguments);
}