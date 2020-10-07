var initial_viewport_height = window.innerHeight;
$(document).ready(() => {
    function wide_mode () {
        return document.body.offsetWidth > document.body.offsetHeight;
    }
    function set_container_scale () {
        var content_height = wide_mode() ? 1095 : 1158.84;
        var viewport_height = Math.min(window.innerHeight, initial_viewport_height);
        $('#container').css({
            transform: `scale(${viewport_height / content_height})`,
        });
    }
    set_container_scale();
    $(window).on('resize', _.debounce(set_container_scale, 125));
});
