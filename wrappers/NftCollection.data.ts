// import {Address, beginCell, Cell, contractAddress, StateInit} from '@ton/core';
// import {NftCollectionCodeCell} from "./NftCollection.source";
// import {encodeOffChainContent} from "./NftContent";

// export type RoyaltyParams = {
//     royaltyFactor: number
//     royaltyBase: number
//     royaltyAddress: Address
// }

// export type NftCollectionData = {
//     ownerAddress: Address,
//     nextItemIndex: number | BN
//     collectionContent: string
//     commonContent: string
//     nftItemCode: Cell
//     royaltyParams: RoyaltyParams
// }

// // default#_ royalty_factor:uint16 royalty_base:uint16 royalty_address:MsgAddress = RoyaltyParams;
// // storage#_ owner_address:MsgAddress next_item_index:uint64
// //           ^[collection_content:^Cell common_content:^Cell]
// //           nft_item_code:^Cell
// //           royalty_params:^RoyaltyParams
// //           = Storage;

// export function buildNftCollectionDataCell(data: NftCollectionData) {
//     let dataCell = beginCell()

//     dataCell.storeAddress(data.ownerAddress)
//     dataCell.storeUint(data.nextItemIndex, 64)

//     let collectionContent = encodeOffChainContent(data.collectionContent)

//     let commonContent = beginCell()
//     commonContent.storeBuffer(Buffer.from(data.commonContent))
//     // commonContent.bits.writeString(data.commonContent)

//     let contentCell = beginCell()

//     contentCell.storeRef(collectionContent)
//     contentCell.storeRef(commonContent)
//     dataCell.storeRef(contentCell)

//     dataCell.storeRef(data.nftItemCode)

//     let royaltyCell = beginCell()
//     royaltyCell.storeUint(data.royaltyParams.royaltyFactor, 16)
//     royaltyCell.storeUint(data.royaltyParams.royaltyBase, 16)
//     royaltyCell.storeAddress(data.royaltyParams.royaltyAddress)
//     dataCell.storeRef(royaltyCell)

//     return dataCell
// }

// export function buildNftCollectionStateInit(conf: NftCollectionData, code: Cell, workchain = 0) {
//     let dataCell = buildNftCollectionDataCell(conf)
//     let stateInit = new StateInit({
//         code: code,
//         data: dataCell
//     })

//     let stateInitCell = new Cell()
//     stateInit.writeTo(stateInitCell)

//     let address = contractAddress({workchain: 0, initialCode: NftCollectionCodeCell, initialData: dataCell})

//     const init = { code, dataCell };
//     return new NftCollection(contractAddress(workchain, init), init);

//     return {
//         stateInit: stateInitCell,
//         stateInitMessage: stateInit,
//         address
//     }
// }

// export const OperationCodes = {
//     Mint: 1,
//     BatchMint: 2,
//     ChangeOwner: 3,
//     EditContent: 4,
//     GetRoyaltyParams: 0x693d3950,
//     GetRoyaltyParamsResponse: 0xa8cb00ad
// }

// export type CollectionMintItemInput = {
//     passAmount: BN
//     index: number
//     ownerAddress: Address
//     content: string
// }

// export const Queries = {
//     mint: (params: { queryId?: number, passAmount: BN, itemIndex: number, itemOwnerAddress: Address, itemContent: string }) => {
//         let msgBody = beginCell()

//         msgBody.storeUint(OperationCodes.Mint, 32)
//         msgBody.storeUint(params.queryId || 0, 64)
//         msgBody.storeUint(params.itemIndex, 64)
//         msgBody.storeCoins(params.passAmount)

//         let itemContent = beginCell()
//         // itemContent.bits.writeString(params.itemContent)
//         itemContent.storeBuffer(Buffer.from(params.itemContent))

//         let nftItemMessage = beginCell()

//         nftItemMessage.storeAddress(params.itemOwnerAddress)
//         nftItemMessage.storeRef(itemContent)

//         msgBody.storeRef(nftItemMessage)

//         return msgBody
//     },
//     batchMint: (params: { queryId?: number, items: CollectionMintItemInput[] }) => {
//         if (params.items.length > 250) {
//             throw new Error('Too long list')
//         }

//         let itemsMap = new Map<string, CollectionMintItemInput>()

//         for (let item of params.items) {
//             itemsMap.set(item.index.toString(10), item)
//         }

//         let dictCell = serializeDict(itemsMap, 64, (src, cell) => {
//             let nftItemMessage = beginCell()

//             let itemContent = beginCell()
//             // itemContent.bits.writeString(packages.content)
//             itemContent.storeBuffer(Buffer.from(src.content))

//             nftItemMessage.storeAddress(src.ownerAddress)
//             nftItemMessage.storeRef(itemContent)

//             cell.storeCoins(src.passAmount)
//             cell.storeRef(nftItemMessage)
//         })

//         let msgBody = beginCell()

//         msgBody.storeUint(OperationCodes.BatchMint, 32)
//         msgBody.storeUint(params.queryId || 0, 64)
//         msgBody.storeRef(dictCell)

//         return msgBody
//     },
//     changeOwner: (params: { queryId?: number, newOwner: Address}) => {
//         let msgBody = beginCell()
//         msgBody.storeUint(OperationCodes.ChangeOwner, 32)
//         msgBody.storeUint(params.queryId || 0, 64)
//         msgBody.storeAddress(params.newOwner)
//         return msgBody
//     },
//     getRoyaltyParams: (params: { queryId?: number }) => {
//         let msgBody = beginCell()
//         msgBody.storeUint(OperationCodes.GetRoyaltyParams, 32)
//         msgBody.storeUint(params.queryId || 0, 64)
//         return msgBody
//     },
//     editContent: (params: { queryId?: number,  collectionContent: string, commonContent: string,  royaltyParams: RoyaltyParams  }) => {
//         let msgBody = beginCell()
//         msgBody.storeUint(OperationCodes.EditContent, 32)
//         msgBody.storeUint(params.queryId || 0, 64)

//         let royaltyCell = beginCell()
//         royaltyCell.storeUint(params.royaltyParams.royaltyFactor, 16)
//         royaltyCell.storeUint(params.royaltyParams.royaltyBase, 16)
//         royaltyCell.storeAddress(params.royaltyParams.royaltyAddress)

//         let contentCell = beginCell()

//         let collectionContent = encodeOffChainContent(params.collectionContent)

//         let commonContent = beginCell()
//         // commonContent.bits.writeString(params.commonContent)
//         commonContent.storeBuffer(Buffer.from(params.commonContent))

//         contentCell.storeRef(collectionContent)
//         contentCell.storeRef(commonContent)

//         msgBody.storeRef(contentCell)
//         msgBody.storeRef(royaltyCell)

//         return msgBody
//     }
// }