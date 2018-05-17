'use strict'

const express = require('express')
const app = express()
const port = process.env.PORT || 5000
const s3 = require('s3')
const AWS = require('aws-sdk')
const moment = require('moment')
const _ = require('lodash')

const aws3 = new AWS.S3()


let s3info = {
    key: process.env.AWS_ACCESS_KEY_ID,
    secret: process.env.AWS_SECRET_ACCESS_KEY
}

if (!s3info.key) {
    console.log('please set AWS_S3_DIGS_KEY and AWS_S3_DIGS_SECRET')
    process.exit(1)
}

let s3client = s3.createClient({
    s3Options: {
        accessKeyId: s3info.key,
        secretAccessKey: s3info.secret,
        region: process.env.AWS_REGION || 'us-east-1'
    }
})


app.use(express.static('.'))

/*
  fetch stuff from s3 bucket
*/
app.get('/s3/:resource', (req, res) => {
    let contentType
    if (req.params.resource.endsWith('.jpg')) {
        contentType = 'image/jpg'
    } else if (req.params.resource.endsWith('.mp4')) {
        contentType = 'video/mp4'
    } else if (req.params.resource.endsWith('.png')) {
        contentType = 'image/png'
    } else {
        contentType = 'application/text'
    }

    const params = {
        Bucket: "digsvue2",
        Key: `camera-uploads/${req.params.resource}`
    }
    const downloader = s3client.downloadBuffer(params)

    downloader.on('end', b => {
        res.set('Content-Type', contentType)
        res.status(200).send(b)
    })

    downloader.on('error', e => {
        res.status(500).send(e)
    })
})

function gets3Files(bucket, key) {
    return new Promise((resolve, reject) => {
        const params = {
            Bucket: `${bucket}`,
            Prefix: `${key}`
        }
        console.log('params', params)
        aws3.listObjectsV2(params, (err, data) => {
            if (err) {
                reject(err)
            } else {
                console.log('got data', data)
                resolve(data)
            }
        })
    })
}

/*
  get events for the current day and N previous days
  ?previousDays=n
*/
app.get('/getEvents', async(req, res) => {
    const prevDays = parseInt(req.query.previousDays || 2)
    const dayList = []
    for (let days = 0; days < prevDays; days++) {
        dayList.push(moment().subtract(days, 'days').format('YYYY-MM-DD'))
    }

    const filesByDayProms = dayList.map(d => {
        return gets3Files('digsvue2', `camera-uploads/${d}/`)
    })

    const filesByDay = (await Promise.all(filesByDayProms))
        .map(result => result.Contents)

    const flatFiles = _.flatten(filesByDay)

    res.status(200).send(flatFiles)
})

app.listen(port, () => {
    console.log(`listening on ${port}`)
})