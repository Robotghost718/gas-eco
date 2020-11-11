/* global ErrorFormDataInvalid_ ErrorFormInvalid_ Inventory_ DateUtils */
/* exported Form_ */
function Form_(form) {
  var dataIndex = {
    ID: 0,
    START_TIME: 1,
    END_TIME: 2,
    LOCATION: 3,
    BOOKING_ID: 4,
    BOOKED_STUDENTS: 5,
    CONTACT: 6,
    PROJECT: 7,
    TAPE: 8,
    OVERNIGHT: 9,
    STUDENTS: 10,
    ITEMS: 11,
    NOTES: 12,
  };
  if (Array.isArray(form)) {
    try {
      this.bookedStudents = form[dataIndex.BOOKED_STUDENTS] || "";
      this.bookingId = form[dataIndex.BOOKING_ID] || "";
      this.contact = form[dataIndex.CONTACT] || "";
      this.endTime = DateUtils.getFormattedDate(form[dataIndex.END_TIME]) || "";
      this.id = form[dataIndex.ID] || "";
      this.location = form[dataIndex.LOCATION] || "";
      this.project = form[dataIndex.PROJECT] || "";
      this.overnight = form[dataIndex.OVERNIGHT] || false;
      this.startTime =
        DateUtils.getFormattedDate(form[dataIndex.START_TIME]) || "";
      this.tape = form[dataIndex.TAPE] || false;
      this.hash = "";

      // Dynamic properties
      this.items = new Inventory_(JSON.parse(form[dataIndex.ITEMS]));
      this.notes = JSON.parse(form[dataIndex.NOTES]) || []; // []Note
      this.students = JSON.parse(form[dataIndex.STUDENTS]) || []; // []Student
    } catch (error) {
      throw new ErrorFormDataInvalid_(form);
    }
  } else {
    // Static properties
    this.bookedStudents = form.bookedStudents || "";
    this.bookingId = form.bookingId || "";
    this.contact = form.contact || "";
    this.endTime = form.endTime || "";
    this.id = form.id || "";
    this.location = form.location || "";
    this.project = form.project || "";
    this.overnight = form.overnight || false;
    this.startTime = form.startTime || "";
    this.tape = form.tape || false;
    this.hash = form.hash || "";

    // Dynamic properties
    this.items =
      form.items instanceof Inventory_
        ? form.items
        : new Inventory_(form.items);
    this.notes = form.notes || []; // []Note
    this.students = form.students || []; // []Student
  }
}

Form_.prototype.createId = function () {
  this.id = "" + Date.now();
  return this.id;
};

Form_.prototype.setHash = function (hash) {
  if (hash) {
    this.hash = hash;
  } else {
    this.hash = "";
    this.hash = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.MD2,
        JSON.stringify(this)
      )
    );
  }
  return this;
};

Form_.prototype.archive = function () {
  var items = this.items.archive();
  var copy = Object.assign({}, this);
  copy.items = items;
  return copy;
};

Form_.prototype.stringify = function () {
  var items = this.items.archive();
  var copy = Object.assign({}, this);
  copy.items = items;
  return JSON.stringify(copy);
};

Form_.prototype.getAsArray = function () {
  return [
    this.id,
    this.startTime,
    this.endTime,
    this.location,
    this.bookingId,
    this.bookedStudents,
    this.contact,
    this.project,
    this.tape,
    this.overnight,
    JSON.stringify(this.students),
    this.items.stringify(),
    JSON.stringify(this.notes),
  ];
};

Form_.prototype.isAllGearReturned = function () {
  return this.items.every(function (item) {
    if (item.checkOut) {
      return item.checkIn || item.missing;
    }
    return true;
  });
};

Form_.prototype.isCheckOutStudentOk = function () {
  return this.hasActiveStudent() || this.isAllGearReturned();
};

Form_.prototype.isNoShow = function () {
  if (!this.id) {
    return false;
  }
  var gracePeriod = 30, // minutes
    start = new Date(this.startTime),
    now = Date.now();

  start.setMinutes(start.getMinutes() + gracePeriod);

  var checkedIn = function (student) {
    return student.checkIn;
  };
  if (now > start.getTime() && !this.students.some(checkedIn)) {
    return true;
  }
  return false;
};

Form_.prototype.isReadyToClose = function () {
  if (!this.isCheckOutStudentOk) {
    return false;
  }
  var checkedIn = function (student) {
    return student.checkIn;
  };
  var checkedOutOrLeft = function (student) {
    if (student.checkIn) {
      return student.checkOut || student.left;
    }
    return true;
  };
  return this.students.some(checkedIn) && this.students.every(checkedOutOrLeft);
};

Form_.prototype.isThereAnActiveStudent = function () {
  var activeStudents = this.students.reduce(function (count, student) {
    if (student.checkIn && !(student.checkOut || student.left)) {
      return count + 1;
    }
    return count;
  }, 0);
  return activeStudents > 1;
};

Form_.prototype.validate = function () {
  if (this.items) {
    // TODO validate with the actual inventory
    this.items.forEach(function (item) {
      var requestingCheckout =
        item.checkOut && !item.checkIn && !item.checkedOut;
      if (requestingCheckout) {
        item.checkedOut = true;
      }
      var requestingCheckIn = item.checkIn && item.checkedOut;
      if (requestingCheckIn) {
        item.checkedOut = false;
      }
    });
  }
  var required = [
    { label: "start time", value: this.startTime },
    { label: "end time", value: this.endTime },
    { label: "location", value: this.location },
    { label: "students", value: this.students },
  ];
  var test = function (field) {
    if (field.value.length < 1) {
      throw new ErrorFormInvalid_(
        "Invalid " + field.label + ": " + field.value
      );
    }
    return true;
  };
  required.every(test);
};
