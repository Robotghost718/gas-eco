/* global
ErrorFormCollision_
ErrorFormDataInvalid_
ErrorFormInvalid_
getUser_
Form_
DateUtils
Inventory_
Item_
Stack_
Student_
*/
/* ********* GLOBAL VARIABLES *********** */
var index = {
  bookings: {
    SHEET_ID: "1zl4FBglYgCdR_FMdfbIQOOpnt9b8TwgnjxzRwcekPrY",
    SHEET_NAME: "Daily Booking Data",
  },
  forms: {
    SHEET_ID: "1yMDg9w-vjZxeOYgES-XsicoWp9VvjV3xqCmdZhAyNI4",
    SHEET_NAME: "Forms",
    REJECTED_NAME: "Rejected",
    ARCHIVE_NAME: "Archive",
  },
  items: {
    SHEET_ID: "1XYu7fGgmuZ3DTa8y2JNbwwKuHw8_XNJ4VEwgZCf_UME",
    SHEET_NAME: "Inventory",
    MAKE: 3,
    MODEL: 4,
    DESCRIPTION: 5,
    ID: 7,
    BARCODE: 8,
    HISTORY: 11,
    CHECKED_OUT: 13,
  },
  students: {
    SHEET_ID: "126XmGFPuNPJpJPF7aKNFSeaOAgvFNerMYdnFg2F7YAA",
    SHEET_NAME: "Students",
    SIGNATURE_SHEET_NAME: "Validation",
    ID: 0,
    NAME: 1,
    NETID: 2,
    CONTACT: 3,
    SIGNATURE: 4,
  },
};

/**
 * TODO debug and reactivate
 * turned off!
 */
/* exported checkItems_ */
function checkItems_(form) {
  var sheet = SpreadsheetApp.openById(index.items.SHEET_ID).getSheetByName(
    index.items.SHEET_NAME
  );
  var data = sheet.getDataRange().getValues();
  form.items.forEach(function (item) {
    var id = item.id ? "id" : "barcode";
    var requestingCheckout = item.checkOut && !item.checkIn && !item.checkedOut;
    var requestingCheckIn = item.checkIn && item.checkedOut;
    if (!item.isSerialized()) {
      if (requestingCheckout) {
        item.checkedOut = true;
      }
      if (requestingCheckIn) {
        item.checkedOut = false;
      }
      return;
    }
    var row = data.findRowContaining(
      item[id],
      index.items[id.toUpperCase()],
      true
    );
    if (row === undefined) {
      throw new ErrorFormInvalid_(
        item.description + " " + item.id + " cannot be found."
      );
    }
    if (requestingCheckout) {
      if (!data[row][index.items.CHECKED_OUT]) {
        sheet.getRange(row + 1, index.items.CHECKED_OUT + 1).setValue(true);
        item.checkedOut = true;
        return;
      }
      throw new ErrorFormInvalid_(
        item.description + item.id + " is already checked out"
      );
    }
    if (requestingCheckIn) {
      if (data[row][index.items.CHECKED_OUT]) {
        sheet.getRange(row + 1, index.items.CHECKED_OUT + 1).clear();
        item.checkedOut = false;
        return;
      }
      throw new ErrorFormInvalid_(
        item.description + item.id + " is already checked in"
      );
    }
  });
}

/* ********* GETTERS *********** */

/* exported getAllItems_ */
function getAllItems_() {
  var sheet = SpreadsheetApp.openById(index.items.SHEET_ID).getSheetByName(
    index.items.SHEET_NAME
  );
  var data = sheet.getDataRange().getValues();
  data.shift();
  var items = new Inventory_();
  var itemIdregex = /[A-Za-z]+-[A-Za-z0-9]+/; // one or more letters, hyphen, one or more digits/letters
  var itemBarcode = /^\d+$/;
  data.forEach(function (itemData) {
    if (
      itemBarcode.test(itemData[index.items.BARCODE]) ||
      itemIdregex.test(itemData[index.items.ID])
    ) {
      items.push(new Item_(itemData));
    }
  });
  return items;
}

/* exported getAllStudents_ */
function getAllStudents_() {
  var sheet = SpreadsheetApp.openById(index.students.SHEET_ID).getSheetByName(
    index.students.SHEET_NAME
  );
  var data = sheet.getDataRange().getValues();
  data.shift();
  var students = [];
  data.forEach(function getArrayOfStudents(studentData) {
    students.push(new Student_(studentData));
  });
  return students;
}

/* exported getArchivedForms_ */
function getArchivedForms_(dateRangeJSON) {
  var dateRange = JSON.parse(dateRangeJSON); // dateRange.start, dateRange.end
  dateRange.start = DateUtils.parseFormattedDate(dateRange.start);
  dateRange.end = DateUtils.parseFormattedDate(dateRange.end);
  var sheet = SpreadsheetApp.openById(index.forms.SHEET_ID).getSheetByName(
    index.forms.ARCHIVE_NAME
  );
  var data = sheet.getDataRange().getValues(),
    forms = new Stack_();
  data.shift();
  data.forEach(function (row) {
    forms.push(new Form_(row).setHash());
  });
  forms = forms.filter(function (form) {
    var start = DateUtils.parseFormattedDate(form.startTime);
    var end = DateUtils.parseFormattedDate(form.endTime);
    return (
      start.getTime() >= dateRange.start.getTime() &&
      end.getTime() <= dateRange.end.getTime()
    );
  });
  return forms;
}

