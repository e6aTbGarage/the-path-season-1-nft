import { Address, beginCell, Builder, Cell, Contract, contractAddress, ContractProvider, Dictionary, DictionaryValue, Sender, SendMode, Slice } from '@ton/core';
// import BN from 'bn.js'

import {encodeOffChainContent, decodeOffChainContent} from "./NftContent";

export type RoyaltyParams = {
    royaltyFactor: number
    royaltyBase: number
    royaltyAddress: Address
}

export type NftCollectionConfig = {
    ownerAddress: Address,
    // nextItemIndex: number | BN
    nextItemIndex: number | bigint
    collectionContent: string
    commonContent: string
    nftItemCode: Cell
    royaltyParams: RoyaltyParams
}

export function nftCollectionConfigToCell(config: NftCollectionConfig): Cell {
    let commonContent = beginCell()
        // .storeString(data.commonContent)
        .storeBuffer(Buffer.from(config.commonContent))
        .endCell()

    let contentCell = beginCell()
        .storeRef(encodeOffChainContent(config.collectionContent))
        .storeRef(commonContent)
        .endCell()

    let royaltyCell = beginCell()
        .storeUint(config.royaltyParams.royaltyFactor, 16)
        .storeUint(config.royaltyParams.royaltyBase, 16)
        .storeAddress(config.royaltyParams.royaltyAddress)
        .endCell()

    return beginCell()
        .storeAddress(config.ownerAddress)
        .storeUint(config.nextItemIndex, 64)
        .storeRef(contentCell)
        .storeRef(config.nftItemCode)
        .storeRef(royaltyCell)
        .endCell()
}

export const Opcodes = {
    mint: 1,
    batch_mint: 2,
    change_owner: 3,
    change_content: 4,
    collect_balance: 5,
    change_second_owner: 6,

    get_royalty_params: 0x693d3950,
    get_royalty_params_response: 0xa8cb00ad,
};

export type CollectionMintNftItemInput = {
    passAmount: bigint
    index: number
    ownerAddress: Address
    content: string | Cell
}

