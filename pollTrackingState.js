/*
Called from a cron on the pi to check the tracking state and call local APIs to set tracking state in motion
*/

const NodeRestClient = require('node-rest-client').Client
const restClient = new NodeRestClient()
const moment = require('moment')

const cameras = ['garage', 'living-room']
const camera = process.argv[2]

const digsvueStateURL = `https://8cyz33x5i2.execute-api.us-east-1.amazonaws.com/api-stage-production/hello-lambda-3`
const AWS_LAMBDA_KEY = process.env.AWS_LAMBDA_KEY || (() => { console.log('please set AWS_LAMBDA_KEY'); process.exit(1) })()

const cameraControlURL = `http://localhost:8080/$ID/detection/$ACTION`
const cameraNameToIds = {
    'living-room': 1,
    garage: 2
}

async function go () {
    if (camera) {
        const trackingState = await getTrackingStateForCamera(camera)
        setTrackingStateForCamera(camera, trackingState)
    } else {
        for (const camera in cameras) {
            const trackingState = await getTrackingStateForCamera(camera)
            setTrackingStateForCamera(camera, trackingState)
        }
    }
}

function getTrackingStateForCamera (camera) {
    return new Promise((resolve, reject) => {
        const args = {
            headers: {
                'Content-Type': 'application/json',
                'Accepts': 'application/json',
                'x-api-key': `${AWS_LAMBDA_KEY}`
            },
            parameters: {
                id: camera
            }
        }

        console.log('looking for', args)

        restClient.get(digsvueStateURL, args, (data, response) => {
            if (response.statusCode === 200) {
                console.log('data', data)
                resolve(data)
            } else {
                console.log(`error calling ${digsvueStateURL}`, data)
                reject(data)
            }
        })
    })
}

function setTrackingStateForCamera (camera, trackingState, testHour) {
    // we get data like this that represents an schedule
    // we get records where keys are on/off state, values are hour 0-23
    // trackingState: [ { off: 6 }, { on: 21 } ] }
    // start by setting 'current state' to the end of the array
    // work backwards through the array.  for each element, is the hour
    // less than or equal to the current hour, if yes set state, else keep going
    // if we get to the begining of the array without setting state, the 'current state'
    // becomes the last element in the array, which was set at the begining
    const currentHour = testHour || moment().hour()
    let foundState = trackingState[trackingState.length - 1]
    for (let i = trackingState.length - 1; i >= 0; i--) {
        const hour = Object.values(trackingState[i])[0]
        if (hour <= currentHour) {
            foundState = trackingState[i]
            break
        }
    }
    console.log(`setting ${camera} to ${JSON.stringify(foundState)}`)

    const state = Object.entries(foundState)[0][0]
    const cameraId = cameraNameToIds[camera]
    let url = ''
    if (state === 'on') {
        url = cameraControlURL.replace('$ID', cameraId).replace('$ACTION', 'start')
    } else {
        url = cameraControlURL.replace('$ID', cameraId).replace('$ACTION', 'pause')
    }
    console.log(`HTTP GET ${url}`)
    restClient.get(cameraControlURL, {}, (data, response) => {
        console.log(`response status ${response.statusCode}`)
    })
}

// setTrackingStateForCamera('garage', [{on: 0}], 13)
go()
