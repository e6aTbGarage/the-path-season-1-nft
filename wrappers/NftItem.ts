import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { decodeOffChainContentWithoutPrefix, encodeOffChainContentWithoutPrefix } from './NftContent';

export type NftItemConfig = { // Initial data that affects the NFT address
    index: number
    collectionAddress: Address
}
export type NftItemParams = { // Custom data that does not affect the NFT address
    ownerAddress: Address
    content: string
}

export type NftItemData = {
    inited?: boolean
    index: number
    collectionAddress: Address | null
    ownerAddress: Address | null
    content: string
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

    async sendDeploy(provider: ContractProvider, via: Sender, opts: NftItemParams) {
        return await provider.internal(via, {
            value: toNano('0.002'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeAddress(opts.ownerAddress)
                .storeRef(encodeOffChainContentWithoutPrefix(opts.content))
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
            content: decodeOffChainContentWithoutPrefix(nftData.readCell()),
        }        
    }

    //
    //  Internal messages
    //

    async sendTransfer(provider: ContractProvider, via: Sender, opts: { queryId?: number; newOwner: Address; responseTo?: Address; forwardAmount?: bigint, forwardPayload?: Cell }) {
        return await provider.internal(via, {
            value: toNano('0.05'),
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
}