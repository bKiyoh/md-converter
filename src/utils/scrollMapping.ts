export type ScrollAnchor = {
  editor: number
  output: number
}

export function createScrollAnchors(
  positions: ScrollAnchor[],
  editorMaximum: number,
  outputMaximum: number,
): ScrollAnchor[] {
  const anchors: ScrollAnchor[] = [{ editor: 0, output: 0 }]

  if (
    !Number.isFinite(editorMaximum) ||
    !Number.isFinite(outputMaximum) ||
    editorMaximum <= 0 ||
    outputMaximum <= 0
  ) {
    return anchors
  }

  const candidates: ScrollAnchor[] = positions
    .filter(
      ({ editor, output }) =>
        Number.isFinite(editor) &&
        Number.isFinite(output) &&
        editor > 0 &&
        output > 0 &&
        editor < editorMaximum &&
        output < outputMaximum,
    )
    .sort((left, right) => left.editor - right.editor || left.output - right.output)

  for (const candidate of candidates) {
    const previous: ScrollAnchor = anchors[anchors.length - 1]!

    // 両方向で同じ区間を使えるよう、同位置や逆行する対応点は採用しない。
    if (candidate.editor > previous.editor && candidate.output > previous.output) {
      anchors.push({ editor: candidate.editor, output: candidate.output })
    }
  }

  // 末尾付近の対応点を片側だけ丸めると、逆方向の同期で移動しない区間が生じる。
  anchors.push({ editor: editorMaximum, output: outputMaximum })
  return anchors
}

export function mapScrollPosition(
  anchors: ScrollAnchor[],
  source: 'editor' | 'output',
  position: number,
): number {
  const first: ScrollAnchor | undefined = anchors[0]
  const last: ScrollAnchor | undefined = anchors[anchors.length - 1]
  const target: 'editor' | 'output' = source === 'editor' ? 'output' : 'editor'

  if (!first || !last) return 0
  if (Number.isNaN(position) || position <= first[source]) return first[target]
  if (position >= last[source]) return last[target]
  if (anchors.length === 1) return first[target]

  let lowerIndex: number = 0
  let upperIndex: number = anchors.length - 1

  while (upperIndex - lowerIndex > 1) {
    const middleIndex: number = Math.floor((lowerIndex + upperIndex) / 2)
    if (anchors[middleIndex]![source] <= position) {
      lowerIndex = middleIndex
    } else {
      upperIndex = middleIndex
    }
  }

  const lower: ScrollAnchor = anchors[lowerIndex]!
  const upper: ScrollAnchor = anchors[upperIndex]!
  const progress: number = (position - lower[source]) / (upper[source] - lower[source])
  return lower[target] + progress * (upper[target] - lower[target])
}
