// 開発用試作。製品からはimportせず、No.6設計書の再現手順でだけ実行する。
/** @param {HTMLTextAreaElement} textarea @param {Iterable<number>} offsets */
export function probeTypewriterMeasurement(textarea, offsets) {
  const properties = [
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'font-stretch', 'line-height', 'letter-spacing', 'word-spacing',
    'text-indent', 'text-transform', 'text-align', 'tab-size', 'white-space',
    'overflow-wrap', 'word-break', 'direction',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  ]
  const style = getComputedStyle(textarea)
  const source = textarea.value
  const mirror = document.createElement('div')
  mirror.setAttribute('aria-hidden', 'true')
  mirror.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;box-sizing:border-box;border:0;'
  mirror.style.width = `${textarea.clientWidth}px`
  for (const property of properties) mirror.style.setProperty(property, style.getPropertyValue(property))
  document.body.append(mirror)
  const lineHeight = parseFloat(style.lineHeight)
  const measurements = []
  try {
    for (const offset of offsets) {
      const started = performance.now()
      const marker = document.createElement('span')
      const before = document.createTextNode(source.slice(0, offset))
      const after = document.createTextNode(source.slice(offset))
      mirror.replaceChildren(before, marker, after)
      const markerRect = marker.getBoundingClientRect()
      const markedTop = markerRect.top - mirror.getBoundingClientRect().top
      const markedHeight = mirror.getBoundingClientRect().height
      const durationMs = performance.now() - started
      // マーカーなしの同じ原文と比較し、折り返しを変える副作用を検出する。
      const plain = document.createTextNode(source)
      mirror.replaceChildren(plain)
      const plainHeight = mirror.getBoundingClientRect().height
      const range = document.createRange()
      range.setStart(plain, offset)
      range.setEnd(plain, offset)
      const rangeRect = range.getBoundingClientRect()
      const rangeTop = rangeRect.height ? rangeRect.top - mirror.getBoundingClientRect().top : null
      const plainCenter = rangeTop === null ? null : rangeTop + rangeRect.height / 2
      const markerCenter = markedTop + markerRect.height / 2
      measurements.push({ offset, markedTop, markedHeight, plainHeight, rangeTop,
        // spanは除去前に測った矩形を使用し、字体による高さの違いも記録する。
        markerCenter, plainCenter, durationMs, lineHeight,
        heightDelta: markedHeight - plainHeight,
        yDelta: rangeTop === null ? null : markedTop - rangeTop,
      })
    }
    return { sourceLength: source.length, width: textarea.clientWidth, lineHeight, measurements }
  } finally {
    mirror.remove()
  }
}

/** @param {HTMLTextAreaElement} textarea */
export function probeTypewriterTailPadding(textarea) {
  const style = getComputedStyle(textarea)
  const clone = document.createElement('textarea')
  clone.setAttribute('aria-hidden', 'true')
  clone.tabIndex = -1
  for (const property of style) clone.style.setProperty(property, style.getPropertyValue(property))
  clone.style.cssText += `;position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;box-sizing:border-box;border:0;width:${textarea.clientWidth}px;height:${textarea.clientHeight}px;min-height:0;max-height:none;resize:none;overflow:auto;`
  clone.value = textarea.value
  document.body.append(clone)
  try {
    const lineHeight = parseFloat(style.lineHeight)
    const targetY = clone.clientHeight / 2
    const padding = Math.max(parseFloat(style.paddingBottom), clone.clientHeight - targetY - lineHeight / 2)
    clone.style.paddingBottom = `${padding}px`
    const probe = probeTypewriterMeasurement(clone, [clone.value.length])
    const last = probe.measurements[0]
    const desired = last.markerCenter - targetY
    clone.scrollTop = Math.max(0, Math.min(clone.scrollHeight - clone.clientHeight, desired))
    return { sourceLength: clone.value.length, height: clone.clientHeight, padding,
      desired, scrollTop: clone.scrollTop, maxScroll: clone.scrollHeight - clone.clientHeight,
      centerError: Math.abs(last.markerCenter - clone.scrollTop - targetY), lineHeight }
  } finally {
    clone.remove()
  }
}
