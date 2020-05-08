/* global $, MidiParser, _ */
var fp = _.noConflict();


// the form fields
var inputs = {
    midi_file: {
        sel: '#midi-file-input',
        value: el => el[0].files[0],
        warn: [],
        error: [
            {
                f: _.identity,
                message: 'must have a midi file',
            },
            {
                f: el => el.type === 'audio/midi',
                message: 'not a midi file',
            },
        ],
    },
    backing_tracks: {
        sel: '#backing-track-input',
        value: el => el[0].files,
        warn: [
            {
                f: el => el.length,
                message: 'no backing tracks specified',
            },
            // TODO validate backing track key names
            // TODO validate audio format (only aac!)
        ],
        error: [],
    },
    name: {
        sel: '#name-input',
        value: el => el.val(),
        warn: [],
        error: [
            {
                f: _.identity,
                message: 'must have a song name',
            },
        ],
    },
    key: {
        sel: '#key-input',
        value: el => el.val(),
        warn: [
            {
                f: _.negate(fp.isEqual('-')),
                message: 'no key specified, you\'ll need one if you want sequences tuned to backing tracks',
            },
        ],
        error: [],
    },
    price: {
        sel: '#price-input',
        value: el => el.val(),
        warn: [],
        error: [
            {
                f: is_float,
                message: 'invalid price',
            },
        ],
    },
    category: {
        sel: '#category-input',
        value: el => el.val(),
        warn: [
            {
                f: _.identity,
                message: 'no category specified',
            }
        ],
        error: [],
    },
    song_family: {
        sel: '#song-family-input',
        value: el => el.val(),
        warn: [
            {
                f: _.identity,
                message: 'no song family specified',
            }
        ],
        error: [],
    },
};


function get_el (key) {
    return $(inputs[key].sel);
}


function get_val (key) {
    return inputs[key].value($(inputs[key].sel));
}


function attach_input_handlers () {
    _.each(inputs, (input, k) => {
        get_el(k).on('input', validate_input);
    });
}


function validate_input () {
    var warnings = [];
    var errors = [];
    _.map(inputs, (input, k) => {
        var val = get_val(k);
        _.each(input.warn, (w) => {
            if (!w.f(val)) {
                warnings.push(w.message);
            }
        });
        _.each(input.error, (e) => {
            if (!e.f(val)) {
                errors.push(e.message);
            }
        });
    });
    if (warnings.length) {
        $('#warnings').html(_.join(warnings, '<br>'));
        $('#warning-container').show();
    } else {
        $('#warning-container').hide();
    }
    if (errors.length) {
        $('#errors').html(_.join(errors, '<br>'));
        $('#error-container').show();
    } else {
        $('#error-container').hide();
    }
    return errors.length === 0;
}


function to_prefill (key, el_id, xs) {
    _.flow(
        fp.map(key),
        _.uniq,
        fp.map((c) => {
            $(el_id).append(`<option>${c}</option>`);
        })
    )(xs);
}


async function prefill_form () {
    return await fetch('/all/song')
        .then(response => response.json())
        .then(data => {
            to_prefill('category', '#categories', data);
            to_prefill('backing_tracks', '#backing-tracks', data);
            to_prefill('song_family', '#song-families', data);
        });
}


$(document).ready(init);


async function init () {
    await prefill_form();
    attach_input_handlers();

    var midi_el = get_el('midi_file');
    var info_el = $('#info');
    var warnings_el = $('#warnings');
    var errors_el = $('#errors');
    var canvas = document.getElementById('midi-canvas');
    var ctx = canvas.getContext('2d');
    var submit_btn = $('#upload-button');
    submit_btn.click(create_song);

    canvas.width = window.innerWidth * 2;
    canvas.height = 400 * 2;


    function clear_info () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        info_el.html('');
        warnings_el.html('');
        errors_el.html('');
    }


    function track_info_box (obj, track, idx) {
        var color = track_colors[idx];
        var tname = track_name(track);
        var name_info = '';
        if (_.startsWith(tname, 'relativepitch_')) {
            name_info = 'relative pitch';
        }
        if (_.startsWith(tname, 'nopitch_')) {
            name_info = 'no pitch';
        }
        info_el.append(`<div class="track-info" style="border: 1px solid ${color}">
            <div style="color: ${color}">track ${idx}</div>
            <div>name: <strong>${track_name(track)}</strong></div>
            <div>event_count: ${track_event_count(track)}</div>
            <div>duration (ticks): ${track_duration(track)}</div>
            <div>duration (seconds): ${track_duration_seconds(track, obj.timeDivision)}</div>
            <br>
            <em>${name_info}</em>
            <br>
        </div>`);
    }


    function draw_midi (obj, ctx, color) {
        var song_ticks = song_duration(obj.track);
        var pitch_height = canvas.height / 120;
        var to_x = ticks => (ticks / song_ticks) * canvas.width;
        var to_y = pitch => pitch_height * pitch;

        _.each(obj.track, (track, idx) => draw_midi_track(track, ctx, idx));


        function draw_midi_track (track, ctx, idx) {
            var playhead = 0;
            var notes = {};
            var color = track_colors[idx];
            ctx.fillStyle = color;
            _.each(track.event, event => {
                playhead += event.deltaTime;
                // note on and off
                if (event.type === 8 || event.type === 9) {
                    // cant trust there to be a correct number and order of on and off
                    // so do the following kind of weird thing
                    var pitch = event.data[0];
                    var was_on = _.get(notes, pitch, false);
                    if (was_on !== false) {
                        // if its in the notes map, then this is the end
                        var duration = playhead - was_on;
                        notes[pitch] = false;
                        // render on canvas
                        ctx.fillRect(to_x(was_on), to_y(pitch), to_x(duration), pitch_height);
                    } else {
                        // if not, then this is the beginning
                        notes[pitch] = playhead;
                    }
                }
            });
        }
    }

    // this attaches a change listener to the input object
    MidiParser.parse(midi_el[0], obj => {
        clear_info();
        validate_input();
        _.each(obj.track, (track, idx) => {
            //lint_track(track, idx);
            track_info_box(obj, track, idx);
        });
        draw_midi(obj, ctx);
        $('#generated-info').show();
    });
}


var track_events = fp.get('event');

var track_event_count = _.flow(track_events, fp.get('length'));

var track_name = _.flow(
    track_events,
    fp.filter({ metaType: 3 }),
    _.first,
    fp.get('data')
);

var track_duration = _.flow(track_events, fp.map('deltaTime'), _.sum);

var song_duration = _.flow(fp.map(track_duration), _.max);


function track_duration_seconds (track, time_div) {
    return (track_duration(track) / time_div).toFixed(2);
};


var track_colors = [
    'red',
    'green',
    'blue',
    'orange',
    'teal',
];


// for prefilling for dropdowns

function is_float (val) {
    var floatRegex = /^-?\d+(?:[.,]\d*?)?$/;
    if (!floatRegex.test(val)) {
        return false;
    }
    val = parseFloat(val);
    if (isNaN(val)) {
        return false;
    }
    return true;
}


function create_song () {
    if (!validate_input()) {
        // alert
        return;
    }

    var form_data = new FormData();
    _.each(inputs, (input, k) => {
        if (k !== 'backing_tracks') {
            form_data.append(k, get_val(k));
        }
    });
    _.each(get_val('backing_tracks'), (track) => {
        form_data.append(`backing_track_${track.name}`, track);
    });

    fetch('/admin/create_new_song', {
        method: 'POST',
        body: form_data,
    });
}


// input validators
