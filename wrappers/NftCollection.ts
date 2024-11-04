import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
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
    // return beginCell().storeUint(config.id, 32).storeUint(config.counter, 32).endCell();
}

export const Opcodes = {
    increase: 0x7e8764ef,
};

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
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    //
    // Get methods
    //
    
    async getCollectionData(provider: ContractProvider): Promise<{ nextItemId: number, ownerAddress: Address, collectionContent: string }> {
        // let res = await this.contract.invokeGetMethod('get_collection_data', [])
        let res = await provider.get('get_collection_data', [])
     
        if (res.stack.remaining == 0) {
            throw new Error(`Unable to invoke get_collection_data on contract`)
        }
        let nextItemId = res.stack.readNumber()
        let collectionContent = res.stack.readCell()
        let ownerAddress = res.stack.readAddress()

        return {
            nextItemId: nextItemId,
            collectionContent: decodeOffChainContent(collectionContent),
            ownerAddress: ownerAddress,
        }
    }
}
