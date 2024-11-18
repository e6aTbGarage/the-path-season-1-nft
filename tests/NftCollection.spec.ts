import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { CollectionMintNftItemInput, NftCollection, NftCollectionConfig, Opcodes } from "../wrappers/NftCollection";
import { compile } from '@ton/blueprint';
import { findTransactionRequired, flattenTransaction, randomAddress, } from '@ton/test-utils'

describe('NftCollection', () => {
    let code: Cell;
    let itemCode: Cell;
    let config: NftCollectionConfig;

    let blockchain: Blockchain;
    let blockchainInitSnapshot: BlockchainSnapshot;
    let deployer: SandboxContract<TreasuryContract>;
    let anybody: SandboxContract<TreasuryContract>;
    let collection: SandboxContract<NftCollection>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        anybody = await blockchain.treasury('anybody');

        code = await compile('NftCollection');
        itemCode = await compile('NftItem');
        config = NftCollection.createDefaultConfig(deployer.address, itemCode)
        collection = blockchain.openContract(NftCollection.createFromConfig(config, code));

        const deployResult = await collection.sendDeploy(deployer.getSender());

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
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
        // blockchain and ebatHero are ready to use
    });

    //
    // Get messages
    //

    it('should return collection data', async () => {
        let res = await collection.getCollectionData()

        expect(res.nextItemId).toEqual(0)
        expect(res.collectionContent).toEqual("https://s3.pathgame.app/nft/c/2/metadata.json")
        expect(res.ownerAddress.toString()).toEqual(config.ownerAddress.toString())
    })
    
    it('should return royalty params', async () => {
        let res = await collection.getRoyaltyParams()

        expect(res.royaltyBase).toEqual(config.royaltyParams.royaltyBase)
        expect(res.royaltyFactor).toEqual(config.royaltyParams.royaltyFactor)
        expect(res.royaltyAddress.toString()).toEqual(config.royaltyParams.royaltyAddress.toString())
    })
    
    it('should return nft address by index', async () => {
        let index = 77

        let res = await collection.getNftAddressByIndex(index)

        // Basic nft item data
        let nftItemData = beginCell()
            .storeUint(index, 64)
            .storeAddress(collection.address)
            .endCell()

        let expectedAddress = contractAddress( 0, { code: config.nftItemCode, data: nftItemData })

        expect(res.toString()).toEqual(expectedAddress.toString())
    })

    it('should return nft content', async () => {
        let res = await collection.getNftContent(0, beginCell().storeStringTail("d41d8cd98f00b204e9800998ecf8427e.json").endCell());
        expect(res).toEqual("https://s3.pathgame.app/nft/i/1/d41d8cd98f00b204e9800998ecf8427e.json")
    })

    it('should return second owner', async () => {
        let res = await collection.getSecondOwnerAddress();
        expect(res.toString()).toEqual(deployer.address.toString())
    })

    it('should return mint compelte flag', async () => {
        let isMintingComplete = await collection.getMintingComleteFlag();
        expect(isMintingComplete).toEqual(false)
    })

    //
    // Internal messages
    //

    it('should send royalty params', async () => {
        const requestQueryId = 1234567;
        let res = await collection.sendGetRoyaltyParams(anybody.getSender(), { queryId: requestQueryId })
        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: true
        });
        expect(res.transactions).toHaveTransaction({
            from: collection.address,
            to: anybody.address,
            success: true,
            op: Opcodes.get_royalty_params_response,
            value: (x) => (x ? toNano('0.04') <= x && x <= toNano('0.05') : false),

            body: beginCell()
                .storeUint(Opcodes.get_royalty_params_response, 32)
                .storeUint(requestQueryId, 64)
                .storeSlice(
                    beginCell()
                        .storeUint(config.royaltyParams.royaltyFactor, 16)
                        .storeUint(config.royaltyParams.royaltyBase, 16)
                        .storeAddress(config.royaltyParams.royaltyAddress)
                        .endCell()
                        .beginParse()
                )
                .endCell(),
        });

        let tx = flattenTransaction(findTransactionRequired(res.transactions, { op: Opcodes.get_royalty_params_response }))
        let response = tx.body?.beginParse()!

        let op = response.loadUint(32)
        let queryId = response.loadUint(64)
        let royaltyFactor = response.loadUint(16)
        let royaltyBase = response.loadUint(16)
        let royaltyAddress = response.loadAddress()!

        expect(op).toEqual(Opcodes.get_royalty_params_response)
        expect(queryId).toEqual(requestQueryId)
        expect(royaltyFactor).toEqual(config.royaltyParams.royaltyFactor)
        expect(royaltyBase).toEqual(config.royaltyParams.royaltyBase)
        expect(royaltyAddress.toString()).toEqual(config.royaltyParams.royaltyAddress.toString())
    })

    it('should deploy new nft', async () => {
        let itemIndex = (await collection.getCollectionData()).nextItemId;

        let res = await collection.sendDeployNewNft(deployer.getSender(), {
            itemIndex,
            itemOwnerAddress: config.ownerAddress,
            itemContent: 'd41d8cd98f00b204e9800998ecf8427e.json' // md5 from empty string
        })

        // Basic nft item data
        let itemData = beginCell()
            .storeUint(itemIndex, 64)
            .storeAddress(collection.address)
            .endCell()

        expect(res.transactions).toHaveTransaction({
            from: collection.address,
            deploy: true,
            initCode: config.nftItemCode,
            initData: itemData,
            success: true,
        });

        let data = await collection.getCollectionData()
        expect(data.nextItemId).toEqual(itemIndex + 1)
    })

    it('should deploy a lot of new nft', async () => {
        let itemIndex = (await collection.getCollectionData()).nextItemId;

        for (let i = 0; i < 250; i++)
        {
            let res = await collection.sendDeployNewNft(deployer.getSender(), {
                itemIndex,
                itemOwnerAddress: config.ownerAddress,
                itemContent: 'd41d8cd98f00b204e9800998ecf8427e.json' // md5 from empty string
            })

            expect(res.transactions).toHaveTransaction({
                from: collection.address,
                deploy: true,
                success: true,
            });

            itemIndex = itemIndex + 1
        }

        let data = await collection.getCollectionData()
        expect(data.nextItemId).toEqual(itemIndex)
    })

    it('should deploy nft only if owner calls', async () => {
        let itemIndex = (await collection.getCollectionData()).nextItemId;

        let res = await collection.sendDeployNewNft(anybody.getSender(), {
            itemIndex,
            itemOwnerAddress: config.ownerAddress,
            itemContent: 'd41d8cd98f00b204e9800998ecf8427e.json' // md5 from empty string
        })

        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });
    })

    it('should batch deploy nft\'s', async () => {
        let nextItemIndex = (await collection.getCollectionData()).nextItemId;

        const items: CollectionMintNftItemInput[] = Array.from({ length: 125 }, (_, i) => ({
            index: nextItemIndex + i,
            ownerAddress: randomAddress(),
            content: 'd41d8cd98f00b204e9800998ecf8427e.json' // md5 from empty string
        }))

        let res = await collection.sendBatchDeployNft(deployer.getSender(), { items })

        let nftItemData1 = beginCell()
            .storeUint(0, 64) // itemIndex
            .storeAddress(collection.address)
            .endCell()

        expect(res.transactions).toHaveTransaction({
            from: collection.address,
            deploy: true,
            initCode: config.nftItemCode,
            initData: nftItemData1,
            success: true,
        });

        let nftItemData2 = beginCell()
            .storeUint(1, 64) // itemIndex
            .storeAddress(collection.address)
            .endCell()

        expect(res.transactions).toHaveTransaction({
            from: collection.address,
            deploy: true,
            initCode: config.nftItemCode,
            initData: nftItemData2,
            success: true,
        });
    })

    it('should deploy batch nft only if owner calls', async () => {
        let itemIndex = (await collection.getCollectionData()).nextItemId;

        let items: CollectionMintNftItemInput[] = [
            {
                index: itemIndex,
                ownerAddress: randomAddress(),
                content: 'content_one'
            },
        ]

        let res = await collection.sendBatchDeployNft(anybody.getSender(), { items })

        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });
    })

    it('should change owner', async () => {
        let newOwner = randomAddress()

        let res = await collection.sendChangeOwner(anybody.getSender(), { newOwner })
        // Should fail if caller is not owner
        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });

        res = await collection.sendChangeOwner(deployer.getSender(), { newOwner })
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
            success: true
        });

        let data = await collection.getCollectionData()
        expect(data.ownerAddress.toString()).toEqual(newOwner.toString())
    })
    
    it('should edit content', async () => {
        let royaltyAddress = randomAddress()
        let newConfig = {
            collectionContent: "abc",
            commonContent: "def",
            royaltyParams: {
                royaltyFactor: 150,
                royaltyBase: 220,
                royaltyAddress: royaltyAddress
            }
        }

        let res = await collection.sendEditContent(anybody.getSender(), newConfig)
        // should fail if sender is not owner
        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });

        res = await collection.sendEditContent(deployer.getSender(), newConfig)
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
            success: true,
        });

        let data = await collection.getCollectionData()
        expect(data.collectionContent).toEqual(newConfig.collectionContent)

        let dataNft = await collection.getNftContent(0, Cell.EMPTY)
        expect(dataNft).toEqual(newConfig.commonContent)

        let royalty = await collection.getRoyaltyParams()
        expect(royalty.royaltyFactor).toEqual(150)
        expect(royalty.royaltyBase).toEqual(220)
        expect(royalty.royaltyAddress.toString()).toEqual(royaltyAddress.toString())
    })

    it('should return balance', async () => {
        let res = await collection.sendReturnBalance(anybody.getSender(), {})
        // Should fail if caller is not owner
        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });

        res = await deployer.send({
            to: collection.address,
            value: toNano("10"),
        })
        expect(res.transactions).toHaveTransaction({ from: deployer.address, to: collection.address, success: true });

        res = await collection.sendReturnBalance(deployer.getSender(), { })
        expect(res.transactions).toHaveTransaction({ 
            from: deployer.address, 
            to: collection.address, 
            success: true,
        });
        expect(res.transactions).toHaveTransaction({ 
            from: collection.address, 
            to: deployer.address, 
            success: true,
            value: (x) => (x ? toNano(9) <= x && x <= toNano(11) : false),
        });
    })
    
    it('should change second owner', async () => {
        let secondOwner = await blockchain.treasury('add_owner');

        let res = await collection.sendChangeSecondOwner(anybody.getSender(), { newSecondOwner: secondOwner.address })
        // Should fail if caller is not owner
        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });

        res = await collection.sendChangeSecondOwner(deployer.getSender(), { newSecondOwner: secondOwner.address })
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
            success: true
        });

        let newSecondOwner = await collection.getSecondOwnerAddress();
        expect(newSecondOwner.toString()).toEqual(secondOwner.address.toString())

        // main owner still same
        let data = await collection.getCollectionData()
        expect(data.ownerAddress.toString()).toEqual(deployer.address.toString())

        // check rights
        res = await collection.sendDeployNewNft(secondOwner.getSender(), {
            itemIndex: data.nextItemId,
            itemOwnerAddress: anybody.address,
            itemContent: 'd41d8cd98f00b204e9800998ecf8427e.json' // md5 from empty string
        })
        expect(res.transactions).toHaveTransaction({
            from: secondOwner.address,
            success: true,
        });

        // second owner can't become main
        res = await collection.sendChangeOwner(secondOwner.getSender(), { newOwner: secondOwner.address })
        expect(res.transactions).toHaveTransaction({
            from: secondOwner.address,
            success: false,
            exitCode: 4001
        });
    })
    
    it('should stop mint', async () => {
        let isMintingComplete = await collection.getMintingComleteFlag();
        expect(isMintingComplete).toEqual(false)
        
        let res = await collection.sendStopMinting(deployer.getSender(), {});

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
            success: true,
        });

        isMintingComplete = await collection.getMintingComleteFlag();
        expect(isMintingComplete).toEqual(true)
    })
    
    it('should not deploy after stop mint', async () => {
        await collection.sendStopMinting(deployer.getSender(), {});

        let data = await collection.getCollectionData();
        let res = await collection.sendDeployNewNft(deployer.getSender(), {
            itemIndex: data.nextItemId,
            itemOwnerAddress: config.ownerAddress,
            itemContent: 'test_content'
        })

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
            success: false,
            exitCode: 4666,
        });
    })
    
    it('should not batch deploy after stop mint', async () => {
        await collection.sendStopMinting(deployer.getSender(), {});

        let itemIndex = (await collection.getCollectionData()).nextItemId;

        let items: CollectionMintNftItemInput[] = [
            {
                index: itemIndex,
                ownerAddress: randomAddress(),
                content: 'content_one'
            },
        ]

        let res = await collection.sendBatchDeployNft(deployer.getSender(), { items })

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
            success: false,
            exitCode: 4666,
        });
    })

    //
    // External messages
    //

    it('should ignore external messages', async () => {
        try {
            let res = await blockchain.sendMessage({
                info: {
                    type: 'external-in',
                    dest: collection.address,
                    importFee: 0n,
                },
                init: undefined,
                body: beginCell().storeUint(1, 32).storeUint(2, 32).storeUint(3, 32).endCell()
            })
            expect(res.transactions).toHaveTransaction({
                to: collection.address,
                success: false,
            });
        } catch (e: any) {
            expect(e.message).toContain('message not accepted');
        }
    })
});
