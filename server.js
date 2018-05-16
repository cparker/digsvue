'use strict'

const express = require('express')
const app = express()
const port = process.env.PORT || 5000
const s3 = require('s3')

let s3info = {
    key: process.env.AWS_S3_DIGS_KEY,
    secret: process.env.AWS_S3_DIGS_SECRET
}

if (!s3Info.key) {
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
apt.get('/s3/:resource', (req, res) => {
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
        console.log('end we have a buffer', b)
        res.set('Content-Type', 'video/mp4')
        res.status(200).send(b)
    })
    downloader.on('error', e => {
        res.status(500).send(e)
    })

})

app.listen(port, () => {
    console.log(`listening on ${port}`)
})