const Mailchimp = require("mailchimp-api-v3");
const crypto = require("crypto");
const helpers = require("./helpers");
const constants = require("./constants");

const mailchimpListID = process.env.MAILCHIMP_LIST_ID;
const mailchimpApiKey = process.env.MAILCHIMP_API_KEY;
const mailchimp = new Mailchimp(mailchimpApiKey);

const mailjet = require("node-mailjet").connect(
  constants.MAILJET_PUBLIC_KEY,
  constants.MAILJET_PRIVATE_KEY
);

exports.mailchimpUpdateSubscription = (req, res, usersRef) => {
  if (req.method === "GET") {
    console.log("Validator request");
    res.status(204).send();
    return;
  } else if (req.method !== "POST") {
    console.log("Unsupported request");
    res.status(405).send({ Error: "Method not allowed" });
    return;
  }

  // POST request
  const data = req.body.data;
  if (!data) {
    const msg = "The data object must be present in the request";
    console.error(msg);
    res.status(400).send(msg);
    return;
  }

  const targetEmail = req.body.data.email;
  if (!targetEmail) {
    const msg = 'The "data[email]" key value cannot be empty.';
    console.error(msg);
    res.status(400).send(msg);
    return;
  }

  const subscriptionType = req.body.type;
  if (
    !(subscriptionType === "subscribe" || subscriptionType === "unsubscribe")
  ) {
    const msg = "The type must either be subscribe or unsubscribe.";
    console.error(msg);
    res.status(400).send(msg);
    return;
  }
  const wantsSubscription = subscriptionType === "subscribe";
  const givenUserId = req.body.userId;
  const calledFromApp = givenUserId !== undefined;

  // Only the app calls this with the subscribe type
  if (calledFromApp) {
    handleSubscribeUpdateAppCall(res, usersRef, givenUserId, wantsSubscription);
    // Subscribe/unsubscribe the user to the mailchimp list
    handleMailchimpRegistration(targetEmail, wantsSubscription);
  } else {
    // API is called by mailchimp
    handleSubscribeUpdateMailchimpCall(
      res,
      usersRef,
      wantsSubscription,
      targetEmail
    );
  }
};

// Returns true if email has been sent successfully
exports.sendWelcomeEmail = (user) => {
  if (user === null) {
    console.error("User was null");
    return false;
  }

  return sendEmail(user.email, 774390, "Welcome to Neappoli!", {})
    .then((isSent) => {
      if (isSent) {
        console.log("Welcome email successfully sent to " + user.email);
      }
      return isSent;
    })
    .catch((err) => {
      console.error(err);
      return false;
    });
};

// The `submissionDetails` object looks like this:
// {
// 	userId: localParams.user_id,
// 	userEmail: localParams.email,
// 	srId: cityResponseObject['service_request_id'],
// 	addressLine: localParams.address_string,
// 	photoURL: localParams.media_url,
// 	description: localParams.description,
// 	date_time: timeOfSubmission
// }
exports.sendConfirmationEmail = (submissionDetails) => {
  if (submissionDetails === null) {
    console.error("submissionDetails was null");
    return;
  }

  return sendEmail(
    submissionDetails.userEmail,
    775150,
    "Service Request Submitted!",
    submissionDetails
  )
    .then((isSent) => {
      if (isSent) {
        console.log(
          "Confirmation email successfully sent to " +
            submissionDetails.userEmail +
            ", regarding the SR with ID " +
            submissionDetails.srId
        );
      }
      return isSent;
    })
    .catch((err) => {
      console.error(err);
      return false;
    });
};

// The `submissionDetails` object looks like this:
// {
//     "description": "",
//     "srId": "",
//     "date_open": "",
//     "date_close": "",
//     "addressLine": "",
//     "photoURL": "",
//     "userEmail": ""
// }
exports.sendClosedSREmail = (submissionDetails) => {
  if (submissionDetails === null) {
    console.error("SubmissionDetails was null");
    return;
  }

  return sendEmail(
    submissionDetails.userEmail,
    775885,
    "Service Request Closed!",
    submissionDetails
  )
    .then((isSent) => {
      if (isSent === true) {
        console.log(
          "Closed issue email successfully sent to " +
            submissionDetails.userEmail
        );
      } else {
        console.error(
          "Could not send a closed issue email notice, without any special error"
        );
      }
      return isSent;
    })
    .catch((err) => {
      console.error(err);
      return false;
    });
};

