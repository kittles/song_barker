/* global _, $ */
var fp = _.noConflict(); // lodash fp and lodash at the same time

// NOTE: use googleapis.com not storage.cloud... for cors issues
var audio_url = 'https://storage.googleapis.com/k9karaoke_cards/sample_audio.aac'

$(document).ready(() => {
    $(document).click(() => {
        var audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
        $('body').html(`<audio crossorigin="anonymous" src="${audio_url}"></audio>`);
        var audio_el = document.querySelector('audio');
        console.log(audio_el);
        var track = audio_ctx.createMediaElementSource(audio_el);
        track.connect(audio_ctx.destination);
        var duration = 10.125 // should come from template var
        var frames = _.range(Math.floor(duration * 60));
        console.log(frames.length);
        audio_el.play();

        function loop () {
            var pct = audio_el.currentTime / duration
            var frame_idx = Math.floor(frames.length * pct);
            console.log(frame_idx);
            requestAnimationFrame(loop);
        }
        loop();
    });


    // animation prep
    // take mouth positions, other timestamped events,
    // compile into a ticker

    // keep animation in sync with audio via checking playback timer vs frame idx
});
