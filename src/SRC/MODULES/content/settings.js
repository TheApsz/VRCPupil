$(function () {
  const pupil = window.vrcpupil

  if (!pupil) {
    console.log('settings: bridge unavailable, settings disabled')
    return
  }

  const input = $('#avatarParameterText')

  pupil.getSettings().then(function (settings) {
    input.val(settings.avatarParameter)
  })

  input.on('change', function () {
    pupil.setAvatarParameter(input.val()).then(function (name) {
      input.val(name)
    })
  })
})
