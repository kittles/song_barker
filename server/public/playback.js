$('document').ready(() => {
    //$('#submit').click(async () => {
    //    var filename = $('#filename').val();
    //    var response;
    //    try {
    //        response = await $.ajax({
    //            url: '/playback_url',
    //            type: 'post',
    //            data: JSON.stringify({
    //                filename: filename,
    //            }),
    //            headers: {
    //               'Content-type': 'application/json', 
    //            },
    //            dataType: 'json',
    //        });
    //        console.log(response);
    //    } catch (err) {
    //        console.log(err);
    //    }
    //    $('#player').attr('src', response.url);
    //});
    $('#submit').click(async () => {
        var url = $('#filename').val();
        $('#player').attr('src', url);
    });
});
