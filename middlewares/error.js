async function handle500Errors(err, req, res, next) {
        if (err.Status === 404) {
            // Handle 404 errors
            res.status(404).json({
                error: err,
                message: 'The requested resource could not be found.'
            });
        } else if (err.Status >= 500 && err.Status < 600) {
            // Handle 500 errors
            console.error('Internal server error:', err);
            res.status(500).json({
                error: err,
                message: 'Something went wrong.'
            });
        } else {
            // Pass the error to the next middleware if it's not a 404 or 500 error
            next(err);
        }
    }

module.exports={handle500Errors}