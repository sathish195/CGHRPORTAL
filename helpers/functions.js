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
  },
  calculate_leave_days:(from_date,to_date) => {
      // Parse the date strings into Date objects
      const date1 = new Date(from_date);
      const date2 = new Date(to_date);
  
      // Calculate the difference in time
      const timeDifference = Math.abs(date2 - date1);
  
      // Convert time difference from milliseconds to days
      const dayDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  
      return dayDifference;
  }
  

};
