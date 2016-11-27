# Airbitz Javascript core

Run `npm install` to get the dependencies you need,
then run `npm test` to run the tests.

To build for the web, run `npm run webpack`.
This will produce a file, `./abc.js`, which can be used in a `<script>` tag.

All sources are in the [JavaScript Standard Style](http://standardjs.com/).


## REACT NATIVE webpack.config.js optional configuration
    //  REACT NATIVE. set the libraryTarget as commonjs, in case just requiring it directly as a global does not jibe with your app's configuration.
    libraryTarget: "commonjs",
