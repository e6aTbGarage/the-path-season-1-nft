import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import { Cell, beginCell } from '@ton/core';
import "@ton/test-utils";

import { compile } from '@ton/blueprint';
import { NftItem, NftItemConfig, NftItemParams } from '../wrappers/NftItem';

describe('NftItem (in-collection mode)', () => {
    let code: Cell;

    let blockchain: Blockchain;
    let blockchainInitSnapshot: BlockchainSnapshot;
    let collection: SandboxContract<TreasuryContract>;
    let anybody: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let token: SandboxContract<NftItem>;
    
    let config: NftItemConfig;
    let params: NftItemParams;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        collection = await blockchain.treasury('pseudo-collection');
        anybody = await blockchain.treasury('anybody');
        owner = await blockchain.treasury('owner');

        code = await compile('NftItem');
        config = {
            index: 777,
            collectionAddress: collection.address,
        }
        params = {
            ownerAddress: owner.address,
            content: "/public/nft/item-meta.json",
        }

        token = blockchain.openContract(NftItem.createFromConfig(config, code));
        const deployResult = await token.sendDeploy(collection.getSender(), params);
  
        expect(deployResult.transactions).toHaveTransaction({
            from: collection.address,
            to: token.address,
            deploy: true,
            success: true,
        });

        blockchainInitSnapshot = blockchain.snapshot();
    });

    beforeEach(async () => {
        blockchain.loadFrom(blockchainInitSnapshot);
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and sbt are ready to use
    });

    it('should deploy only from collection', async () => {
        let anybody = await blockchain.treasury('anybody');

        let custom_config = {
            index: 228,
            collectionAddress: collection.address,
        }
        let custom_token = blockchain.openContract(NftItem.createFromConfig(custom_config, code));

        const deployResult = await custom_token.sendDeploy(anybody.getSender(), params);
  
        expect(deployResult.transactions).toHaveTransaction({
            from: anybody.address,
            to: custom_token.address,
            deploy: true,
            success: false,
        });
    });

    it('should ignore external messages', async () => {
        try {
            let res = await blockchain.sendMessage({
                info: {
                    type: 'external-in',
                    dest: token.address,
                    importFee: 0n,
                },
                init: undefined,
                body: beginCell().storeUint(1, 32).storeUint(2, 32).storeUint(3, 32).endCell()
            })
            expect(res.transactions).toHaveTransaction({
                to: token.address,
                success: false,
            });
        } catch (e: any) {
            expect(e.message).toContain('message not accepted');
        }
    })

    it('should transfer', async () => {
        let data = await token.getNftData()
        expect(data.ownerAddress?.toString()).toEqual(owner.address.toString())

        let newOwner = await blockchain.treasury('new_onwer');

        let transferResult = await token.sendTransfer(owner.getSender(), { newOwner: newOwner.address, })

        expect(transferResult.transactions).toHaveTransaction({
            from: owner.address,
            to: token.address,
            success: true,
        });

        expect((await token.getNftData()).ownerAddress?.toString()).toEqual(newOwner.address.toString())

        // return back
        await token.sendTransfer(newOwner.getSender(), { newOwner: owner.address, })
        expect((await token.getNftData()).ownerAddress?.toString()).toEqual(owner.address.toString())
    })

    it('should not transfer by anybody', async () => {
        let newOwner = await blockchain.treasury('new_onwer');

        let transferResult = await token.sendTransfer(anybody.getSender(), { newOwner: newOwner.address, })

        expect(transferResult.transactions).toHaveTransaction({
            from: anybody.address,
            to: token.address,
            success: false,
            exitCode: 401,
        });
    })

    it('should not transfer by collection', async () => {
        let newOwner = await blockchain.treasury('new_onwer');

        let transferResult = await token.sendTransfer(collection.getSender(), { newOwner: newOwner.address, })

        expect(transferResult.transactions).toHaveTransaction({
            from: collection.address,
            to: token.address,
            success: false,
            exitCode: 401,
        });
    })

    it('should return data', async () => {
        let res = await token.getNftData()
        expect(res.inited).toBe(true)
        expect(res.index).toEqual(config.index)
        expect(res.collectionAddress!.toString()).toEqual(config.collectionAddress.toString())
        expect(res.ownerAddress?.toString()).toEqual(owner.address.toString())
        expect(res.content).toEqual(params.content)
    })
})