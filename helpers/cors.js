const cors = require('cors');

module.exports = (app) => {
  app.use(cors({ origin: '*' ,methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'}));
  console.log("allowed cors origins");
};