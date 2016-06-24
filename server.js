#!/usr/bin/env node

'use strict'

const exec = require('child_process').exec
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
const s3 = require('s3')


module.exports = (() => {

  const serviceURL = '/mydata'
  const triggerReEncode = '/triggerReEncode'
  const dbName = 'databaseName'
  const defaultDBConnection = `mongodb://localhost/${dbName}`
  const mongoCollectionName = 'collectionName'

  let baseDir = process.env.BASE_DIR || '/app'

  let s3info = JSON.parse(process.env.S3_INFO)
  
  let s3client = s3.createClient({
    s3Options: {
      accessKeyId: s3info.key,
      secretAccessKey: s3info.secret,
      region: 'us-east-1'
    }
  })

  let execPromise = Q.denodeify(exec)

  let mongoClient = bluebird.promisifyAll(mongodb).MongoClient;

  let port = process.env.PORT || 5000

  let app = express()

  let dbURI = process.env.MONGODB_URI || defaultDBConnection
  let db

  /*
  console.log('dbURI', dbURI)
  mongoClient.connect(dbURI)
      .then(ddb => {
          console.log('connected to mongo')
          db = ddb
      })
      .catch(er => {
          console.log('error connecting to mongo', er)
      })
  */

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

  let getData = (req, res) => {
    db.collection(mongoCollectionName)
      .find({})
      .sort({
        dateTime: -1
      })
      .limit(1)
      .toArray()
      .then(queryResult => {
        if (!queryResult || queryResult.length <= 0) {
          res.status(404).json({
            "result": "no data for you"
          })
        } else {
          res.json({
            data: queryResult
          })
        }
      })
      .catch(err => {
        console.log("error", err)
        res.status(500).json({
          "error": err
        })
      })
  }


  let setData = (req, res) => {
    console.log('body ', req.body);
    if (!req.body) {
      console.log('body is missing')
      res.status(500).json({
        "error": "missing body"
      })
      return false
    }

    req.body.dateTime = moment().toDate()
    db.collection(mongoCollectionName).insertOne(req.body)
      .then((insertResult) => {
        res.status(201).json({
          "insertResult": insertResult
        })
      })
      .catch((er) => {
        console.log('error on insert', er)
        res.status(500).json({
          "error": er
        })
      })
  }

  let handleReEncode = (req, res) => {
    execPromise('./re-encode-vids.js')
      .then(() => {
        console.log('finished re-encode')
        res.status(200).json({
          "OK": "encode done"
        })
      })
      .catch(er => {
        console.log('error', er)
        res.status(500).json({
          "error": er
        })
      })
  }


  let handleZoneViewRequest = (req, res) => {
    var sinceHours = req.query.sinceHours || 24
    console.log('getting you files created in the last ', sinceHours, ' hours')
    var cutoffDate = moment().subtract(sinceHours, 'hours').toDate()
    console.log('cutoff date ', cutoffDate)

    // find live files on s3 that are within time range


    // get the file names
    let files = fs.readdirSync(motionContentDir)

    // map those into file stats
    var fileStats = _.map(files, function (f) {
      var fd = fs.openSync(motionContentDir + '/' + f, 'r');
      var stat = fs.fstatSync(fd);
      fs.closeSync(fd);
      return {
        url: imageURLPrefix + f,
        name: f,
        stat: stat
      };
    });


    var newFiles = _.filter(fileStats, function (fs) {
      return fs.stat.mtime >= cutoffDate;
    });

    // filter out only the vids
    var vids = _.filter(newFiles, function (fs) {
      var suffix = '.mp4';
      return fs.name.match(suffix + '$') == suffix;
    });

    // for each vid, find its corresponding still image (.gif) and make a pair
    var pairs = _.chain(vids)
      .map(function (vid) {
        var noExtention = vid.name.substr(0, vid.name.lastIndexOf('.'));
        var picFilename = noExtention + '.gif';
        // confirm that we have the still
        var hasPic = _.find(newFiles, function (fs) {
          return fs.name === picFilename;
        });

        if (hasPic) {
          return {
            'eventDate': moment(vid.stat.mtime),
            'pic': imageURLPrefix + picFilename,
            'vid': imageURLPrefix + vid.name
          };
        } else {
          console.log('skipping ', vid.name, ' because we couldnt find a matching pic', picFilename);
          return undefined;
        }
      })
      .filter(function (x) {
        return x !== undefined;
      })
      .sortBy(function (pair) {
        return pair.eventDate.toDate();
      })
      .map(function (pair) {
        return {
          'eventDate': pair.eventDate.format(),
          'pic': pair.pic,
          'vid': pair.vid
        };
      })
      .value()
      .reverse();

    console.log('returning', pairs);

    res.json(pairs);
  };

  app.post(serviceURL, setData)
  app.post(triggerReEncode, handleReEncode)
  app.get(serviceURL, getData)

  app.listen(port, '0.0.0.0', () => {
    console.log(`listening on ${port}`)
  })

})()
