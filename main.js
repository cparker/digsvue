let page = {}

let camNames = [
    'living-room',
    'garage'
]

let activeCam

function init () {
    console.log('init')
    page = getPage()
}

function getPage () {
    const p = {}

    const qs = selector => document.querySelector(selector)

    p.cams = qs('body .cams')
    p.camEvents = qs('body .cam-events')
    p.authPage = qs('body .auth')
    p.eventTitle = qs('#eventTitle')
    p.back = qs('.back')
    p.refresh = qs('.refresh')
    p.pass = qs('.auth .pass input')
    p.login = qs('.auth .submit button')
    p.daysMinus = qs('.left.prevdays')
    p.daysPlus = qs('.right.prevdays')
    p.settings = qs('.settings')
    p.prevValue = qs('.value.prevdays')
    p.settingsPage = qs('.settings-page')
    p.closeSettings = qs('.close-settings')
    p.trackOn = qs('#track-on')
    p.trackOff = qs('#track-off')
    p.trackSchedule = qs('#track-schedule')
    p.trackOnPlus = qs('.trackon.plus')
    p.trackOnValue = qs('.trackon.value')
    p.trackOnMinus = qs('.trackon.minus')
    p.trackOffPlus = qs('.trackoff.plus')
    p.trackOffValue = qs('.trackoff.value')
    p.trackOffMinus = qs('.trackoff.minus')
    p.settingsCam = qs('.settings-cam')

    p.back.addEventListener('click', backToCams)
    p.refresh.addEventListener('click', backToCams)
    p.login.addEventListener('click', doLogin)
    p.settings.addEventListener('click', openSettings)
    p.closeSettings.addEventListener('click', closeSettings)

    p.daysMinus.addEventListener('click', () => handleDays(-1))
    p.daysPlus.addEventListener('click', () => handleDays(1))

    p.trackOn.addEventListener('click', () => trackOn())
    p.trackOff.addEventListener('click', () => trackOff())
    p.trackSchedule.addEventListener('click', () => selectTrackBySchedule())

    p.trackOnPlus.addEventListener('click', () => trackScheduleOn(1))
    p.trackOnMinus.addEventListener('click', () => trackScheduleOn(-1))
    p.trackOffPlus.addEventListener('click', () => trackScheduleOff(1))
    p.trackOffMinus.addEventListener('click', () => trackScheduleOff(-1))

    return p
}

function trackOn () {
    console.log('tracking ON')
    postTrackingSimple(activeCam, true)
}

function trackOff () {
    console.log('tracking OFF')
    postTrackingSimple(activeCam, false)
}

const debouncedPostTrackingSchedule = _.debounce(postTrackingSchedule, 1000)

function selectTrackBySchedule () {
    page.trackOnValue.innerHTML = 0
    page.trackOffValue.innerHTML = 0
}

function trackScheduleOn (value) {
    console.log('handling track off')
    const newVal = parseInt(page.trackOnValue.innerHTML) + value
    page.trackOnValue.innerHTML = `${newVal}`
    debouncedPostTrackingSchedule(activeCam, parseInt(page.trackOnValue.innerHTML), parseInt(page.trackOffValue.innerHTML))
}

function trackScheduleOff (value) {
    console.log('handling track off')
    const newVal = parseInt(page.trackOffValue.innerHTML) + value
    page.trackOffValue.innerHTML = `${newVal}`
    debouncedPostTrackingSchedule(activeCam, parseInt(page.trackOnValue.innerHTML), parseInt(page.trackOffValue.innerHTML))
}

function closeSettings () {
    page.settingsPage.style.width = `0`
}

async function openSettings () {
    console.log('opening settings')
    page.settingsCam.innerHTML = `${activeCam}`
    page.settingsPage.style.width = `100vw`
    const trackingResponse = await getTracking(activeCam)
    console.log('got tracking response', trackingResponse)
    updateSettingsForm(activeCam, trackingResponse.trackingState)
}

