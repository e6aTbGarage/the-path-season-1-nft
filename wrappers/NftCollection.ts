import { Address, beginCell, Builder, Cell, Contract, contractAddress, ContractProvider, Dictionary, DictionaryValue, Sender, SendMode, Slice, toNano } from '@ton/core';
import {encodeOffChainContent, decodeOffChainContent, encodeOffChainContentWithoutPrefix, decodeOffChainContentWithoutPrefix} from "./NftContent";

export type RoyaltyParams = {
    royaltyFactor: number
    royaltyBase: number
    royaltyAddress: Address
}

export type NftCollectionConfig = {
    ownerAddress: Address,
    nextItemIndex: number | bigint
    collectionContent: string
    commonContent: string
    nftItemCode: Cell
    royaltyParams: RoyaltyParams
}

export function nftCollectionConfigToCell(config: NftCollectionConfig): Cell {
    let contentCell = beginCell()
        .storeRef(encodeOffChainContent(config.collectionContent))
        .storeRef(encodeOffChainContentWithoutPrefix(config.commonContent))
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
    return_balance: 5,
    change_second_owner: 6,

    stop_minting: 666,

    get_royalty_params: 0x693d3950,
    get_royalty_params_response: 0xa8cb00ad,
}

export type CollectionMintNftItemInput = {
    index: number
    ownerAddress: Address
    content: string 
}

export class NftCollection implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}
    
    static createDefaultConfig(ownerAddress: Address, itemCode: Cell): NftCollectionConfig {
        return {
            ownerAddress: ownerAddress,
            nextItemIndex: 0,
            collectionContent: "https://s3.pathgame.app/nft/c/2/metadata.json",
            commonContent: "https://s3.pathgame.app/nft/i/1/",
            nftItemCode: itemCode,
            royaltyParams: {
                // if numerator = 11 and denominator = 1000 then royalty share is 11 / 1000 * 100% = 1.1%
                royaltyFactor: 1, // numenator
                royaltyBase: 20, // denominator
                royaltyAddress: ownerAddress,
            },
        }
    }

    static createFromAddress(address: Address) {
        return new NftCollection(address);
    }

    static createFromConfig(config: NftCollectionConfig, code: Cell, workchain = 0) {
        const data = nftCollectionConfigToCell(config);
        const init = { code, data };
        return new NftCollection(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender) {
        return await provider.internal(via, {
            value: toNano('0.5'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Cell.EMPTY,
        })
    }

    //
    // Get methods
    //
    
    async getCollectionData(provider: ContractProvider): Promise<{ nextItemId: number, ownerAddress: Address, collectionContent: string }> {
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

        return res.stack.readAddress()
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

    async getSecondOwnerAddress(provider: ContractProvider): Promise<Address> {
        let res = await provider.get('get_second_owner_address', [])

        return res.stack.readAddress()
    }

    async getMintingComleteFlag(provider: ContractProvider): Promise<boolean> {
        let res = await provider.get('get_minting_complete_flag', [])
        return res.stack.readBoolean()
    }

    //
    // Internal messages
    //

    // another way to get royalty params
    async sendGetRoyaltyParams(provider: ContractProvider, via: Sender, opts: { queryId?: number; }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.get_royalty_params, 32)
                .storeUint(opts.queryId || 0, 64)
                .endCell()
        })
    }

    async sendDeployNewNft(provider: ContractProvider, via: Sender, opts: { queryId?: number, itemIndex: number, itemOwnerAddress: Address, itemContent: string }) {
        let nftItemMessage = beginCell()
            .storeAddress(opts.itemOwnerAddress)
            .storeRef(encodeOffChainContentWithoutPrefix(opts.itemContent)) // no OFF_CHAIN_CONTENT_PREFIX here because this path will be relative
            .endCell()

        return await provider.internal(via, {
            value: toNano('0.009'), // topping up collection account
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.mint, 32)
                .storeUint(opts.queryId || 0, 64)
                .storeUint(opts.itemIndex, 64)
                .storeCoins(toNano('0.002')) // payment for NFT release from collection account
                .storeRef(nftItemMessage)
                .endCell(),
        })
    }
    
    async sendBatchDeployNft(provider: ContractProvider, via: Sender, params: { queryId?: number, items: CollectionMintNftItemInput[] }) {
        if (params.items.length > 250) {
            throw new Error('Too long list')
        }

        class CollectionMintNftItemInputDictionaryValue implements DictionaryValue<CollectionMintNftItemInput> {
            serialize(src: CollectionMintNftItemInput, cell: Builder): void {
                let nftItemMessage = beginCell()
                    .storeAddress(src.ownerAddress)
                    .storeRef(encodeOffChainContentWithoutPrefix(src.content))
                    .endCell()

                cell.storeCoins(toNano('0.002')); // payment for NFT release from collection account
                cell.storeRef(nftItemMessage);
            }

            parse(cell: Slice): CollectionMintNftItemInput {
                const nftItemMessage = cell.loadRef().beginParse();
                const itemContent = nftItemMessage.loadRef();
                const ownerAddress = nftItemMessage.loadAddress();
                const content = decodeOffChainContentWithoutPrefix(itemContent);
                cell.loadCoins(); // passAmount 
                return {
                    index: 0,
                    ownerAddress,
                    content,
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
            value: toNano('0.009') * BigInt(params.items.length),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.batch_mint, 32)
                .storeUint(params.queryId || 0, 64)
                .storeRef(dictCell)
                .endCell()
        })
    }

    async sendChangeOwner(provider: ContractProvider, via: Sender, opts: { queryID?: number; newOwner: Address; }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.change_owner, 32)
                .storeUint(opts.queryID || 0, 64)
                .storeAddress(opts.newOwner)
                .endCell(),
        })
    }

    async sendEditContent(provider: ContractProvider, via: Sender, opts: { queryId?: number, collectionContent: string, commonContent: string,  royaltyParams: RoyaltyParams  }) {
        let contentCell = beginCell()
            .storeRef(encodeOffChainContent(opts.collectionContent))
            .storeRef(encodeOffChainContentWithoutPrefix(opts.commonContent))
            .endCell()

        let royaltyCell = beginCell()
            .storeUint(opts.royaltyParams.royaltyFactor, 16)
            .storeUint(opts.royaltyParams.royaltyBase, 16)
            .storeAddress(opts.royaltyParams.royaltyAddress)
            .endCell()

        return await provider.internal(via, {
            value: toNano('0.05'),
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

    async sendReturnBalance(provider: ContractProvider, via: Sender, opts: { queryID?: number }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.return_balance, 32)
                .storeUint(opts.queryID || 0, 64)
                .endCell(),
        })
    }

    async sendChangeSecondOwner(provider: ContractProvider, via: Sender, opts: { queryID?: number; newSecondOwner: Address; }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.change_second_owner, 32)
                .storeUint(opts.queryID || 0, 64)
                .storeAddress(opts.newSecondOwner)
                .endCell(),
        })
    }

    async sendStopMinting(provider: ContractProvider, via: Sender, opts: { queryID?: number }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
            bounce: false,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.stop_minting, 32)
                .storeUint(opts.queryID || 0, 64)
                .endCell(),
        })
    }
}
