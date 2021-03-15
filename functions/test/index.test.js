// You can run these unit tests by running "npm test" inside the functions directory.
// To setup, check https://firebase.google.com/docs/functions/unit-testing
// Run `firebase functions:config:get > .runtimeconfig.json` under functions/ to make firebase.config() available for the testing environment. That file is ignore in git.

// Chai is a commonly used library for creating unit test suites. It is easily extended with plugins.
const chai = require("chai");
const assert = chai.assert;

// Sinon is a library used for mocking or verifying function calls in JavaScript.
const sinon = require("sinon");

// Require firebase-admin so we can stub out some of its methods.
// const admin = require('firebase-admin');

const projectConfig = {
  authDomain: process.env.DEV_AUTH_DOMAIN,
  databaseURL: process.env.DEV_DB_URL,
  projectId: process.env.DEV_PROJECT_ID,
  storageBucket: process.env.DEV_STORAGE_BUCKET,
  messagingSenderId: process.env.DEV_MESSAGING_SENDER_ID,
};

// Require and initialize firebase-functions-test. Since we are not passing in any parameters, it will
// be initialized in an "offline mode", which means we have to stub out all the methods that interact
// with Firebase services.
const test = require("firebase-functions-test")(
  projectConfig,
  "firebase-service-account-DEV.json"
);

describe("Cloud Functions", () => {
  let myFunctions, adminInitStub, emailModule;

  before(() => {
    // If index.js calls admin.initializeApp at the top of the file,
    // we need to stub it out before requiring index.js. This is because the
    // functions will be executed as a part of the require process.
    // Here we stub admin.initializeApp to be a dummy function that doesn't do anything.
    // adminInitStub = sinon.stub(admin, 'initializeApp');
    // Now we can require index.js and save the exports inside a namespace called myFunctions.
    myFunctions = require("../index");
    emailModule = require("../fb_functions/emails");
  });

  after(() => {
    // Restore admin.initializeApp() to its original method.
    // adminInitStub.restore();
    // Do other cleanup tasks.
    test.cleanup();
  });

  describe("Send welcome email", () => {
    it("Should send an email to hello@neappoli.com", (done) => {
      const oUser = {
        email: "hello@neappoli.com",
      };

      // Wrap the sendWelcomeEmail function
      const wrapped = test.wrap(myFunctions.sendWelcomeEmail);
      wrapped(oUser)
        .then((isSent) => {
          assert.equal(isSent, true);
          done();

          return true; // to pass linting
        })
        .catch((err) => {
          assert.fail(0, 1, err);
        });
    });
  });

  describe("Send issue submitted confirmation email", () => {
    it("Should send a confirmation email to hello@neappoli.com", (done) => {
      const vars = {
        userId: "zUHigKkU1lbpN98tk0Kq0M8swVn2",
        userEmail: "hello@neappoli.com",
        srId: "123456789",
        addressLine: "150 Louis-Pasteur, Ottawa",
        photoURL: "",
        description: "the hard thing about hard things",
        date_time: "27th of April, 2018 at 7pm",
      };

      emailModule
        .sendConfirmationEmail(vars)
        .then((isSent) => {
          assert.equal(isSent, true);
          done();

          return true; // pass linting
        })
        .catch((err) => {
          assert.fail(0, 1, err);
        });
    });
  });

  describe("Send issue closed email", () => {
    it("Should send an issue closed email notification to hello@neappoli.com", (done) => {
      const vars = {
        userEmail: "hello@neappoli.com",
        srId: "123456789",
        addressLine: "150 Louis-Pasteur, Ottawa",
        photoURL:
          "https://pbs.twimg.com/profile_images/1027588804104863744/qnTBASe6_400x400.jpg",
        description: "shoe dog",
        date_open: "27th of April, 2018 at 7pm",
        date_close: "29th of April, 2018 at 9pm",
      };

      emailModule
        .sendClosedSREmail(vars)
        .then((isSent) => {
          assert.equal(isSent, true);
          done();

          return true; // pass linting
        })
        .catch((err) => {
          assert.fail(0, 1, err);
        });
    });
  });
});
