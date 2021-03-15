# Neappoli Backend - Firebase Functions
Back-end service for the Neappoli app to handle requests submissions and user notifications. 

To make it work, you need to download the service private keys for the Production and Development respectively. Name them `firebase-service-account-DEV.json` and `firebase-service-account-PROD.json` and put them under `functions/`.

The API documentation is found on this repository's wiki.

## Getting started

0. Create a `.env` file under `functions/` with the contents of `.env.template`, and populate all fields (PROD variables optional).
1. You need to add the development environment to the project, as mentioned above. To do so, create a new firebase project, then go to projects settings > service accounts > tick Node.js and click the **Generate new private key** button. Rename the file `firebase-service-account-DEV.json` and save it under `functions/`.
2. Install packages with `yarn` inside `functions/`
3. Using the Firebase CLI, run `firebase use <project-id>` where `<project-id>` is the ID of the Firebase project you created in step 1.
4. Run `firebase serve`

## Debugging

To debug in VSCode, run `firebase emulators:start --inspect-functions` in the terminal, then the `Attach` debug configuration in VSCode.

## Contributing

Many thanks to [Kyle](https://github.com/kQuintal), [Filip](https://github.com/IMFIL) and [Anthony](https://github.com/anthonyanader) for their past contributions!

This repo can definitely use an update so **PRs are more than welcome**! ❤️❤️❤️

Currently, the only supported city is the city of Ottawa, but of course, if someone is interested in adding their city, feel free to reach out to us at hello@neappoli.com or creating PRs :)

