var initial_viewport_height = window.innerHeight;
$(document).ready(() => {
    function set_container_scale () {
        var content_height = 1308.84
        var viewport_height = Math.min(window.innerHeight, initial_viewport_height);
        $('#container').css({
            transform: `scale(${viewport_height / content_height})`,
        });
    }
    set_container_scale();
    $(window).on('resize', _.debounce(set_container_scale, 125));
});
