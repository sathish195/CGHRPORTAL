const crypto = require("crypto");

module.exports = {
  get_random_string: (str, length, pre_append = false) => {
    if (str === "0")
      return crypto
        .randomBytes(Number(length / 2))
        .toString("hex")
        .toUpperCase();
    else if (pre_append) {
      return (
        str +
        crypto
          .randomBytes(Number(length / 2))
          .toString("hex")
          .toUpperCase()
      );
    }
    return (
      crypto
        .randomBytes(Number(length / 2))
        .toString("hex")
        .toUpperCase() + str
    );
  }};