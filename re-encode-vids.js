#!/usr/bin/env node

'use strict';

let fs = require('fs')
let Q = require('q')
let sys = require('sys')
let exec = require('child_process').exec
let _ = require('underscore')
let s3 = require('s3')
let argv = require('minimist')(process.argv.slice(2))

module.exports = (function() {
  const s3Bucket = 'front-door'

  let s3AVIsDir = argv.s3AVIsDir || 'new-uploaded-avis'
  let localBaseDir = argv.localBaseDir || '/opt/house-monitor';
  var newAVIsDir = `${localBaseDir}/new-avis`;

  var unlink = Q.nfbind(fs.unlink);
  var execPromise = Q.denodeify(exec);

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

  console.log('starting', new Date());

  // download new vids from s3
  let s3DownloadAVIParams = {
    localDir: newAVIsDir,
    s3Params: {
      Bucket: s3Bucket,
      Prefix: s3AVIsDir
    },
    deleteRemoved: false
  }

  let aviDownloader = s3client.downloadDir(s3DownloadAVIParams)
  aviDownloader.on('fileDownloadEnd', (localFilePath) => {
    console.log(`downloaded ${localFilePath}`)
  })

  aviDownloader.on('end', () => {
    console.log('new AVIs downloaded from s3')

    var vids = fs.readdirSync(newAVIsDir)
    console.log('', vids.length, 'new videos to re-encode');
  })

  /*





  var encodeCommand = '/opt/apps/bin/avconv -y -i $INPUT -vcodec libx264 -vprofile high -preset slow -b:v 100k -maxrate 100k -bufsize 200k -r 4 $OUTPUT';
  var animatedGifCommand = "/home/ubuntu/bin/ffmpeg -t 20 -i $INPUT -r 1 -vf 'select=gt(scene\\,0.1),scale=350:-1' -gifflags +transdiff -y $OUTPUT";
  var simpleOneFrameCommand = "/home/ubuntu/bin/ffmpeg -y -i $INPUT -vframes 1 -vf 'scale=350:-1' $OUTPUT";

  var logExecIO = function(io) {
    console.log('STDIN: ', io[0]);
    console.log('STDERR: ', io[1]);
  };

  var logExecErr = function(err) {
    console.log('error during exec', err);
  };

  var commandPromises = _.flatten(_.map(vids, function(vid) {

    var newVidMp4Name = vid.replace(/^(.*?)\.avi$/, '$1.mp4');
    var newVidGifName = vid.replace(/^(.*?)\.avi$/, '$1.gif');

    var reEncodeCommand = encodeCommand
      .replace('$INPUT', appDir + newVidsDir + '/' + vid)
      .replace('$OUTPUT', appDir + liveVidsDir + '/' + newVidMp4Name);

    var aniGifFinalCommand = animatedGifCommand
      .replace('$INPUT', appDir + liveVidsDir + '/' + newVidMp4Name)
      .replace('$OUTPUT', appDir + liveVidsDir + '/' + newVidGifName);

    var simpleOneFrameFinalCommand = simpleOneFrameCommand
      .replace('$INPUT', appDir + liveVidsDir + '/' + newVidMp4Name)
      .replace('$OUTPUT', appDir + liveVidsDir + '/' + newVidGifName);


    var reEncodeFunc = function() {
      console.log('running 1.', reEncodeCommand);
      return execPromise(reEncodeCommand)
        .then(logExecIO)
        .then(function() {
          console.log('deleting source file');
          unlink(appDir + newVidsDir + '/' + vid);
        })
        .catch(logExecErr)
        .then(function() {
          console.log('deleting source file');
          unlink(appDir + newVidsDir + '/' + vid);
        })
    };

    var gifFailRX = new RegExp('^.*?(Output file is empty).*$', 'mi');

    var simpleOneFrameFunc = function() {
      console.log('running 3.', simpleOneFrameCommand);

      return execPromise(simpleOneFrameFinalCommand)
        .then(logExecIO)
        .catch(logExecErr);
    };

    var makeGifFunc = function() {
      console.log('running 2.', aniGifFinalCommand);
      return execPromise(aniGifFinalCommand)
        .then(function(res) {
          console.log(res[0]);
          console.log(res[1]);

          // when the ani gif step fails (it does sometimes depending on the content), it logs:
          //
          // 'Output file is empty, nothing was encoded (check -ss / -t / -frames parameters if used)'
          //
          // if that happens, fall back to a simpler method that captures one frame from the vid
          if (gifFailRX.exec(res[0] + res[1]) != null) {
            console.log('Creating animated gif failed, so falling back to simple one-frame .gif');
            return simpleOneFrameFunc();
          }
        })
        .catch(logExecErr);
    };

    // returning an array, which gets flattened
    return [reEncodeFunc, makeGifFunc];

  }));

  // now execute the promises sequentially
  commandPromises.reduce(Q.when, Q('initial'));

  */


})();
