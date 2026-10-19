$(function () {
  const fields = {
    avrValue: '',
    updRate: 'FPS',
    osc: ''
  }

  Object.keys(fields).forEach(function (field) {
    $('[data-' + field + ']').each(function () {
      $(this).text($(this).attr('data-' + field) + fields[field])
    })
  })

  const pupil = window.vrcpupil

  if (!pupil) {
    console.log('status: bridge unavailable, OSC status disabled')
    return
  }

  const osc = $('[data-osc]')

  pupil.onOscStatus(function (status) {
    osc.attr('data-osc', status.state)
    osc.text(status.state)
    osc.attr('title', status.port ? 'Listening on port ' + status.port : 'Not listening')
  })
})
