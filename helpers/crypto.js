const bcrypt = require("bcrypt");

module.exports = {
  hash_password: (password) => {
    const salt = bcrypt.genSaltSync(10);
    const hashed_password = bcrypt.hashSync(password, salt);
    return hashed_password;
  },

  compare_password: (password, hashed_password) => {
    b = bcrypt.compareSync(password, hashed_password);
    if (b) return true;
    else return false;
  },
};
