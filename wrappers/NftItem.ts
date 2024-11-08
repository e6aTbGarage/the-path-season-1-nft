import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { decodeOffChainContent, encodeOffChainContent } from './NftContent';

export type NftItemConfig = {
    index: number
    collectionAddress: Address
}

export type NftItemData = {
    inited?: boolean
    index: number
    collectionAddress: Address | null
    ownerAddress: Address | null
    content: string // Cell | string - cell if onchain
}

export function nftItemConfigToCell(config: NftItemConfig) {
    return beginCell()
        .storeUint(config.index, 64)
        .storeAddress(config.collectionAddress)
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

export type RoyaltyParams = {
    royaltyFactor: number // numerator
    royaltyBase: number // denominator
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

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint, opts: { ownerAddress: Address, content: string }) {
        return await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeAddress(opts.ownerAddress)
                .storeRef(encodeOffChainContent(opts.content))
                .endCell(),
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

    async getRoyaltyParams(provider: ContractProvider): Promise<RoyaltyParams | null> {
        const nftRoyalty = (await provider.get('royalty_params', [])).stack

        let [royaltyFactor, royaltyBase, royaltyAddress] = [nftRoyalty.readNumber(), nftRoyalty.readNumber(), nftRoyalty.readAddress() ]

        return {
            royaltyFactor: royaltyFactor,
            royaltyBase: royaltyBase,
            royaltyAddress: royaltyAddress,
        }
    }

    //
    //  Internal messages
    //

    async sendTransfer(provider: ContractProvider, via: Sender, value: bigint, opts: { queryId?: number; newOwner: Address; responseTo?: Address; forwardAmount?: bigint, forwardPayload?: Cell }) {
        return await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(Opcodes.transfer, 32)
                .storeUint(opts.queryId || 0, 64)
                .storeAddress(opts.newOwner)
                .storeAddress(opts.responseTo || null)
                .storeBit(false) // no custom payload
                .storeCoins(opts.forwardAmount || 0)
                .storeRef(opts.forwardPayload || Cell.EMPTY)
                .endCell(),
        });
    }

    async sendGetStaticData(provider: ContractProvider, via: Sender, opts: { queryId?: number }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
            body: beginCell()
                .storeUint(Opcodes.get_static_data, 32)
                .storeUint(opts.queryId || 0, 64)
                .endCell()
        })
    }
    
    async sendGetRoyaltyParams(provider: ContractProvider, via: Sender, opts: { queryId?: number }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
            body: beginCell()
                .storeUint(Opcodes.get_royalty_params, 32)
                .storeUint(opts.queryId || 0, 64)
                .endCell()
        })
    }

    //
    //  Unused messages
    //

    // async getEditor(provider: ContractProvider): Promise<Address | null> {
    //     const nftEditor = (await provider.get('get_editor', [])).stack
    //     return nftEditor.readAddress()
    // }

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

    // async sendEditContent(provider: ContractProvider, via: Sender, params: { queryId?: number, content: Cell}) {
    //     let contentCell = encodeOffChainContent(params.content)

    //     let royaltyCell = beginCell()
    //         .storeUint(params.royaltyParams.royaltyFactor, 16)
    //         .storeUint(params.royaltyParams.royaltyBase, 16)
    //         .storeAddress(params.royaltyParams.royaltyAddress)
    //         .endCell()

    //     return await provider.internal(via, {
    //         value: toNano('0.05'),
    //         body: beginCell()
    //         .storeUint(Opcodes.edit_content, 32)
    //         .storeUint(params.queryId || 0, 64)
    //         .storeRef(contentCell)
    //         .storeRef(royaltyCell)
    //         .endCell()
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