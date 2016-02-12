'use strict';

process.env.NODE_ENV = 'Test';
var chai = require('chai');
chai.should();
require('mocha');

// Needed for better error logs when testing
process.once('uncaughtException', function (error) {
    throw error;
});
