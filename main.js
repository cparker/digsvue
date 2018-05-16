
let page = {}

function init() {
    console.log('init')
    page = getPage()
}

function getPage() {
    const p = {}

    return p
}

function handleSelectEvent(item) {
    console.log('event handler', item.srcElement)
    if (item.srcElement.paused) {
        item.srcElement.play()
    } else {
        item.srcElement.pause()
    }
} 

function loadEventVideos() {
    // get the videos

    document.querySelectorAll('.vid-container video').forEach(vid => {
        vid.addEventListener('click', handleSelectEvent)
    })
}

window.onload = () => {
    init()
    loadEventVideos()
}