/** @return {[]} an array of Forms */
/* exported getOpenForms_ */
function getOpenForms_() {
  var formsSpreadSheet = SpreadsheetApp.openById(index.forms.SHEET_ID);
  var formsSheet = formsSpreadSheet.getSheetByName(index.forms.SHEET_NAME);
  var data = formsSheet.getDataRange().getValues(),
    forms = new Stack_();
  // don't shift and start at row 1 to allow Sheet manipulation, if required
  for (var row = 1; row < data.length; ++row) {
    try {
      forms.push(new Form_(data[row]).setHash());
    } catch (error) {
      if (error instanceof ErrorFormDataInvalid_) {
        var rejectedSheet = formsSpreadSheet.getSheetByName(
          index.forms.REJECTED_NAME
        );
        rejectedSheet.appendRow(data[row]);
        formsSheet.deleteRow(row + 1);
        data.splice(row, 1);
      } else {
        throw error;
      }
    }
  }
  return forms;
}

/* ********* WRITERS *********** */

/* exported writeCodabar_ */
function writeCodabar_(netId, codabar) {
  var sheet = SpreadsheetApp.openById(index.students.SHEET_ID).getSheetByName(
    index.students.SHEET_NAME
  );
  var data = sheet.getDataRange().getValues();
  var i = data.findRowContaining(netId, index.students.NETID, true);
  if (typeof i == "undefined") {
    throw new Error("Could not write codabar for " + netId);
  }
  sheet.getRange(i + 1, index.students.ID + 1).setValue(codabar);
}

/**
 * collisions result in rejected forms which are written to their own
 *   sheet for safekeeping.  Rejected forms are stored with an additional
 *   column containing the email address of the user whose form was rejected.
 *   Users can access their own rejected forms to view and delete them.
 */
/* exported writeRejectedFormToSheet_ */
function writeRejectedFormToSheet_(form) {
  var ss = SpreadsheetApp.openById(index.forms.SHEET_ID);
  var formSheet = ss.getSheetByName(index.forms.REJECTED_NAME);
  var values = form.getAsArray();
  values.push(getUser_());
  formSheet.appendRow(values);
}

/* exported writeFormToSheet_ */
function writeFormToSheet_(form, closeAndArchive) {
  var ss = SpreadsheetApp.openById(index.forms.SHEET_ID);
  var formSheet = ss.getSheetByName(index.forms.SHEET_NAME);
  var data = formSheet.getDataRange().getValues();
  var id = form.id;
  var values = form.getAsArray();

  if (!id) {
    // create
    values[0] = form.createId();
    formSheet.appendRow(values);
    // see TODO below for more info on why this is necessary
    return new Form_(
      formSheet.getRange(formSheet.getLastRow(), 1, 1, 13).getValues()[0]
    ).setHash();
  }

  // Note: do not shift data
  var index_ = data.findRowContaining(id, 0, true);
  if (typeof index_ == "undefined") {
    throw "could not find form " + form;
  }
  var row = index_ + 1;

  // Do not allow write unless user was editing most
  // recent form.  Use try/catch around call to this function
  // to handle this error
  var storedForm = new Form_(data[index_]).setHash();
  if (form.hash != storedForm.hash) {
    throw new ErrorFormCollision_(storedForm, form);
  }

  if (closeAndArchive) {
    var archive = ss.getSheetByName(index.forms.ARCHIVE_NAME);
    archive.appendRow(values);
    // 'Close' form by deleting from active sheet
    formSheet
      .getRange(row, 1, 1, 13)
      .deleteCells(SpreadsheetApp.Dimension.ROWS);
    return;
  }

  var column = 1,
    numRows = 1,
    numColumns = 13,
    range;
  range = formSheet.getRange(row, column, numRows, numColumns);
  range.setValues([values]);
  // TODO this retrieves the correct hash.  Trying to skip a step and hash the
  //   `values` variable directly comes up with a different hash due to
  //   Sheet converting numbers and dates. Consider plain text format to eliminate
  //   the extra retrieval step.
  return new Form_(range.getValues()[0]).setHash();
}

/* exported writeSignatureToSheet_ */
function writeSignatureToSheet_(request) {
  var sheet = SpreadsheetApp.openById(index.students.SHEET_ID).getSheetByName(
    index.students.SHEET_NAME
  );
  var data = sheet.getDataRange().getValues();
  var i = data.findRowContaining(request.id, index.students.NETID, true);
  if (typeof i == "undefined") {
    throw "Could not match " + request.id;
  }
  sheet.getRange(i + 1, index.students.SIGNATURE + 1).setValue(request.dataURL);
}

/* exported startSignature_ */
// TODO don't hardcode A1; just append a row with the Net ID
function startSignature_(netid) {
  var sheet = SpreadsheetApp.openById(index.students.SHEET_ID).getSheetByName(
    index.students.SIGNATURE_SHEET_NAME
  );
  sheet.getRange("A1").setValue(netid);
}

/* exported clearSignatureValidation_ */
// TODO don't hardcode A1; search for the Net ID to clear off
function clearSignatureValidation_() {
  var sheet = SpreadsheetApp.openById(index.students.SHEET_ID).getSheetByName(
    index.students.SIGNATURE_SHEET_NAME
  );
  sheet.getRange("A1").clear();
}