function sendEmail(emailTo, templateID, subjectLine, variables) {
  return mailjet
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: {
            Email: "hello@neappoli.com",
            Name: "The Neappoli Team",
          },
          To: [
            {
              Email: emailTo,
            },
          ],
          TemplateID: templateID,
          TemplateLanguage: true,
          Subject: subjectLine,
          Variables: variables,
          TemplateErrorReporting: {
            Email: "hello@neappoli.com",
            Name: "Neappoli Test",
          },
        },
      ],
    })
    .then((result) => {
      if (result.body.Messages[0].Status === "success") {
        return true;
      }
      return false;
    });
}

function handleMailchimpRegistration(email, wantsSubscription) {
  var userMailchimpHash = crypto
    .createHash("md5")
    .update(email.toLowerCase())
    .digest("hex");
  const listPath =
    "/lists/" + mailchimpListID + "/members/" + userMailchimpHash;

  const subscriptionStatus = wantsSubscription ? "subscribed" : "unsubscribed";
  const params = {
    email_address: email,
    status_if_new: subscriptionStatus,
    status: subscriptionStatus,
  };

  mailchimp
    .put(listPath, params)
    .then((results) => {
      console.log(
        "Successfully updated user " +
          email +
          " in MailChimp with subscription status: " +
          wantsSubscription
      );
      return;
    })
    .catch((error) => {
      console.error(
        "Error: could not update user " +
          email +
          " in MailChimp with subscription status: " +
          wantsSubscription
      );
      console.error(error);
    });
}

function handleSubscribeUpdateAppCall(
  res,
  usersRef,
  givenUserId,
  wantsSubscription
) {
  usersRef
    .child(givenUserId)
    .once("value")
    .then((snapshot) => {
      if (!snapshot.exists()) {
        throw Error("User with ID " + givenUserId + " does not exist.");
      }

      return usersRef
        .child(givenUserId)
        .child("profile")
        .update({
          isNewsletterSubscribed: wantsSubscription,
        })
        .then(() => {
          res.status(204).send();
          return;
        })
        .catch((err) => {
          console.error("Error updating child ID " + givenUserId + ": " + err);
          res
            .status(400)
            .send(
              "Error updating child ID " +
                givenUserId +
                ". Maybe the UserID is wrong?"
            );
        });
    })
    .catch((err) => {
      console.error("" + err);
      res.status(400).send("" + err);
    });

  return;
}

function handleSubscribeUpdateMailchimpCall(
  res,
  usersRef,
  wantsSubscription,
  targetEmail
) {
  var requestProcessed = false;

  usersRef
    .once("value")
    .then((snapshot) => {
      if (!snapshot.exists()) {
        throw Error("Users node does not exist!");
      }

      var allRequests = [];

      for (const userID in snapshot.val()) {
        const prom = helpers
          .getUserObject(usersRef, userID)
          .then((usrObject) => {
            if (usrObject === null) return;
            if (usrObject.profile.email === targetEmail) {
              if (
                usrObject.profile.isNewsletterSubscribed !== wantsSubscription
              ) {
                usersRef.child(userID).child("profile").update({
                  isNewsletterSubscribed: wantsSubscription,
                });

                handleMailchimpRegistration(targetEmail, wantsSubscription);
              }
              requestProcessed = true;
            }
            return;
          })
          .catch((err) => {
            console.error(err);
          });

        allRequests.push(prom);
      }
      return Promise.all(allRequests);
    })
    .then(() => {
      if (requestProcessed) {
        res.status(200).send("Success!");
      } else {
        res.status(400).send("The given email was not found.");
      }
      return;
    })
    .catch((err) => {
      console.error("Error when called by Mailchimp: " + err);
      res.status(500).send(err);
    });
}
