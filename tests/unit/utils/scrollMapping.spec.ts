import { describe, expect, it } from 'vitest'
import {
  createScrollAnchors,
  mapScrollPosition,
  type ScrollAnchor,
} from '../../../src/utils/scrollMapping'

describe('createScrollAnchors', () => {
  it('原文の順に対応点を並べ、スクロール可能範囲の先頭と末尾を加える', () => {
    const positions: ScrollAnchor[] = [
      { editor: 300, output: 450 },
      { editor: 100, output: 200 },
    ]

    expect(createScrollAnchors(positions, 600, 900)).toEqual([
      { editor: 0, output: 0 },
      { editor: 100, output: 200 },
      { editor: 300, output: 450 },
      { editor: 600, output: 900 },
    ])
    expect(positions).toEqual([
      { editor: 300, output: 450 },
      { editor: 100, output: 200 },
    ])
  })

  it('末尾の対応点が片側の最大スクロール位置を超えても移動しない区間を作らない', () => {
    const anchors: ScrollAnchor[] = createScrollAnchors(
      [
        { editor: 200, output: 100 },
        { editor: 500, output: 300 },
        { editor: 300, output: 450 },
        { editor: 400, output: 250 },
        { editor: 350, output: 400 },
      ],
      400,
      400,
    )

    expect(anchors).toEqual([
      { editor: 0, output: 0 },
      { editor: 200, output: 100 },
      { editor: 400, output: 400 },
    ])
    expect(mapScrollPosition(anchors, 'editor', 300)).toBe(250)
    expect(mapScrollPosition(anchors, 'output', 250)).toBe(300)
  })

  it('同じ行や同じ表示位置の対応点と逆行する位置を除外する', () => {
    expect(
      createScrollAnchors(
        [
          { editor: 100, output: 180 },
          { editor: 100, output: 120 },
          { editor: 200, output: 120 },
          { editor: 250, output: 100 },
          { editor: 300, output: 300 },
          { editor: 300, output: 300 },
        ],
        500,
        600,
      ),
    ).toEqual([
      { editor: 0, output: 0 },
      { editor: 100, output: 120 },
      { editor: 300, output: 300 },
      { editor: 500, output: 600 },
    ])
  })

  it('負の位置、非有限値、原点と重なる位置を除外する', () => {
    expect(
      createScrollAnchors(
        [
          { editor: -20, output: 100 },
          { editor: 20, output: -100 },
          { editor: Number.NaN, output: 100 },
          { editor: 100, output: Number.NaN },
          { editor: Number.POSITIVE_INFINITY, output: 100 },
          { editor: 100, output: Number.NEGATIVE_INFINITY },
          { editor: 0, output: 30 },
          { editor: 40, output: 0 },
          { editor: 0, output: 0 },
          { editor: 100, output: 200 },
        ],
        400,
        600,
      ),
    ).toEqual([
      { editor: 0, output: 0 },
      { editor: 100, output: 200 },
      { editor: 400, output: 600 },
    ])
  })

  it('対応する内容の目印がない場合も先頭と末尾で補間できる', () => {
    const anchors: ScrollAnchor[] = createScrollAnchors([], 400, 600)

    expect(anchors).toEqual([
      { editor: 0, output: 0 },
      { editor: 400, output: 600 },
    ])
    expect(mapScrollPosition(anchors, 'editor', 200)).toBe(300)
  })

  it.each([
    [0, 0],
    [0, 400],
    [400, 0],
    [-10, 400],
    [400, -10],
    [Number.NaN, 400],
    [400, Number.NaN],
    [Number.POSITIVE_INFINITY, 400],
    [400, Number.POSITIVE_INFINITY],
  ])('スクロール可能な範囲でない最大値 %s / %s を安全に扱う', (editor, output) => {
    const anchors: ScrollAnchor[] = createScrollAnchors(
      [{ editor: 100, output: 100 }],
      editor,
      output,
    )

    expect(anchors).toEqual([{ editor: 0, output: 0 }])
    expect(mapScrollPosition(anchors, 'editor', 100)).toBe(0)
    expect(mapScrollPosition(anchors, 'output', 100)).toBe(0)
  })
})

describe('mapScrollPosition', () => {
  const anchors: ScrollAnchor[] = createScrollAnchors(
    [
      { editor: 100, output: 200 },
      { editor: 300, output: 300 },
    ],
    500,
    700,
  )

  it('表示の高さが異なるブロック間で対応する内容の位置を補間する', () => {
    expect(mapScrollPosition(anchors, 'editor', 50)).toBe(100)
    expect(mapScrollPosition(anchors, 'editor', 100)).toBe(200)
    expect(mapScrollPosition(anchors, 'editor', 200)).toBe(250)
    expect(mapScrollPosition(anchors, 'editor', 400)).toBe(500)
  })

  it('プレビューから原文へ同じ対応区間で逆方向に補間する', () => {
    expect(mapScrollPosition(anchors, 'output', 100)).toBe(50)
    expect(mapScrollPosition(anchors, 'output', 200)).toBe(100)
    expect(mapScrollPosition(anchors, 'output', 250)).toBe(200)
    expect(mapScrollPosition(anchors, 'output', 500)).toBe(400)
  })

  it.each(['editor', 'output'] as const)('%sから先頭・末尾と範囲外の位置を揃える', (source) => {
    const sourceMaximum: number = source === 'editor' ? 500 : 700
    const targetMaximum: number = source === 'editor' ? 700 : 500

    expect(mapScrollPosition(anchors, source, 0)).toBe(0)
    expect(mapScrollPosition(anchors, source, -100)).toBe(0)
    expect(mapScrollPosition(anchors, source, sourceMaximum)).toBe(targetMaximum)
    expect(mapScrollPosition(anchors, source, sourceMaximum + 100)).toBe(targetMaximum)
    expect(mapScrollPosition(anchors, source, Number.NEGATIVE_INFINITY)).toBe(0)
    expect(mapScrollPosition(anchors, source, Number.POSITIVE_INFINITY)).toBe(targetMaximum)
    expect(mapScrollPosition(anchors, source, Number.NaN)).toBe(0)
  })

  it('目印がない場合と一点だけの場合は不正な位置を返さない', () => {
    expect(mapScrollPosition([], 'editor', 100)).toBe(0)
    expect(mapScrollPosition([], 'output', 100)).toBe(0)
    expect(mapScrollPosition([{ editor: 20, output: 40 }], 'editor', 100)).toBe(40)
    expect(mapScrollPosition([{ editor: 20, output: 40 }], 'output', 0)).toBe(20)
  })

  it('幅変更で原文の折り返しが増えた後も再計測した対応位置を使える', () => {
    const wideAnchors: ScrollAnchor[] = createScrollAnchors(
      [{ editor: 120, output: 240 }],
      400,
      700,
    )
    const narrowAnchors: ScrollAnchor[] = createScrollAnchors(
      [{ editor: 240, output: 240 }],
      640,
      700,
    )

    expect(mapScrollPosition(wideAnchors, 'editor', 120)).toBe(240)
    expect(mapScrollPosition(narrowAnchors, 'editor', 120)).toBe(120)
    expect(mapScrollPosition(narrowAnchors, 'editor', 240)).toBe(240)
    expect(mapScrollPosition(narrowAnchors, 'output', 240)).toBe(240)
  })
})
