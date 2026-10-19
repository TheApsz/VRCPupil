$(function () {
  const pupil = window.vrcpupil

  if (!pupil) {
    console.log('frame: bridge unavailable, window controls disabled')
    return
  }

  $('#frameMin').on('click', function () { pupil.minimize() })
  $('#frameX').on('click', function () { pupil.close() })
})