export class NftCollection implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new NftCollection(address);
    }

    static createFromConfig(config: NftCollectionConfig, code: Cell, workchain = 0) {
        const data = nftCollectionConfigToCell(config);
        const init = { code, data };
        return new NftCollection(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        return await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Cell.EMPTY,
        })
    }

    //
    // Get methods
    //
    
    // async getCollectionData(provider: ContractProvider): Promise<{ nextItemId: number, ownerAddress: Address, collectionContent: string }> {
    async getCollectionData(provider: ContractProvider) {
        let res = await provider.get('get_collection_data', [])
     
        let nextItemId = res.stack.readNumber()
        let collectionContent = res.stack.readCell()
        let ownerAddress = res.stack.readAddress()
        return {
            nextItemId: nextItemId,
            collectionContent: decodeOffChainContent(collectionContent),
            ownerAddress: ownerAddress,
        }
    }
    
    async getNftAddressByIndex(provider: ContractProvider, index: number): Promise<Address> {
        let res = await provider.get('get_nft_address_by_index', [{
            type: 'int',
            value: BigInt(index)
        }])

        let nftAddress = res.stack.readAddress()
        return nftAddress
    }

    async getRoyaltyParams(provider: ContractProvider): Promise<RoyaltyParams> {
        let res = await provider.get('royalty_params', [])

        let royaltyFactor = res.stack.readNumber()
        let royaltyBase = res.stack.readNumber()
        let royaltyAddress = res.stack.readAddress();
        return {
            royaltyFactor: royaltyFactor,
            royaltyBase: royaltyBase,
            royaltyAddress: royaltyAddress,
        }
    }

    async getNftContent(provider: ContractProvider, index: number, nftIndividualContent: Cell): Promise<string> {
        let res = await provider.get('get_nft_content', [
            { type: 'int', value: BigInt(index) },
            { type: 'cell', cell: nftIndividualContent}
        ])

        let contentCell = res.stack.readCell()
        return decodeOffChainContent(contentCell)
    }

    //
    // Internal messages
    //

    async sendDeployNewNft(provider: ContractProvider, via: Sender, value: bigint, opts: { queryId?: number, passAmount: bigint, itemIndex: number, itemOwnerAddress: Address, itemContent: string }) {
        let itemContent = beginCell()
            .storeStringTail(opts.itemContent)
            .endCell()

        let nftItemMessage = beginCell()
            .storeAddress(opts.itemOwnerAddress)
            .storeRef(itemContent)
            .endCell()

        return await provider.internal(via, {
            value,
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.mint, 32)
                .storeUint(opts.queryId || 0, 64)
                .storeUint(opts.itemIndex, 64)
                .storeCoins(opts.passAmount)
                .storeRef(nftItemMessage)
                .endCell(),
        })
    }
    
    async sendBatchDeployNft(provider: ContractProvider, via: Sender, value: bigint, params: { queryId?: number, items: CollectionMintNftItemInput[] }) {
        if (params.items.length > 250) {
            throw new Error('Too long list')
        }

        class CollectionMintNftItemInputDictionaryValue implements DictionaryValue<CollectionMintNftItemInput> {
            serialize(src: CollectionMintNftItemInput, cell: Builder): void {
                let nftItemMessage = beginCell();
                let itemContent = (src.content instanceof Cell) ? src.content : 
                    beginCell().storeStringTail(src.content).endCell();
                nftItemMessage.storeAddress(src.ownerAddress);
                nftItemMessage.storeRef(itemContent);
                cell.storeCoins(src.passAmount);
                cell.storeRef(nftItemMessage);
            }

            parse(cell: Slice): CollectionMintNftItemInput {
                const nftItemMessage = cell.loadRef().beginParse();
                const itemContent = nftItemMessage.loadRef();
                const ownerAddress = nftItemMessage.loadAddress();
                const content = itemContent;
                const passAmount = cell.loadCoins();
                return {
                    index: 0,
                    ownerAddress,
                    content,
                    passAmount
                };
            }
        }

        let itemsMap = Dictionary.empty<number, CollectionMintNftItemInput>(Dictionary.Keys.Uint(64), new CollectionMintNftItemInputDictionaryValue());
        for (let item of params.items) {
            itemsMap.set(item.index, item)
        }

        let dictCell = beginCell()
            .storeDictDirect(itemsMap)
            .endCell();
        
        return await provider.internal(via, {
            value: value,
            body: beginCell()
                .storeUint(Opcodes.batch_mint, 32)
                .storeUint(params.queryId || 0, 64)
                .storeRef(dictCell)
                .endCell()
        })
    }

    async sendChangeOwner(provider: ContractProvider, via: Sender, value: bigint, opts: { queryID?: number; newOwner: Address; }) {
        return await provider.internal(via, {
            value: value,
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.change_owner, 32)
                .storeUint(opts.queryID || 0, 64)
                .storeAddress(opts.newOwner)
                .endCell(),
        })
    }

    // another way to get royalty
    async sendGetRoyaltyParams(provider: ContractProvider, via: Sender, value: bigint, opts: { queryId?: number; }) {
        return await provider.internal(via, {
            value: value,
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.get_royalty_params, 32)
                .storeUint(opts.queryId || 0, 64)
                .endCell()
        })
    }

    async sendEditContent(provider: ContractProvider, via: Sender, value: bigint, opts: { queryId?: number, collectionContent: string, commonContent: string,  royaltyParams: RoyaltyParams  }) {
        let royaltyCell = beginCell()
            .storeUint(opts.royaltyParams.royaltyFactor, 16)
            .storeUint(opts.royaltyParams.royaltyBase, 16)
            .storeAddress(opts.royaltyParams.royaltyAddress)
            .endCell()

        let commonContent = beginCell()
            .storeBuffer(Buffer.from(opts.commonContent))
            .endCell()

        let contentCell = beginCell()
            .storeRef(encodeOffChainContent(opts.collectionContent))
            .storeRef(commonContent)
            .endCell()

        return await provider.internal(via, {
            value: value,
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.change_content, 32)
                .storeUint(opts.queryId || 0, 64)
                .storeRef(contentCell)
                .storeRef(royaltyCell)
                .endCell()
        })
    }
}