function postTrackingSchedule (camera, on, off) {
    console.log('posting tracking')
    const onConfig = { on: on }
    const offConfig = { off: off }
    /*
      We want to order the array by the hour, for example:
      [ {"off" : 6}, {"on" : 23} ]

      says: 'turn off tracking at 6am and turn on tracking at 11pm'
    */
    const trackingScheduleConfig = [onConfig, offConfig].sort((l, r) => (l.off || l.on) >= (r.off || r.on))
    postTracking(camera, trackingScheduleConfig)
}

function postTrackingSimple (camera, trackingOn) {
    const trackingConfig = trackingOn ? [{ 'on': 0 }] : [{ 'off': 0 }]
    postTracking(camera, trackingConfig)
}

function clearSettingsForm () {
    page.trackOn.checked = false
    page.trackOff.checked = false
    page.trackSchedule.checked = false
    page.trackOnValue.innerHTML = '-'
    page.trackOffValue.innerHTML = '-'
}

function updateSettingsForm (camera, trackingConfig) {
    // tracking config will look like this
    // {"id":"living-room","trackingState":[{"on":0}]}
    clearSettingsForm()
    if (trackingConfig.length === 1) {
        trackingConfig.forEach(rec => {
            rec.hasOwnProperty('on') ? page.trackOn.checked = true : page.trackOff.checked = true
        })
    } else {
        page.trackSchedule.checked = true
        trackingConfig.forEach(rec => {
            const onOrOff = Object.entries(rec)[0][0]
            const hour = Object.entries(rec)[0][1]
            onOrOff === 'on' ? page.trackOnValue.innerHTML = `${hour}` : page.trackOffValue.innerHTML = `${hour}`
        })
    }
}

function getTracking (camera) {
    return new Promise((resolve, reject) => {
        fetch(`/tracking?id=${encodeURIComponent(camera)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        })
            .then(response => {
                console.log('tracking response', response)
                if (response.ok) {
                    return response.json()
                }
            })
            .then(json => {
                console.log('tracking json', json)
                resolve(json)
            })
            .catch(err => {
                reject(err)
            })
    })
}

function postTracking (camera, trackingConfig) {
    const body = {}
    body.trackingState = trackingConfig
    fetch(`/tracking?id=${encodeURIComponent(camera)}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(body)
    })
}

function doLogin () {
    console.log('LOGIN', page.pass.value)
    fetch('/login', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pass: page.pass.value }),
        credentials: 'include'
    }).then(response => {
        console.log('login response', response)
        if (response.ok) {
            hideAllPages()
            updateCamsPage()
            showCamsPage()
        }
    })
}

function handleDays (incOrDec) {
    let newVal = parseInt(page.prevValue.innerHTML) + incOrDec
    page.prevValue.innerHTML = `${newVal}`
    handleCamClick(activeCam, newVal)
}

function backToCams () {
    page.cams.style.display = 'inherit'
    page.camEvents.style.display = 'none'
    updateCamsPage()
}

function addEvent (still, vid) {
    const vidDiv = document.createElement('div')
    vidDiv.classList.add('vid-container')
    vidDiv.innerHTML = `
        <div class='vid-title'></div>
        <video loop controls poster='living-room-2018-05-16_07-50-22.jpg' preload='none' src='living-room-2018-05-15_22-01-01.mp4'></video>
    `
    const regex = /\d\d\d\d-\d\d-\d\d_\d\d-\d\d-\d\d/g
    let dateOnly, formattedLocalTime
    try {
        dateOnly = still.Key.match(regex)[0]
        formattedLocalTime = moment(dateOnly, 'YYYY-MM-DD_HH-mm_ss').format('LLL')
    } catch (e) {
        console.log('error while parsing date from filename', e)
        formattedLocalTime = ''
    }

    const stillResource = encodeURI(still.Key.substring(still.Key.indexOf('/') + 1))
    const movieResource = encodeURI(vid.Key.substring(vid.Key.indexOf('/') + 1))
    vidDiv.querySelector('video').poster = `/s3?resource=${stillResource}`
    vidDiv.querySelector('video').src = `/s3/?resource=${movieResource}`
    vidDiv.querySelector('.vid-title').innerHTML = formattedLocalTime
    vidDiv.querySelector('video').addEventListener('error', e => {
        console.log('video error', e)
    })
    vidDiv.querySelector('video').addEventListener('loadeddata', l => {
        console.log('video has loaded', l)
    })

    page.camEvents.appendChild(vidDiv)
}

