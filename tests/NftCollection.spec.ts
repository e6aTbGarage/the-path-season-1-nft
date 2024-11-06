import { Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { CollectionMintNftItemInput, NftCollection, NftCollectionConfig, Opcodes } from "../wrappers/NftCollection";
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { findTransactionRequired, flattenTransaction, randomAddress } from '@ton/test-utils'

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
        config = {
            ownerAddress: deployer.address,
            nextItemIndex: 0,
            collectionContent: "https://s3.pathgame.app/public/nft/collection-meta.json",
            commonContent: "",
            nftItemCode: itemCode,
            royaltyParams: {
                royaltyFactor: 1000,
                royaltyBase: 10,
                royaltyAddress: deployer.address,
            },
        }

        collection = blockchain.openContract( NftCollection.createFromConfig(config, code));

        const deployResult = await collection.sendDeploy(deployer.getSender(), toNano('0.05'));

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

    it('should ignore external messages', async () => {
        try {
            let res = await blockchain.sendMessage({
                info: {
                    type: 'external-in',
                    dest: collection.address,
                    importFee: 0n,
                },
                init: undefined,
                body: Cell.EMPTY,
            })
            expect(res.transactions).toHaveTransaction({
                to: collection.address,
                success: false,
            });
        } catch (e: any) {
            expect(e.message).toContain('message not accepted');
        }
    })

    it('should return collection data', async () => {
        let res = await collection.getCollectionData()

        expect(res.nextItemId).toEqual(0)
        expect(res.collectionContent).toEqual("https://s3.pathgame.app/public/nft/collection-meta.json")
        expect(res.ownerAddress.toString()).toEqual(config.ownerAddress.toString())
    })
    
    it('should return nft content', async () => {
        let res = await collection.getNftContent(0, Cell.EMPTY);
        expect(res).toEqual(config.commonContent)

        // let personalNftContent = beginCell()
        //     .storeStringTail('personal')
        //     .endCell();
        // let res2 = await collection.getNftContent(0, personalNftContent);
        // let resContent = decodeOnChainContent(res2);
        // expect(resContent.description).toEqual("Diploma for the student: Stanislav Povolotsky")
        // expect(resContent.image_data).toEqual(imageDataSbt)
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

    it('should return royalty params', async () => {
        let res = await collection.getRoyaltyParams()

        expect(res.royaltyBase).toEqual(config.royaltyParams.royaltyBase)
        expect(res.royaltyFactor).toEqual(config.royaltyParams.royaltyFactor)
        expect(res.royaltyAddress.toString()).toEqual(config.royaltyParams.royaltyAddress.toString())
    })

    it('should deploy new nft', async () => {
        let itemIndex = 0

        let res = await collection.sendDeployNewNft(deployer.getSender(), toNano('1'), {
            passAmount: toNano('0.5'),
            itemIndex,
            itemOwnerAddress: config.ownerAddress,
            itemContent: 'test_content'
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

    // no sbt in this collection
    // it('should deploy new sbt', async () => {
    //     let itemIndex = 1

    //     let res = await collection.sendDeployNewSbt(deployer.getSender(), toNano('1'), {
    //         passAmount: toNano('0.5'),
    //         itemIndex,
    //         itemOwnerAddress: config.ownerAddress,
    //         itemContent: 'custom',
    //         itemAuthority: authority.address,
    //     })

    //     // Basic nft item data
    //     let itemData = beginCell()
    //         .storeUint(itemIndex, 64)
    //         .storeAddress(collection.address)
    //         .endCell()

    //     expect(res.transactions).toHaveTransaction({
    //         from: collection.address,
    //         deploy: true,
    //         initCode: config.nftItemCode,
    //         initData: itemData,
    //         success: true,
    //     });
    // })
    
    it('should batch deploy nft\'s', async () => {
        let items: CollectionMintNftItemInput[] = [
            {
                passAmount: toNano('0.5'),
                index: 0,
                ownerAddress: randomAddress(),
                content: 'content_one'
            },
            {
                passAmount: toNano('0.5'),
                index: 1,
                ownerAddress: randomAddress(),
                content: 'content_two'
            },
        ]

        let res = await collection.sendBatchDeployNft(deployer.getSender(), toNano('1'), {
            items
        })

        let nftItemData1 = beginCell()
            .storeUint(0, 64)
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
            .storeUint(1, 64)
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

    // it('should batch deploy sbt\'s', async () => {
    //     let items: CollectionMintSbtItemInput[] = [
    //         {
    //             passAmount: toNano('0.5'),
    //             index: 0,
    //             ownerAddress: randomAddress(),
    //             authorityAddress: randomAddress(),
    //             content: 'content_one'
    //         },
    //         {
    //             passAmount: toNano('0.5'),
    //             index: 1,
    //             ownerAddress: randomAddress(),
    //             authorityAddress: randomAddress(),
    //             content: 'content_two'
    //         },
    //     ]

    //     let res = await collection.sendBatchDeploySbt(deployer.getSender(), toNano('1'), {
    //         items
    //     })

    //     let itemData1 = beginCell()
    //         .storeUint(0, 64)
    //         .storeAddress(collection.address)
    //         .endCell()

    //     expect(res.transactions).toHaveTransaction({
    //         from: collection.address,
    //         deploy: true,
    //         initCode: config.nftItemCode,
    //         initData: itemData1,
    //         success: true,
    //     });

    //     let itemData2 = beginCell()
    //         .storeUint(1, 64)
    //         .storeAddress(collection.address)
    //         .endCell()

    //     expect(res.transactions).toHaveTransaction({
    //         from: collection.address,
    //         deploy: true,
    //         initCode: config.nftItemCode,
    //         initData: itemData2,
    //         success: true,
    //     });
    // })
    
    it('should deploy nft only if owner calls', async () => {
        let itemIndex = 1

        let res = await collection.sendDeployNewNft(anybody.getSender(), toNano('1'), {
            passAmount: toNano('0.5'),
            itemIndex,
            itemOwnerAddress: config.ownerAddress,
            itemContent: 'custom',
        })

        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });
    })

    it('should change owner', async () => {
        let newOwner = randomAddress()

        let res = await collection.sendChangeOwner(anybody.getSender(), toNano('1'), { newOwner})
        // Should fail if caller is not owner
        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });

        res = await collection.sendChangeOwner(deployer.getSender(), toNano('1'), { newOwner})
        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: collection.address,
            success: true
        });

        let data = await collection.getCollectionData()
        expect(data.ownerAddress.toString()).toEqual(newOwner.toString())
    })

    it('should send royalty params', async () => {
        const requestQueryId = 1234567;
        let res = await collection.sendGetRoyaltyParams(anybody.getSender(), toNano('1'), { queryId: requestQueryId})
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
            value: (x) => (x ? toNano('0.99') <= x && x <= toNano('1') : false),

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

        let res = await collection.sendEditContent(anybody.getSender(), toNano('1'), newConfig)
        // should fail if sender is not owner
        expect(res.transactions).toHaveTransaction({
            from: anybody.address,
            to: collection.address,
            success: false,
            exitCode: 401
        });

        res = await collection.sendEditContent(deployer.getSender(), toNano('1'), newConfig)
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


    // it('should ignore external messages', async () => {
    //     deployer.getSender().send

    //     let res = await collection.contract.sendExternalMessage(new ExternalMessage({
    //         to: collection.address,
    //         from: OWNER_ADDRESS,
    //         body: new CommonMessageInfo({
    //             body: new CellMessage(new Cell())
    //         })
    //     }))

    //     expect(res.exit_code).not.toEqual(0)
    // })


    // it('should increase counter', async () => {
    //     const increaseTimes = 3;
    //     for (let i = 0; i < increaseTimes; i++) {
    //         console.log(`increase ${i + 1}/${increaseTimes}`);

    //         const increaser = await blockchain.treasury('increaser' + i);

    //         const counterBefore = await collection.getCounter();

    //         console.log('counter before increasing', counterBefore);

    //         const increaseBy = Math.floor(Math.random() * 100);

    //         console.log('increasing by', increaseBy);

    //         const increaseResult = await collection.sendIncrease(increaser.getSender(), {
    //             increaseBy,
    //             value: toNano('0.05'),
    //         });

    //         expect(increaseResult.transactions).toHaveTransaction({
    //             from: increaser.address,
    //             to: collection.address,
    //             success: true,
    //         });

    //         const counterAfter = await collection.getCounter();

    //         console.log('counter after increasing', counterAfter);

    //         expect(counterAfter).toBe(counterBefore + increaseBy);
    //     }
    // });
});
