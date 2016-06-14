#!/usr/bin/env node

'use strict'

const restClient = require('request-promise')
const express = require('express')
const morgan = require('morgan')
const _ = require('underscore')
const bodyParser = require('body-parser')
const session = require('express-session')
const moment = require('moment')
const Q = require('q')
const bluebird = require('bluebird')
const Await = require('asyncawait/await')
const Async = require('asyncawait/async')
const mongodb = require('mongodb')
const gju = require('geojson-utils')
const nodemailer = require('nodemailer')


module.exports = (() => {

    const emailSMTPS = process.env.SMTPS
    const milesPerMeter = 0.000621371
    const transporter = nodemailer.createTransport(emailSMTPS)
    const dbName = 'front-door'
    const defaultDBConnection = `mongodb://localhost/${dbName}`
    const mongoCollectionName = 'front-door'

    const locationPreviousDays = 7

    let mongoClient = bluebird.promisifyAll(mongodb).MongoClient;



    let port = process.env.PORT || 5000

    let app = express()

    let dbURI = process.env.MONGODB_URI || defaultDBConnection
    let db

    console.log('dbURI', dbURI)
    mongoClient.connect(dbURI)
        .then(ddb => {
            console.log('connected to mongo')
            db = ddb
        })
        .catch(er => {
            console.log('error connecting to mongo', er)
        })

    app.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, contentType");
        res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
        next();
    });

    app.use(express.static('.'))
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({
        extended: true
    }))

    app.listen(port, '0.0.0.0', () => {
        console.log(`listening on ${port}`)
    })

})()
