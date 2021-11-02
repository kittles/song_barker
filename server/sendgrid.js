const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

exports.testMe = function  () {
    return "test success";
}

/**
 * sendmail -- interface to sendgrid email api
 * input -- msg with following format
const msg = {
    to: 'jeff@magikarts.com', // Change to your recipient
    from: 'no-reply@turboblasterunlimited.com', // Change to your verified sender
    subject: 'Sending with SendGrid is Fun',
    text: 'and easy to do anywhere, even with Node.js',
    html: '<strong>and easy to do anywhere, even with Node.js</strong>',
} 
 */



exports.sendmail = function(to, from, subject, html) {
    const msg = {
        to: to, 
        from: 'no-reply@turboblasterunlimited.com', 
        subject: subject,
        html: html
    } 
    result = "";
    sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
            result = "Success"
        })
        .catch((error) => {
            console.error(error)
            result = error
        })
    return result;
}

// sgMail
//     .send(msg)
//     .then(() => {
//         console.log('Email sent')
//     })
//     .catch((error) => {
//         console.error(error)
//     })