function handleCamClick (cam, prevDays) {
    let fetchForCam = cam || activeCam
    activeCam = fetchForCam
    console.log('clicked on', cam, 'prev days', prevDays)
    const _prevDays = prevDays || 2
    page.cams.style.display = 'none'
    page.camEvents.style.display = 'inherit'
    page.eventTitle.innerHTML = cam

    clearEvents()

    /*
        ETag : "63d14fe1c2bc8a48786ac879c8015aa7"
        Key : "camera-uploads/2018-05-18/living-room-2018-05-18_08-29-16_01.mp4"
        LastModified : "2018-05-18T14:33:11.000Z"
        Size : 623654
        StorageClass : "STANDARD"
    */

    fetch(`/getEvents/${cam}?previousDays=${_prevDays}`, {
        credentials: 'include'
    })
        .then(response => {
            return response.json()
        })
        .then(eventJson => {
            console.log('got', eventJson)

            const stills = eventJson.filter(e => e.Key.endsWith('jpg') && e.Key.indexOf('snapshot') === -1)
            const movies = eventJson.filter(e => e.Key.endsWith('mp4'))

            // reverse sort by Key, which should put newest events at the top
            stills.sort((l, r) => r.Key.localeCompare(l.Key))

            stills.forEach(still => {
                // we're comparing only the event number of the jpg to the mp4
                const matchFunc = m => m.Key.split('_')[2].split('.')[0] === still.Key.split('_')[2].split('.')[0]

                const matchingVid = movies.find(matchFunc)
                if (matchingVid) {
                    addEvent(still, matchingVid)
                } else {
                    console.log('no matching video file for', still)
                }
            })
        })
}

function clearCams () {
    document.querySelectorAll('.cams .image-container').forEach(e => e.remove())
}

function clearEvents () {
    document.querySelectorAll('.cam-events .vid-container').forEach(e => e.remove())
}

function hideAllPages () {
    page.authPage.style.display = 'none'
    page.cams.style.display = 'none'
    page.camEvents.style.display = 'none'
}

function showLoginPage () {
    page.authPage.style.display = 'inherit'
}

function showCamsPage () {
    page.cams.style.display = 'inherit'
}

function checkAuth () {
    fetch('/checkauth', {
        credentials: 'include'
    })
        .then(response => {
            if (!response.ok) {
                hideAllPages()
                showLoginPage()
            } else {
                hideAllPages()
                updateCamsPage()
                showCamsPage()
            }
        })
}

function updateCamsPage () {
    const todayYMD = moment().format('YYYY-MM-DD')
    const snapURLs = camNames.map(c => {
        const encodedResourceQuery = encodeURI(`${todayYMD}/${c}-snapshot.jpg`)
        return [c, `/s3?resource=${encodedResourceQuery}`]
    })
    clearCams()
    snapURLs.forEach(([camName, url]) => {
        const imageDiv = document.createElement('div')
        imageDiv.classList.add('image-container')
        const image = document.createElement('img')
        image.src = url
        imageDiv.appendChild(image)
        page.cams.appendChild(imageDiv)
        imageDiv.addEventListener('click', () => handleCamClick(camName))
    })
}

window.onload = () => {
    init()
    checkAuth()
}
