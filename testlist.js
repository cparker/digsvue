#!/usr/bin/env node

'use strict'

const s3 = require('s3')


//let s3info = process.env.S3_INFO
let s3info = JSON.parse(process.env.S3_INFO)

let s3client = s3.createClient({
  s3Options: {
    accessKeyId: s3info.key,
    secretAccessKey: s3info.secret,
    region: 'us-east-1'
  }
})

let listParams = {
  s3Params: {
    Bucket: 'digsvue2',
    Prefix: 'camera-uploads'
  },
  recursive: false
}

let finder = s3client.listObjects(listParams)
finder.on('data', (d) => {
  console.log('we have', JSON.stringify(d,null,2))
})
finder.on('end', () => {
  console.log('done finding')
})
