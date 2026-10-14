import type { ConversionSourcePosition } from '../types/conversion'
import type { BlockNode } from '../types/markdown'

type BlockRenderOptions = {
  separator: string | ((previous: BlockNode, current: BlockNode) => string)
  sourceMap?: ConversionSourcePosition[]
  omitEmpty?: boolean
}

export function renderConvertedBlocks(
  blocks: BlockNode[],
  renderBlock: (block: BlockNode) => string,
  options: BlockRenderOptions,
): string {
  const chunks: string[] = []
  let previous: BlockNode | undefined
  let outputLine = 1

  function append(value: string): void {
    chunks.push(value)
    if (options.sourceMap) {
      outputLine += value.split(/\r\n|\r|\n/u).length - 1
    }
  }

  for (const block of blocks) {
    const output = renderBlock(block)
    if (options.omitEmpty && output.length === 0) {
      continue
    }
    if (previous) {
      append(typeof options.separator === 'string'
        ? options.separator
        : options.separator(previous, block))
    }
    const line = block.location?.line
    if (output.length > 0 && line !== undefined && Number.isInteger(line) && line > 0) {
      options.sourceMap?.push({ sourceLine: line, outputLine })
    }
    append(output)
    previous = block
  }
  return chunks.join('')
}
