import {beginCell, BitBuilder, BitReader, Cell} from '@ton/core';

const OFF_CHAIN_CONTENT_PREFIX = 0x01

// export function flattenSnakeCell(cell: Cell) {
//     let c: Cell|null = cell

//     let res = Buffer.alloc(0)

//     while (c) {
//         let cs = c.beginParse()
//         let data = cs.loadBuffer(cs.remainingBits / 8);

//         res = Buffer.concat([res, data])
//         c = c.refs[0]
//     }

//     return res
// }
// // export function flattenSnakeCell(cell: Cell): Buffer {
// //     let c: Cell | null = cell;
  
// //     const bitResult = new BitBuilder();
// //     while (c) {
// //       const cs = c.beginParse();
// //       if (cs.remainingBits === 0) {
// //         break;
// //       }
  
// //       const data = cs.loadBits(cs.remainingBits);
// //       bitResult.writeBits(data);
// //       c = c.refs && c.refs[0];
// //     }
  
// //     const endBits = bitResult.build();
// //     const reader = new BitReader(endBits);
  
// //     return reader.loadBuffer(reader.remaining / 8);
// //  }

// function bufferToChunks(buff: Buffer, chunkSize: number) {
//     const chunks: Buffer[] = [];
//     while (buff.byteLength > 0) {
//       chunks.push(buff.subarray(0, chunkSize));
//       buff = buff.subarray(chunkSize);
//     }
//     return chunks;
// }

// function makeSnakeCell(data: Buffer) {
//   const chunks = bufferToChunks(data, 127);
//   const b = chunks.reduceRight((curCell, chunk, index) => {
//     curCell.storeBuffer(chunk);
//     if (index > 0) {
//       const cell = curCell.endCell();
//       return beginCell().storeRef(cell);
//     } else {
//       return curCell;
//     }
//   }, beginCell());
//   return b.endCell();
// }

export function encodeOffChainContent(content: string) : Cell {
    // let data = Buffer.from(content)
    // let offChainPrefix = Buffer.from([OFF_CHAIN_CONTENT_PREFIX])
    // data = Buffer.concat([offChainPrefix, data])
    // return makeSnakeCell(data)
    return beginCell()
        .storeUint(OFF_CHAIN_CONTENT_PREFIX, 8)
        .storeStringTail(content)
        .endCell()
}

export function decodeOffChainContent(content: Cell) {
    // let data = flattenSnakeCell(content)

    // let prefix = data[0]
    // if (prefix !== OFF_CHAIN_CONTENT_PREFIX) {
    //     throw new Error(`Unknown content prefix: ${prefix.toString(16)}`)
    // }
    // return data.slice(1).toString()
    let p = content.beginParse();
    let prefix = p.loadUint(8)
    if (prefix !== OFF_CHAIN_CONTENT_PREFIX) {
        throw new Error(`Unknown content prefix: ${prefix.toString(16)}`)
    }

    return p.loadStringTail()
}