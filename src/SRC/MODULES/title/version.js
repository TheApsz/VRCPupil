$(function () {
  const pupil = window.vrcpupil

  if (!pupil) {
    console.log('version: bridge unavailable, version not shown')
    return
  }

  pupil.getVersion().then(function (version) {
    $('#appVersion').text(version)
  })
})
