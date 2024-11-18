import { beginCell, Cell } from '@ton/core';

const OFF_CHAIN_CONTENT_PREFIX = 0x01

export function encodeOffChainContent(content: string) : Cell {
    return beginCell()
        .storeUint(OFF_CHAIN_CONTENT_PREFIX, 8)
        .storeStringTail(content)
        .endCell()
}

export function decodeOffChainContent(content: Cell) {
    let p = content.beginParse();
    let prefix = p.loadUint(8)
    if (prefix !== OFF_CHAIN_CONTENT_PREFIX) {
        throw new Error(`Unknown content prefix: ${prefix.toString(16)}`)
    }
    return p.loadStringTail()
}

export function encodeOffChainContentWithoutPrefix(content: string) : Cell {
    return beginCell().storeStringTail(content).endCell()
}

export function decodeOffChainContentWithoutPrefix(content: Cell) {
    return content.beginParse().loadStringTail()
}