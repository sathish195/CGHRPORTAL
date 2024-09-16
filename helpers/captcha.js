
// const request = require('request');


// app.post('/captcha', (req, res) => {
//   const response_key = req.body['g-recaptcha-response'];
//   const secret_key = '<YOUR_SECRET_KEY>'; 
//   const url = `https://www.google.com/recaptcha/api/siteverify`;

//   const options = {
//     url: url,
//     form: {
//       secret: secret_key,
//       response: response_key
//     },
//     json: true 
//   };

//   request.post(options, (error, response, body) => {
//     if (error) {
//       return res.send({ response: 'Failed' });
//     }

//     if (body.success) {
//       return res.send({ response: 'Successful' });
//     } else {
//       return res.send({ response: 'Failed' });
//     }
//   });
// });


