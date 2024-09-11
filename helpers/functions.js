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
  calculate_leave_days :(from_date, to_date) => {
    // Parse the date strings into Date objects
    const date1 = from_date;
    const date2 = to_date;

    // Ensure the start date is before the end date
    if (date1 > date2) {
        throw new Error('Start date must be before or equal to end date');
    }

    // Calculate the difference in time, inclusive of both start and end dates
    const timeDifference = date2 - date1;
    
    // Convert time difference from milliseconds to days and add 1 to include both endpoints
    const dayDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)) + 1;

    return dayDifference;
},
update_status:(leave_status_up)=>{


}
  

};
