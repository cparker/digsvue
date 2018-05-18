
let page = {}

let camNames = [
    'living-room'
]

function init() {
    console.log('init')
    page = getPage()
}

function getPage() {
    const p = {}
    p.cams = document.querySelector('body .cams')
    p.camEvents = document.querySelector('body .cam-events')
    p.eventTitle = document.querySelector('#eventTitle')
    p.back = document.querySelector('.back')
    p.refresh = document.querySelector('.refresh')

    p.back.addEventListener('click', backToCams)
    p.refresh.addEventListener('click', backToCams)

    return p
}

function backToCams() {
    page.cams.style.display='inherit'
    page.camEvents.style.display='none'
    updateCamsPage()
}

function handleSelectEvent(item) {
    console.log('event handler', item.srcElement)
    if (item.srcElement.paused) {1
        item.srcElement.play()
    } else {
        item.srcElement.pause()
    }
}

function addEvent(still, vid) {
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

function handleCamClick(cam) {
    console.log('clicked on', cam)
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

    const events = fetch(`/getEvents/${cam}`)
        .then(response => {
            return response.json()
        })
        .then(eventJson => {
            console.log('got', eventJson)

            const stills = eventJson.filter(e => e.Key.endsWith('jpg') && e.Key.indexOf('snapshot') === -1)
            const movies = eventJson.filter(e => e.Key.endsWith('mp4'))

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

function clearCams() {
    document.querySelectorAll('.cams .image-container').forEach(e => e.remove())
}

function clearEvents() {
    document.querySelectorAll('.cam-events .vid-container').forEach(e => e.remove())
}

function updateCamsPage() {
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
    updateCamsPage()
}