$(function () {
  const pupil = window.vrcpupil

  if (!pupil) {
    console.log('capture: bridge unavailable, capture disabled')
    return
  }

  const COLS = 7
  const ROWS = 5
  const CELL_PX = 16
  const RETRY_MS = 2000
  const DEADZONE = 0.1
  // Windows title bar height at 100% scale, cut off the top of every capture.
  const TITLE_BAR_DIP = 31

  const matrix = $('#previewMatrix')
  const avrValue = $('[data-avrValue]')
  const updRate = $('[data-updRate]')

  const cells = []
  for (let i = 0; i < COLS * ROWS; i++) {
    const cell = $('<div class="cell"><h2></h2></div>')
    matrix.append(cell)
    cells.push({ box: cell, label: cell.find('h2') })
  }

  const canvas = document.createElement('canvas')
  canvas.width = COLS * CELL_PX
  canvas.height = ROWS * CELL_PX
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true

  let timer = null
  let lastSent = null

  // Average grayscale (0..1) of each cell's area, row by row.
  function sampleCells () {
    const cropTop = Math.round(TITLE_BAR_DIP * window.devicePixelRatio)
    ctx.drawImage(video, 0, cropTop, video.videoWidth, video.videoHeight - cropTop, 0, 0, canvas.width, canvas.height)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const values = []

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        let total = 0
        for (let y = 0; y < CELL_PX; y++) {
          for (let x = 0; x < CELL_PX; x++) {
            const px = ((row * CELL_PX + y) * canvas.width + col * CELL_PX + x) * 4
            total += 0.299 * data[px] + 0.587 * data[px + 1] + 0.114 * data[px + 2]
          }
        }
        values.push(total / (CELL_PX * CELL_PX * 255))
      }
    }
    return values
  }

  // 35 cells is odd, so the median is always an actual cell value.
  function median (values) {
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
  }

  function paint (cell, value) {
    const shade = Math.round(value * 255)
    cell.box.css('background', `rgb(${shade}, ${shade}, ${shade})`)
    cell.label.css('color', value > 0.5 ? '#000' : '#fff')
    cell.label.text(value.toFixed(2))
  }

  function tick () {
    const values = sampleCells()
    values.forEach((value, i) => paint(cells[i], value))

    const output = median(values)
    avrValue.text(output.toFixed(2))

    if (lastSent !== null && Math.abs(output - lastSent) < DEADZONE) return
    lastSent = output
    pupil.sendDilation(output)
  }

  function loop () {
    tick()
    const fps = parseInt(updRate.attr('data-updRate'), 10) || 10
    timer = setTimeout(loop, 1000 / fps)
  }

  async function connect () {
    let stream
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    } catch (err) {
      console.log('capture: VRChat window not available, retrying')
      timer = setTimeout(connect, RETRY_MS)
      return
    }

    video.srcObject = stream
    await video.play()
    stream.getVideoTracks()[0].addEventListener('ended', lost)
    loop()
  }

  function lost () {
    clearTimeout(timer)
    video.srcObject = null
    lastSent = null
    avrValue.text('0.00')
    timer = setTimeout(connect, RETRY_MS)
  }

  connect()
})
