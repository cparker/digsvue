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
  const s3Bucket = 'digsvue'

  let s3AVIsDir = argv.s3AVIsDir || 'new-uploaded-avis'
  let s3LiveDir = argv.s3LiveDir || 'live'
  let localBaseDir = argv.localBaseDir || './work'
  let newAVIsDir = `${localBaseDir}/new-avis`
  let encodedMP4sDir = `${localBaseDir}/encoded-mp4s`
  let stillPicDir = `${localBaseDir}/stillPicDir`


  var unlink = Q.nfbind(fs.unlink);
  var execPromise = Q.denodeify(exec);

  // get s3 keys
  //let s3info = JSON.parse(fs.readFileSync('.s3keys.json'))
  let s3info = JSON.parse(process.env.S3_INFO)
  console.log('s3info', s3info)

  // make some dirs
  fs.mkdirSync(localBaseDir)
  fs.mkdirSync(encodedMP4sDir)
  fs.mkdirSync(stillPicDir)

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
    console.log('new AVIs downloaded from s3, deleting remote files')

    var vids = fs.readdirSync(newAVIsDir)
    _.each(vids, v => {
      let s3DeleteRemoteFiles = {
        s3Params: {
          Bucket: s3Bucket,
          Prefix: `${s3AVIsDir}/${v}`
        }
      }
      let deleter = s3client.deleteObjects(s3DeleteRemoteFiles)
      deleter.on('end', () => {
        console.log('deleted', `${s3AVIsDir}/${v}`)
      })

    })

    console.log('', vids.length, 'new videos to re-encode');

    var encodeCommand = '/app/vendor/libav/bin/avconv -y -i $INPUT -vcodec libx264 -preset slow -b:v 100k -maxrate 100k -bufsize 200k -r 4 $OUTPUT';
    var animatedGifCommand = "/app/ffmpeg -t 20 -i $INPUT -r 1 -vf 'select=gt(scene\\,0.1),scale=350:-1' -gifflags +transdiff -y $OUTPUT";
    var simpleOneFrameCommand = "/app/ffmpeg -y -i $INPUT -vframes 1 -vf 'scale=350:-1' $OUTPUT";

    var logExecIO = function(io) {
      console.log('STDIN: ', io[0]);
      console.log('STDERR: ', io[1]);
    };

    var logExecErr = function(err) {
      console.log('error during exec', err);
    };

    var commandPromises = _.flatten(_.map(vids, function(vid) {
      console.log('working on ', vid)

      var newVidMp4Name = vid.replace(/^(.*?)\.avi$/, '$1.mp4');
      var newVidGifName = vid.replace(/^(.*?)\.avi$/, '$1.gif');
      console.log('newVidMp4Name ', newVidMp4Name, ' newVidGifName ', newVidGifName)

      var reEncodeCommand = encodeCommand
        .replace('$INPUT', `${newAVIsDir}/${vid}`)
        .replace('$OUTPUT', `${encodedMP4sDir}/${newVidMp4Name}`)

      console.log('reEncodeCommand', reEncodeCommand)

      var aniGifFinalCommand = animatedGifCommand
        .replace('$INPUT', `${encodedMP4sDir}/${newVidMp4Name}`)
        .replace('$OUTPUT', `${stillPicDir}/${newVidGifName}`)

      console.log('aniGifFinalCommand', aniGifFinalCommand)

      var simpleOneFrameFinalCommand = simpleOneFrameCommand
        .replace('$INPUT', `${encodedMP4sDir}/${newVidMp4Name}`)
        .replace('$OUTPUT', `${stillPicDir}/${newVidGifName}`)

      console.log('simpleOneFrameCommand', simpleOneFrameCommand)

      var reEncodeFunc = function() {
        console.log('running 1.', reEncodeCommand);
        return execPromise(reEncodeCommand)
          .then(logExecIO)
          .then(function() {
            console.log('deleting source file')
            unlink(`${newAVIsDir}/${vid}`)
          })
          .catch(logExecErr)
          .then(function() {
            console.log('deleting source file');
            unlink(`${newAVIsDir}/${vid}`)
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

    let uploadFunc = () => {
      console.log('running 4. uploading')
      let newMP4s = _.map(fs.readdirSync(encodedMP4sDir), f => {
        return {
          path: `${encodedMP4sDir}/${f}`,
          name: f
        }
      })
      let newStillPics = _.map(fs.readdirSync(stillPicDir), f => {
        return {
          path: `${stillPicDir}/${f}`,
          name: f
        }
      })
      let filesToUpload = newMP4s.concat(newStillPics)
      console.log('filesToUpload', filesToUpload)
      _.each(filesToUpload, file => {
        let s3UploadFileParams = {
          localFile: file.path,
          s3Params: {
            Bucket: s3Bucket,
            Key: `${s3LiveDir}/${file.name}`
          }
        }

        let uploader = s3client.uploadFile(s3UploadFileParams)

        uploader.on('progress', () => {
          let progressPct = ((uploader.progressAmount / uploader.progressTotal) * 100).toFixed(2)
          console.log(`${file.path} ${progressPct}`)
        })
        uploader.on('error', (err) => {
          console.log(`error on ${file.path}`, err)
        })
        uploader.on('end', () => {
          console.log(`${file.path} done, deleting`)
          unlink(file.path)
        })
      })
    }

    // now execute the promises sequentially
    commandPromises.reduce(Q.when, Q('initial'))
      .then(() => {
        try {
          console.log('before starting uploads')
          uploadFunc()
          console.log('after starting uploads')
        } catch (Err) {
          console.log('caught', Err)
        }
      })

  })



})();
