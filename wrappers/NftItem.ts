import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { decodeOffChainContent, encodeOffChainContent } from './NftContent';

export type NftItemConfig = {
    index: number
    collectionAddress: Address | null
    ownerAddress: Address
    content: string
}

export type NftItemData = {
    inited?: boolean
    index: number
    collectionAddress: Address | null
    ownerAddress: Address | null
    content: string
    // content: Cell | string
}

export function nftItemConfigToCell(config: NftItemConfig) {
    let contentCell = beginCell()
        .storeStringTail(config.content)
        .endCell()

    return beginCell()
        .storeUint(config.index, 64)
        .storeAddress(config.collectionAddress)
        .storeAddress(config.ownerAddress)
        .storeRef(contentCell)
        .endCell()
}

export const Opcodes = {
    transfer: 0x5fcc3d14,
    get_static_data: 0x2fcb26a2,
    get_static_data_response: 0x8b771735,
    get_royalty_params: 0x693d3950,
    get_royalty_params_response: 0xa8cb00ad,
    edit_content: 0x1a0b9d51,
    transfer_editorship: 0x1c04412a
}

export function buildNftItemDeployMessage(conf: { queryId?: number, collectionAddress: Address, passAmount: bigint, itemIndex: number, itemOwnerAddress: Address, itemContent: string }) {
    // let msgBody = CollectionQueries.mint(conf)

    // return {
    //     messageBody: msgBody,
    //     collectionAddress: conf.collectionAddress
    // }
}

export type RoyaltyParams = {
    // numerator
    royaltyFactor: number
    // denominator
    royaltyBase: number
    royaltyAddress: Address
}

export type NftSingleData = {
    ownerAddress: Address
    editorAddress: Address
    content: string
    royaltyParams: RoyaltyParams
}

export function nftSingleDataToCell(data: NftSingleData) {

    let contentCell = encodeOffChainContent(data.content)

    let royaltyCell = beginCell()
        .storeUint(data.royaltyParams.royaltyFactor, 16)
        .storeUint(data.royaltyParams.royaltyBase, 16)
        .storeAddress(data.royaltyParams.royaltyAddress)
        .endCell()

    return beginCell()
        .storeAddress(data.ownerAddress)
        .storeAddress(data.editorAddress)
        .storeRef(contentCell)
        .storeRef(royaltyCell)
        .endCell()

}

// export function buildSingleNftStateInit(conf: NftSingleData) {
//     let dataCell = nftSingleDataToCell(conf)

//     let stateInit = new StateInit({
//         code: NftSingleCodeCell,
//         data: dataCell
//     })

//     let stateInitCell = new Cell()
//     stateInit.writeTo(stateInitCell)

//     let address = contractAddress({workchain: 0, initialCode: NftSingleCodeCell, initialData: dataCell})

//     return {
//         stateInit: stateInitCell,
//         stateInitMessage: stateInit,
//         address
//     }
// }

export class NftItem implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new NftItem(address);
    }

    static createFromConfig(config: NftItemConfig, code: Cell, workchain = 0) {
        const data = nftItemConfigToCell(config);
        const init = { code, data };
        return new NftItem(contractAddress(workchain, init), init);
    }

    static createSingleFromConfig(config: NftSingleData, code: Cell, workchain = 0) {
        const data = nftSingleDataToCell(config);
        const init = { code, data };
        return new NftItem(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        return await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    //
    // Get methods
    //

    async getNftData(provider: ContractProvider): Promise<NftItemData> {
        const nftData = (await provider.get('get_nft_data', [])).stack
        
        return {
            inited: nftData.readBoolean(),
            index: nftData.readNumber(),
            collectionAddress: nftData.readAddressOpt(),
            ownerAddress: nftData.readAddressOpt(),
            content: decodeOffChainContent(nftData.readCell()),
        }        
    }

    // async getSbtData(provider: ContractProvider): Promise<NftItemData> {
    //     return await this.getNftData(provider)
    // }

    // async getTgNick(provider: ContractProvider): Promise<string> {
    //     const res = (await provider.get('get_tg_nick', [])).stack
    //     const data = res.readCell();
    //     return flattenSnakeCell(data).toString('utf-8');
    // }

    // async getAuthority(provider: ContractProvider): Promise<Address | null> {
    //     const stack = (await provider.get('get_authority_address', [])).stack
    //     return stack.readAddressOpt()
    // }

    // async getRevokedTime(provider: ContractProvider): Promise<number | null> {
    //     const stack = (await provider.get('get_revoked_time', [])).stack
    //     let res = stack.readNumber()
    //     return (res === 0) ? null : res
    // }

    // async getEditor(provider: ContractProvider): Promise<Address | null> {
    //     let res = await provider.get('get_editor', [])
    //     return res.stack.readAddressOpt()
    // }

    //
    //  Internal messages
    //

    // async sendTransfer(provider: ContractProvider, via: Sender, to: Address) {
    //     throw new Error('Not implemented for SBT')
    // }

    // async sendGetStaticData(provider: ContractProvider, via: Sender) {
    //     let msgBody = Queries.getStaticData({})

    //     return await provider.internal(via, {
    //         value: toNano('0.05'),
    //         body: msgBody
    //     })
    // }

    // async sendEditContent(provider: ContractProvider, via: Sender, params: { queryId?: number, content: Cell}) {
    //     let msgBody = Queries.editContent(params)
    //     return await provider.internal(via, {
    //         value: toNano('0.05'),
    //         body: msgBody
    //     })
    // }

    // async sendTransferEditorship(provider: ContractProvider, via: Sender, params: { queryId?: number, newEditor: Address, responseTo: Address | null, forwardAmount?: bigint }) {
    //     let msgBody = Queries.transferEditorship(params)
    //     return await provider.internal(via, {
    //         value: toNano('0.05'),
    //         body: msgBody
    //     })
    // }

    // async sendDestoy(provider: ContractProvider, via: Sender, params?: { queryId?: number }) {
    //     let msgBody = Queries.destroy(params || {})
    //     return await provider.internal(via, {
    //         value: toNano('0.05'),
    //         body: msgBody
    //     })
    // }

    // async sendRevoke(provider: ContractProvider, via: Sender, params?: { queryId?: number }) {
    //     let msgBody = Queries.revoke(params || {})
    //     return await provider.internal(via, {
    //         value: toNano('0.05'),
    //         body: msgBody
    //     })
    // }

    // async sendTakeExcess(provider: ContractProvider, via: Sender, params?: { queryId?: number }) {
    //     let msgBody = Queries.takeExcess(params || {})
    //     return await provider.internal(via, {
    //         value: toNano('0.05'),
    //         body: msgBody
    //     })
    // }
}