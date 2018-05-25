'use strict'

const express = require('express')
const NodeRestClient = require('node-rest-client').Client
const restClient = new NodeRestClient()
const app = express()
const port = process.env.PORT || 5000
const s3 = require('s3')
const AWS = require('aws-sdk')
const moment = require('moment')
const _ = require('lodash')
const sendSeekable = require('send-seekable')
const fs = require('fs')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const mimeTypes = require('mime-types')

const aws3 = new AWS.S3()

const digsvueStateURL = `https://8cyz33x5i2.execute-api.us-east-1.amazonaws.com/api-stage-production/hello-lambda-3`
const AWS_LAMBDA_KEY = process.env.AWS_LAMBDA_KEY || (() => { console.log('please set AWS_LAMBDA_KEY'); process.exit(1) })()

let s3info = {
    key: process.env.AWS_ACCESS_KEY_ID,
    secret: process.env.AWS_SECRET_ACCESS_KEY
}

const password = process.env.PASS
const cookieKey = process.env.COOKIE_KEY

if (!password) {
    console.log('must set env var PASS')
    process.exit(1)
}

if (!cookieKey) {
    console.log('must set env var COOKIE_KEY')
    process.exit(1)
}

if (!s3info.key) {
    console.log('please make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set')
    process.exit(1)
}

let s3client = s3.createClient({
    s3Options: {
        accessKeyId: s3info.key,
        secretAccessKey: s3info.secret,
        region: process.env.AWS_REGION || 'us-east-1'
    }
})

app.use(cookieParser())
app.use(sendSeekable)
app.use(express.static('.'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
    extended: true
}))

app.post('/login', (req, res) => {
    console.log('/login')
    console.log('login', req.body)
    if (req.body.pass === password) {
        res.cookie(cookieKey, '1', {
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
            httpOnly: true
        })
        res.sendStatus(200)
    } else {
        res.sendStatus(401)
    }
})

// check cookie
app.use((req, res, next) => {
    if (req.cookies[cookieKey]) {
        console.log('pass')
        next()
    } else {
        console.log('notpass')
        res.status(401).send('you shall not pass')
    }
})

// this is just a reflector basically.  the app.use above does the real checking
app.get('/checkauth', (req, res) => {
    console.log('/checkauth')
    res.sendStatus(200)
})

/*
  fetch stuff from s3 bucket
  s3?resource=2018-05-18/foo.jpg
*/
app.get('/s3', (req, res) => {
    console.log('/s3', req.query)
    const contentType = mimeTypes.lookup(req.query.resource) || 'application/octet-stream'

    const params = {
        Bucket: 'digsvue2',
        Key: `camera-uploads/${req.query.resource}`
    }
    const downloader = s3client.downloadBuffer(params)

    downloader.on('end', b => {
        res.set('Content-Type', contentType)
        res.sendSeekable(b)
    })

    downloader.on('error', e => {
        res.status(500).send(e)
    })
})

function gets3Files (bucket, key) {
    return new Promise((resolve, reject) => {
        const params = {
            Bucket: `${bucket}`,
            Prefix: `${key}`
        }
        console.log('looking in s3 for', params)
        aws3.listObjectsV2(params, (err, data) => {
            if (err) {
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}

/*
  get events for the current day and N previous days
  ?previousDays=n
*/
app.get('/getEvents/:camName', async (req, res) => {
    console.log('/getEvents', req.params, req.query)
    const prevDays = parseInt(req.query.previousDays || 2)
    const dayList = []
    for (let days = 0; days < prevDays; days++) {
        dayList.push(moment().subtract(days, 'days').format('YYYY-MM-DD'))
    }

    const filesByDayProms = dayList.map(d => {
        // return gets3Files('digsvue2', `camera-uploads/${req.params.camName}/${d}/`)
        return gets3Files('digsvue2', `camera-uploads/${d}/`)
    })

    const filesByDay = (await Promise.all(filesByDayProms))
        .map(result => result.Contents)

    const flatFiles = _.flatten(filesByDay)
    const byCamera = flatFiles.filter(rec => rec.Key.indexOf(req.params.camName) !== -1)

    res.status(200).json(byCamera)
})

app.get('/testvids.html', (req, res) => {
    const vidFiles = fs.readdirSync('./testvids').filter(v => v.endsWith('.mp4'))
    const vidLinks = vidFiles.map(v => `<a href='/testvids/${v}'>${v}</a>`).join('<br/>\n')
    const vidPage = `
    <html>
      <body>
        ${vidLinks}
      </body>
    </html>
    `
    console.log('vidpage is', vidPage)
    res.set('Content-Type', 'text/html')
    res.send(vidPage)
})

app.post('/tracking', (req, res) => {
    console.log('tracking, got body', req.body)
    // call lambda function using API KEY
    sendDigsvueState(req.body, req.query)
        .then(data => {
            res.status(200).json(data)
        })
        .catch(err => {
            console.log('error', err)
        })
})

app.get('/tracking', (req, res) => {
    console.log('GET /tracking')
})

function sendDigsvueState (state, params) {
    return new Promise((resolve, reject) => {
        const args = {
            headers: {
                'Content-Type': 'application/json',
                'Accepts': 'application/json',
                'x-api-key': `${AWS_LAMBDA_KEY}`
            },
            parameters: params,
            data: state
        }

        restClient.post(digsvueStateURL, args, (data, response) => {
            if (response.statusCode === 200) {
                resolve(data)
            } else {
                console.log(`error posting to ${digsvueStateURL}`, data)
                reject(data)
            }
        })
    })
}

function getDigsvueState () {
    const args = {
        headers: {
            'Content-Type': 'application/json',
            'Accepts': 'application/json',
            'x-api-key': `${AWS_LAMBDA_KEY}`
        }
    }
    return new Promise((resolve, reject) => {
        restClient.get(digsvueStateURL, args, (data, res) => {
            if (res.statusCode === 200) {
                resolve(data)
            } else {
                console.log(`error in call to ${digsvueStateURL}`, data)
                reject(data)
            }
        })
    })
}

app.listen(port, () => {
    console.log(`listening on ${port}`)
})
