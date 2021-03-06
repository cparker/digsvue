#!/usr/bin/env node

'use strict';

var fs = require('fs');
var Q = require('q');
var _ = require('underscore');
var argv = require('minimist')(process.argv.slice(2));
let s3 = require('s3')
const moment = require('moment')

module.exports = (function() {

  const s3Bucket = 'digsvue'
  const newAVIDestFolder = 'new-uploaded-avis'
  const newPICDestFolder = 'new-uploaded-pics'

  let writeFile = Q.nfbind(fs.writeFile)
  var readdir = Q.nfbind(fs.readdir);

  let sourceBaseDir = argv.sourceBaseDir || '/opt/house-monitor'
  var motionContentDir = argv.motionContentDir || `${sourceBaseDir}/motion-files`
  var lastCheckDir = argv.lastCheckDir || `${sourceBaseDir}`
  var lastCheckFile = '.digsvue.lastCheck.json'

  // examine all the files motion (camera app) is writing
  let motionFiles = fs.readdirSync(motionContentDir)

  // get s3 keys
  let s3info = JSON.parse(fs.readFileSync('.s3keys.json'))

  // for talking to s3
  let s3client = s3.createClient({
    s3Options: {
      accessKeyId: s3info.key,
      secretAccessKey: s3info.secret,
      region: 'us-east-1'
    }
  })

  var lastCheck;

  try {
    var lastCheckJSON = JSON.parse(fs.readFileSync(lastCheckDir + '/' + lastCheckFile, {
      encoding: 'utf-8'
    }));
    lastCheck = {
      date: new Date(lastCheckJSON.date)
    };
  } catch (err) {
    console.log('looks like a first run ', err);
    lastCheck = {
      date: new Date(0)
    };
  }
  console.log('looking for files written since ', lastCheck);

  var motionFileStats = _.map(motionFiles, function(file) {
    var fd = fs.openSync(motionContentDir + '/' + file, 'r');
    var stat = fs.fstatSync(fd);
    fs.closeSync(fd);
    return {
      name: file,
      fullpath: motionContentDir + '/' + file,
      stat: stat
    };
  });

  // which files are newer than since we last checked
  var newFiles = _.filter(motionFileStats, function(fileStat) {
    if (fileStat.stat.ctime > lastCheck.date) {
      console.log('found a new file ', fileStat.name);
      return true;
    }
  });

  var avis = _.filter(newFiles, function(f) {
    return f.name.endsWith('.avi');
  });

  var pics = _.filter(newFiles, function(f) {
    return f.name.endsWith('.jpg');
  });

  let makeUploader = (path, name, destFolder) => {

    // motion writes image names like 137-2016-06-20_18-34-10.mp4, where 137 is some kind of sequence number
    let fileParseRx = new RegExp('^(\\d\\d\\d)-(\\d\\d\\d\\d)-(\\d\\d)-(\\d\\d)_(\\d\\d)-(\\d\\d)-(\\d\\d)\.(\\w\\w\\w)$')
    let matches = fileParseRx.exec(name)
    if (!matches) {
      console.log(`file ${name} is in a strange format, not uploading`)
      return function() {}
    }
    let year = matches[2]
    let month = matches[3]
    let day = matches[4]
    let hour = matches[5]
    let min = matches[6]
    let sec = matches[7]
    let ext = matches[8]

    let realDate = moment().year(year).month(month).date(day).hour(hour).minute(min).second(sec).utcOffset(0)

    var params = {
      localFile: path,

      s3Params: {
        Bucket: s3Bucket,
        // use an ISO date/time as the filename
        Key: `${destFolder}/${realDate.format()}.${ext}`
      },
    }

    let uploader = s3client.uploadFile(params)
    uploader.on('progress', () => {
      console.log(`${name} ${uploader.progressAmount}/${uploader.progressTotal}`)
    })
    uploader.on('error', (err) => {
      console.log(`error on ${name}`, err)
    })
    uploader.on('end', () => {
      console.log(`${name} done`)
    })

    return uploader
  }

  // upload avis to s3
  let aviUploaders = _.map(avis, newFile => {
    return makeUploader(newFile.fullpath, newFile.name, newAVIDestFolder)
  })

  // upload pics
  // we don't really need to upload the pics anymore, because we're generating .gif (animated) for the stills,
  // or if that fails we generate a non animated one
  /*
  let picUploaders = _.map(pics, newPic => {
    return makeUploader(newPic.fullpath, newPic.name, newPICDestFolder)
  })
  */

  console.log('finishing up');
  writeFile(lastCheckDir + '/' + lastCheckFile, JSON.stringify({
      date: new Date()
    }))
    .catch(function(err) {
      console.log('error writing lastCheck', err);
    });

})();
