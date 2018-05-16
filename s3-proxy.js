const express = require('express')
const s3 = require('s3')


let s3client = s3.createClient({
  s3Options: {
    accessKeyId: s3info.key,
    secretAccessKey: s3info.secret,
    region: 'us-east-1'
  }
})

const app = express();
app.get('/media/:asset', (req, res) => {

  const params = {
    Bucket: "digsvue2",
    Key: `camera-uploads/${req.params.asset}`
  }
  const downloader = s3client.downloadBuffer(params)
  downloader.on('end', b => {
    console.log('end we have a buffer', b)
    res.set('Content-Type' , 'video/mp4')
    res.status(200).send(b)
  })
  downloader.on('error', e => {
    console.log('error', e)
  })


})

app.listen(5000)
