$(function () {
  const pupil = window.vrcpupil

  if (!pupil) {
    console.log('settings: bridge unavailable, settings disabled')
    return
  }

  const input = $('#avatarParameterText')
  const wrapper = input.parent()
  const list = $('<div class="paramDropdown" id="avatarParameterList" role="listbox"></div>').appendTo(wrapper)

  const MAX_VISIBLE_PX = 148
  let discovered = []
  const values = new Map()
  let activeIndex = -1
  let open = false
  let savedParameter = ''

  function isOpen () {
    return open
  }

  function setOpen (value) {
    open = value
    list.toggleClass('open', value)
    input.attr('aria-expanded', value ? 'true' : 'false')

    if (!value) {
      activeIndex = -1
      markActive()
      return
    }

    place()
  }

  function place () {
    const rect = wrapper[0].getBoundingClientRect()
    const roomBelow = window.innerHeight - rect.bottom
    list.toggleClass('flip', roomBelow < MAX_VISIBLE_PX + 12)
  }

  function visibleNames () {
    const query = String(input.val() || '').trim().toLowerCase()
    const names = discovered.map((param) => param.name)
    if (!query) return names
    return names.filter((name) => name.toLowerCase().includes(query))
  }

  function formatValue (value) {
    return typeof value === 'number' ? value.toFixed(2) : String(value)
  }

  function render () {
    const current = String(input.val() || '')
    const names = visibleNames()
    const root = list[0]

    root.innerHTML = ''
    activeIndex = -1

    if (names.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'paramEmpty'
      empty.textContent = discovered.length === 0
        ? 'No parameters seen yet. Load your avatar in VRChat, then move something that drives a parameter. You can still type a name.'
        : 'Nothing matches. Type a name to use it anyway.'
      root.appendChild(empty)
      return
    }

    names.forEach((name) => {
      const option = document.createElement('div')
      option.className = 'paramOption'
      option.setAttribute('role', 'option')

      const label = document.createElement('span')
      label.className = 'name'
      label.textContent = name
      option.appendChild(label)

      if (values.has(name)) {
        const badge = document.createElement('span')
        badge.className = 'value'
        badge.textContent = formatValue(values.get(name))
        option.appendChild(badge)
      }

      if (name === current) option.dataset.selected = 'true'

      option.addEventListener('mousedown', (event) => {
        event.preventDefault()
        choose(name)
      })

      root.appendChild(option)
    })
  }

  function markActive () {
    const options = list[0].querySelectorAll('.paramOption')

    options.forEach((option, index) => {
      if (index === activeIndex) option.dataset.active = 'true'
      else delete option.dataset.active
    })

    if (activeIndex >= 0 && options[activeIndex]) {
      options[activeIndex].scrollIntoView({ block: 'nearest' })
    }
  }

  function save (name, writeBack) {
    pupil.setAvatarParameter(name).then((clean) => {
      savedParameter = clean
      if (writeBack) input.val(clean)
    })
  }

  function choose (name) {
    save(name, true)
    setOpen(false)
    input[0].blur()
  }

  input.on('focus', () => {
    render()
    setOpen(true)
  })

  input.on('input', () => {
    render()
    setOpen(true)
  })

  input.on('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!isOpen()) {
        render()
        setOpen(true)
        return
      }

      const count = list[0].querySelectorAll('.paramOption').length
      if (count === 0) return

      const step = event.key === 'ArrowDown' ? 1 : -1
      activeIndex = (activeIndex + step + count) % count
      event.preventDefault()
      markActive()
      return
    }

    if (event.key === 'Enter') {
      const options = list[0].querySelectorAll('.paramOption')
      if (!isOpen() || activeIndex < 0 || !options[activeIndex]) return

      event.preventDefault()
      choose(options[activeIndex].querySelector('.name').textContent)
    }
  })

  input.on('change', () => {
    if (String(input.val() || '') !== savedParameter) save(input.val(), true)
    setOpen(false)
  })

  window.addEventListener('blur', () => {
    if (String(input.val() || '') !== savedParameter) save(input.val(), false)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && String(input.val() || '') !== savedParameter) {
      save(input.val(), false)
    }
  })

  document.addEventListener('mousedown', (event) => {
    if (!isOpen()) return
    if (wrapper[0].contains(event.target)) return
    setOpen(false)
  })

  pupil.onOscStatus((status) => {
    discovered = status.parameters || []

    values.clear()
    discovered.forEach((param) => values.set(param.name, param.value))

    if (isOpen()) {
      const active = activeIndex
      render()
      activeIndex = active
      markActive()
    }
  })

  const rangeMin = $('#pupilMin')
  const rangeMax = $('#pupilMax')
  const rangeFill = $('#pupilRange .rangeFill')
  const rangeReadout = $('#rangeReadout')
  const RANGE_GAP = 0.01

  const round2 = (value) => Math.round(value * 100) / 100

  function showRange (min, max) {
    rangeFill[0].style.left = min * 100 + '%'
    rangeFill[0].style.width = (max - min) * 100 + '%'
    rangeReadout.text(min.toFixed(2) + ' – ' + max.toFixed(2))
  }

  function saveRange () {
    const min = round2(Number(rangeMin.val()))
    const max = round2(Number(rangeMax.val()))

    showRange(min, max)
    return pupil.updateSettings({ pupilMin: min, pupilMax: max }).then((settings) => {
      if (round2(Number(rangeMin.val())) !== min || round2(Number(rangeMax.val())) !== max) return

      rangeMin.val(settings.pupilMin)
      rangeMax.val(settings.pupilMax)
      showRange(settings.pupilMin, settings.pupilMax)
      return settings
    })
  }

  rangeMin.on('input', () => {
    const max = Number(rangeMax.val())
    if (Number(rangeMin.val()) > max - RANGE_GAP) rangeMin.val(Math.max(0, round2(max - RANGE_GAP)))
    showRange(Number(rangeMin.val()), Number(rangeMax.val()))
  })

  rangeMax.on('input', () => {
    const min = Number(rangeMin.val())
    if (Number(rangeMax.val()) < min + RANGE_GAP) rangeMax.val(Math.min(1, round2(min + RANGE_GAP)))
    showRange(Number(rangeMin.val()), Number(rangeMax.val()))
  })

  rangeMin.on('change', saveRange)
  rangeMax.on('change', saveRange)

  function applyRange (min, max) {
    rangeMin.val(min)
    rangeMax.val(max)
    showRange(min, max)
  }

  function setRangeMuted (muted) {
    $('#pupilRange').toggleClass('muted', muted)
    rangeMin.prop('disabled', muted)
    rangeMax.prop('disabled', muted)
  }

  pupil.onOscStatus((status) => {
    const range = status.pupilRange
    if (!range || !range.auto) return

    applyRange(range.min, range.max)
  })

  const rateInput = $('#updateRate')
  const rateFill = $('#rateInput .rangeFill')
  const rateReadout = $('#rateReadout')
  const rateCard = $('[data-updRate]')
  const RATE_MIN = Number(rateInput.attr('min')) || 3
  const RATE_MAX = Number(rateInput.attr('max')) || 60

  function showRate (fps) {
    const position = ((fps - RATE_MIN) / (RATE_MAX - RATE_MIN)) * 100
    rateFill[0].style.left = '0'
    rateFill[0].style.width = position + '%'
    rateReadout.text(fps + ' FPS')

    rateCard.attr('data-updRate', fps)
    rateCard.text(fps + 'FPS')
  }

  rateInput.on('input', () => showRate(Math.round(Number(rateInput.val()))))

  rateInput.on('change', () => {
    const fps = Math.round(Number(rateInput.val()))
    showRate(fps)
    pupil.updateSettings({ updateRate: fps }).then((settings) => {
      if (Math.round(Number(rateInput.val())) !== fps) return
      rateInput.val(settings.updateRate)
      showRate(settings.updateRate)
    })
  })

  const toggles = $('.toggle')

  function setToggle (element, on) {
    element.dataset.on = on ? 'true' : 'false'
    element.setAttribute('aria-checked', on ? 'true' : 'false')
  }

  pupil.getSettings().then((settings) => {
    savedParameter = settings.avatarParameter
    input.val(savedParameter)

    rangeMin.val(settings.pupilMin)
    rangeMax.val(settings.pupilMax)
    showRange(settings.pupilMin, settings.pupilMax)

    rateInput.val(settings.updateRate)
    showRate(settings.updateRate)

    toggles.each(function () {
      setToggle(this, Boolean(settings[this.dataset.toggle]))
    })

    setRangeMuted(Boolean(settings.autoRange))
  })

  toggles.each(function () {
    const toggle = this
    let seq = 0

    function flip () {
      const key = toggle.dataset.toggle
      const next = toggle.dataset.on !== 'true'
      const mine = ++seq

      setToggle(toggle, next)
      if (key === 'autoRange') setRangeMuted(next)

      pupil.updateSettings({ [key]: next }).then((settings) => {
        if (mine !== seq) return

        const applied = Boolean(settings[key])
        setToggle(toggle, applied)

        if (key === 'autoRange') {
          setRangeMuted(applied)
          if (!applied) applyRange(settings.pupilMin, settings.pupilMax)
        }
      })
    }

    toggle.addEventListener('click', flip)
    toggle.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        flip()
      }
    })
  })
})
