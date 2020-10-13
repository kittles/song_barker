var initial_viewport_height = window.innerHeight;
$(document).ready(() => {
    /* amateur hour */
    function wide_mode () {
        return document.body.offsetWidth > document.body.offsetHeight;
    }
    function aspect_ratio () {
        return document.body.offsetWidth / document.body.offsetHeight;
    }
    function set_container_scale () {
        var content_height = wide_mode() ? 1005 : 1158.84;
        var viewport_height = Math.min(window.innerHeight, initial_viewport_height);
        var vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
        var vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

        var scale = 1;

        if (wide_mode()) {
            scale = vh / content_height;
        } else {
            scale = vw / 700;
            scale = Math.min(scale, 1);
        }

        //console.log('scale:', scale, 'vw:', vw, 'vw / scale:', vw / scale);

        // if the scale would cut off the card
        if ((vw / scale) < 656) {
            //console.log('scale adjusted to fit whole card width');
            scale = vw / 656;
        }


        //console.log(vw, vh, viewport_height, content_height, scale);
        $('#container').css({
            transform: `scale(${scale})`,
        });
        if (wide_mode()) {
            $('#container').css({
                position: 'relative',
                top: `${scale * 60}px`,
            });
        } else {
            // aspect ratio determines the top offset
            var top_adjust = (aspect_ratio() - 0.60) * 250;
            if (aspect_ratio() > 0.72) {
                top_adjust += 60 * scale;
            }
            console.log('top adjust', top_adjust);
            $('#container').css({
                position: 'relative',
                top: `${top_adjust}px`,
            });
        }
        console.log(aspect_ratio());
    }
    set_container_scale();
    $(window).on('resize', _.debounce(set_container_scale, 125));
});
