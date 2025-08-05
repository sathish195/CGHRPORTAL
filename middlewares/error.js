// async function handle500Errors(err, req, res, next) {
//         if (err.status === 404) {
//             // Handle 404 errors
//             res.status(404).json({
//                 error: err,
//                 message: 'The requested resource could not be found.'
//             });
//         } else if (err.status >= 500 && err.status < 600) {
//             // Handle 500 errors
//             console.error('Internal server error:', err);
//             res.status(500).json({
//                 error: err,
//                 message: 'Something went wrong.'
//             });
//         } else {
//             // Pass the error to the next middleware if it's not a 404 or 500 error
//             next(err);
//         }
//     }
//     console.log("Error processing");

// module.exports={handle500Errors}

module.exports = function (err, req, res, next) {

  // console.log(err.message,"errormsg----->");

  res.status(500).send(err.message);
};
