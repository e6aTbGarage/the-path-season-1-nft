import {Blockchain, BlockchainSnapshot, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {Cell, toNano, Address, beginCell} from '@ton/core';
import "@ton/test-utils";

import { compile } from '@ton/blueprint';
import { findTransactionRequired, flattenTransaction, randomAddress } from '@ton/test-utils';
import { NftItem, NftItemConfig, Opcodes } from '../wrappers/NftItem';

describe('NftItem (in-collection mode)', () => {
    let code: Cell;

    let blockchain: Blockchain;
    let blockchainInitSnapshot: BlockchainSnapshot;
    let collection: SandboxContract<TreasuryContract>;
    let owner: SandboxContract<TreasuryContract>;
    let token: SandboxContract<NftItem>;
    
    let config: NftItemConfig;
    let configMetadata: string;
    let custom_nft_fields: string[];

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        collection = await blockchain.treasury('pseudo-collection');
        owner = await blockchain.treasury('owner');

        configMetadata = ({
            "name": "@tg_nick_1",
            "stream": "2",
            "description": "I am Student A and a proud owner of this diploma",
            "image":"https://nft.ton.diamonds/nft/0/0.svg",
        }).toString();

        custom_nft_fields = ["stream"];

        code = await compile('NftItem');
        config = {
            index: 777,
            collectionAddress: collection.address,
        }

        token = blockchain.openContract(NftItem.createFromConfig(config, code));
        const deployResult = await token.sendDeploy(collection.getSender(), toNano('0.05'),{
            ownerAddress: owner.address,
            content: configMetadata,
        });
  
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

        const deployResult = await custom_token.sendDeploy(anybody.getSender(), toNano('0.05'),{
            ownerAddress: owner.address,
            content: configMetadata,
        });
  
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

    // it('should return editor', async () => {
    //     let res = await token.getEditor();
    //     expect(res?.toString()).toEqual(EDITOR_ADDRESS.toString());
    // })

    it('should transfer', async () => {
        let data = await token.getNftData()
        expect(data.ownerAddress?.toString()).toEqual(owner.address.toString())

        let newOwner = await blockchain.treasury('new_onwer');

        let transferResult = await token.sendTransfer(owner.getSender(), toNano('1'), { newOwner: newOwner.address, })

        expect(transferResult.transactions).toHaveTransaction({
            from: owner.address,
            to: token.address,
            success: true,
        });

        expect((await token.getNftData()).ownerAddress?.toString()).toEqual(newOwner.address.toString())

        // return back
        await token.sendTransfer(newOwner.getSender(), toNano('1'), { newOwner: owner.address, })
        expect((await token.getNftData()).ownerAddress?.toString()).toEqual(owner.address.toString())
    })

    it('should not transfer by anybody', async () => {
        let anybody = await blockchain.treasury('anybody');
        let newOwner = await blockchain.treasury('new_onwer');

        let transferResult = await token.sendTransfer(anybody.getSender(), toNano('1'), { newOwner: newOwner.address, })

        expect(transferResult.transactions).toHaveTransaction({
            from: anybody.address,
            to: token.address,
            success: false,
            exitCode: 401,
        });
    })

    it('should not transfer by collection', async () => {
        let newOwner = await blockchain.treasury('new_onwer');

        let transferResult = await token.sendTransfer(collection.getSender(), toNano('1'), { newOwner: newOwner.address, })

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
        expect(res.content).toEqual(configMetadata)
    })

    // it('should return royalties', async () => {
    //     let res = await token.getRoyaltyParams()

    //     expect(royalties).not.toEqual(null)
    //     expect(royalties!.royaltyBase).toEqual(singleConfig.royaltyParams.royaltyBase)
    //     expect(royalties!.royaltyFactor).toEqual(singleConfig.royaltyParams.royaltyFactor)
    //     expect(royalties!.royaltyAddress.toFriendly()).toEqual(singleConfig.royaltyParams.royaltyAddress.toFriendly())
    // })

    // it('should return static data', async () => {
    //     let nft = await NftItemLocal.createSingle(singleConfig)
    //     let res = await nft.sendGetStaticData(randomAddress())
    //     if (res.type !== 'success') {
    //         throw new Error()
    //     }

    //     let [responseMessage] = res.actionList as [SendMsgAction]
    //     let response = responseMessage.message.body.beginParse()

    //     let op = response.readUintNumber(32)
    //     let queryId = response.readUintNumber(64)
    //     let index = response.readUintNumber(256)
    //     let collectionAddress = response.readAddress()

    //     expect(op).toEqual(OperationCodes.getStaticDataResponse)
    //     expect(queryId).toEqual(0)
    //     expect(index).toEqual(0)
    //     expect(collectionAddress).toEqual(null)
    // })

    // it('should send royalty params', async () => {
    //     let nft = await NftItemLocal.createSingle(singleConfig)
    //     let sender = randomAddress()
    //     let res = await nft.sendGetRoyaltyParams(sender)

    //     expect(res.exit_code).toBe(0)
    //     if (res.type !== 'success') {
    //         throw new Error()
    //     }

    //     let [responseMessage] = res.actionList as [SendMsgAction]

    //     expect(responseMessage.message.info.dest!.toFriendly()).toEqual(sender.toFriendly())
    //     let response = responseMessage.message.body.beginParse()

    //     let op = response.readUintNumber(32)
    //     let queryId = response.readUintNumber(64)
    //     let royaltyFactor = response.readUintNumber(16)
    //     let royaltyBase = response.readUintNumber(16)
    //     let royaltyAddress = response.readAddress()!

    //     expect(op).toEqual(OperationCodes.GetRoyaltyParamsResponse)
    //     expect(queryId).toEqual(0)
    //     expect(royaltyFactor).toEqual(singleConfig.royaltyParams.royaltyFactor)
    //     expect(royaltyBase).toEqual(singleConfig.royaltyParams.royaltyBase)
    //     expect(royaltyAddress.toFriendly()).toEqual(singleConfig.royaltyParams.royaltyAddress.toFriendly())
    // })

    // it('should edit content', async () => {
    //     let nft = await NftItemLocal.createSingle(singleConfig)
    //     let sender = randomAddress()

    //     let royaltyAddress = randomAddress()
    //     let res = await nft.sendEditContent(sender, {
    //         content: 'new_content',
    //         royaltyParams: {
    //             royaltyFactor: 150,
    //             royaltyBase: 220,
    //             royaltyAddress
    //         }
    //     })
    //     // should fail if sender is not owner
    //     expect(res.exit_code).not.toEqual(0)

    //     res = await nft.sendEditContent(EDITOR_ADDRESS, {
    //         content: 'new_content',
    //         royaltyParams: {
    //             royaltyFactor: 150,
    //             royaltyBase: 220,
    //             royaltyAddress
    //         }
    //     })

    //     expect(res.exit_code).toBe(0)
    //     if (res.type !== 'success') {
    //         throw new Error()
    //     }

    //     let data = await nft.getNftData()
    //     if (!data.isInitialized) {
    //         throw new Error()
    //     }
    //     expect(decodeOffChainContent(data.contentRaw)).toEqual('new_content')
    //     let royalty = await nft.getRoyaltyParams()
    //     expect(royalty).not.toEqual(null)
    //     expect(royalty!.royaltyBase).toEqual(220)
    //     expect(royalty!.royaltyFactor).toEqual(150)
    //     expect(royalty!.royaltyAddress.toFriendly()).toEqual(royaltyAddress.toFriendly())
    // })

    // it('should return editor address', async () => {
    //     let nft = await NftItemLocal.createSingle(singleConfig)
    //     let editor = await nft.getEditor()
    //     expect(editor!.toFriendly()).toEqual(singleConfig.editorAddress.toFriendly())
    // })

    // it('should transfer editorship', async () => {
    //     let nft = await NftItemLocal.createSingle(singleConfig)
    //     let newEditor = randomAddress()
    //     let res = await nft.sendTransferEditorship(EDITOR_ADDRESS, {
    //         newEditor,
    //         responseTo: null,
    //     })
    //     expect(res.exit_code).toEqual(0)
    //     let editorRes = await nft.getEditor()
    //     expect(editorRes!.toFriendly()).toEqual(newEditor.toFriendly())
    // })



    // it('should destroy', async () => {
    //     let res = await token.sendDestoy(deployer.getSender(), {})

    //     expect(res.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: token.address,
    //         success: true
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: deployer.address,
    //         success: true,
    //         op: OperationCodes.excesses
    //     });

    //     let data = await token.getNftData()
    //     if (!data.inited) {
    //         throw new Error()
    //     }

    //     expect(data.ownerAddress).toEqual(null)
    //     expect(await token.getAuthority()).toEqual(null)
    // })

    // it('should not destroy', async () => {
    //     let res = await token.sendDestoy(authority_wallet.getSender(), {})

    //     expect(res.transactions).toHaveTransaction({
    //         from: authority_wallet.address,
    //         to: token.address,
    //         success: false,
    //         exitCode: 401
    //     });
    // })


    // it('random guy prove ownership', async () => {
    //     let someGuyWallet = await blockchain.treasury('some guy');

    //     let dataCell = beginCell()
    //         .storeUint(888, 16)
    //         .endCell()

    //     let res = await someGuyWallet.send({
    //         to: token.address,
    //         value: toNano(1),
    //         bounce: false,
    //         body: Queries.proveOwnership({
    //             to: randomAddress(),
    //             data: dataCell,
    //             withContent: true
    //         })
    //     })

    //     expect(res.transactions).toHaveTransaction({
    //         from: someGuyWallet.address,
    //         to: token.address,
    //         success: false,
    //         exitCode: 401
    //     });
    // })

    // it('random guy request ownership', async () => {
    //     let someGuyWallet = await blockchain.treasury('some guy');
    //     let randomPersonWallet = await blockchain.treasury('random person');

    //     let dataCell = beginCell()
    //         .storeUint(888, 16)
    //         .endCell();

    //     let res = await someGuyWallet.send({
    //         to: token.address,
    //         value: toNano(1),
    //         bounce: false,
    //         body: Queries.requestOwnerInfo({
    //             to: randomPersonWallet.address,
    //             data: dataCell,
    //             withContent: true
    //         })
    //     })
    
    //     expect(res.transactions).toHaveTransaction({
    //         from: someGuyWallet.address,
    //         to: token.address,
    //         success: true,
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: randomPersonWallet.address,
    //         success: true,
    //         op: OperationCodes.OwnerInfo,
    //     });

    //     let tx = flattenTransaction(findTransactionRequired(res.transactions, { op: OperationCodes.OwnerInfo }))
    //     let response = tx.body!.beginParse()

    //     let op = response.loadUint(32)
    //     let queryId = response.loadUint(64)
    //     let index = response.loadUint(256)
    //     let sender = response.loadAddress()
    //     let owner = response.loadAddress()
    //     let data = response.loadRef().beginParse()
    //     let revokedAt = response.loadUint(64)
    //     let withCont = response.loadBit()
    //     let cont = response.loadRef()

    //     expect(op).toEqual(OperationCodes.OwnerInfo)
    //     expect(queryId).toEqual(0)
    //     expect(index).toEqual(777)
    //     expect(sender.toString()).toEqual(someGuyWallet.address.toString())
    //     expect(owner.toString()).toEqual(config.ownerAddress!.toString())
    //     expect(data.loadUint(16)).toEqual(888)
    //     expect(revokedAt).toEqual(0)
    //     expect(withCont).toEqual(true)
    //     expect(decodeOnChainContent(cont, custom_nft_fields)).toEqual(configMetadata)
    // })

    // it('should request ownership with content', async () => {
    //     let someGuyWallet = await blockchain.treasury('some guy');
    //     let randomPersonWallet = await blockchain.treasury('random person');

    //     let dataCell = beginCell()
    //         .storeUint(888, 16)
    //         .endCell();

    //     let res = await someGuyWallet.send({
    //         to: token.address,
    //         value: toNano(1),
    //         bounce: false,
    //         body: Queries.requestOwnerInfo({
    //             to: randomPersonWallet.address,
    //             data: dataCell,
    //             withContent: true
    //         })
    //     })
    
    //     expect(res.transactions).toHaveTransaction({
    //         from: someGuyWallet.address,
    //         to: token.address,
    //         success: true,
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: randomPersonWallet.address,
    //         success: true,
    //         op: OperationCodes.OwnerInfo,
    //     });

    //     let tx = flattenTransaction(findTransactionRequired(res.transactions, { op: OperationCodes.OwnerInfo }))
    //     let response = tx.body!.beginParse()

    //     let op = response.loadUint(32)
    //     let queryId = response.loadUint(64)
    //     let index = response.loadUint(256)
    //     let sender = response.loadAddress()
    //     let owner = response.loadAddress()
    //     let data = response.loadRef().beginParse()
    //     let revokedAt = response.loadUint(64)
    //     let withCont = response.loadBit()
    //     let cont = response.loadRef()

    //     expect(op).toEqual(OperationCodes.OwnerInfo)
    //     expect(queryId).toEqual(0)
    //     expect(index).toEqual(777)
    //     expect(sender.toString()).toEqual(someGuyWallet.address.toString())
    //     expect(owner.toString()).toEqual(config.ownerAddress!.toString())
    //     expect(data.loadUint(16)).toEqual(888)
    //     expect(revokedAt).toEqual(0)
    //     expect(withCont).toEqual(true)
    //     expect(decodeOnChainContent(cont, custom_nft_fields)).toEqual(configMetadata)
    // })

    // it('should prove ownership with content', async () => {
    //     let prooveTo = await blockchain.treasury('proove to');

    //     let dataCell = beginCell()
    //         .storeUint(888, 16)
    //         .endCell();

    //     let res = await deployer.send({
    //         to: token.address,
    //         value: toNano(1),
    //         bounce: false,
    //         body: Queries.proveOwnership({
    //             to: prooveTo.address,
    //             data: dataCell,
    //             withContent: true
    //         })
    //     })

    //     expect(res.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: token.address,
    //         success: true,
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: prooveTo.address,
    //         success: true,
    //         op: OperationCodes.OwnershipProof,
    //     });

    //     let tx = flattenTransaction(findTransactionRequired(res.transactions, { op: OperationCodes.OwnershipProof }))
    //     let response = tx.body!.beginParse()

    //     let op = response.loadUint(32)
    //     let queryId = response.loadUint(64)
    //     let index = response.loadUint(256)
    //     let owner = response.loadAddress()
    //     let data = response.loadRef()
    //     let revokedAt = response.loadUint(64)
    //     let withCont = response.loadBit()
    //     let cont = response.loadRef()

    //     expect(op).toEqual(OperationCodes.OwnershipProof)
    //     expect(queryId).toEqual(0)
    //     expect(index).toEqual(777)
    //     expect(owner.toString()).toEqual(config.ownerAddress!.toString())
    //     expect(data.beginParse().loadUint(16)).toEqual(888)
    //     expect(revokedAt).toEqual(0)
    //     expect(withCont).toEqual(true)
    //     expect(decodeOnChainContent(cont, custom_nft_fields)).toEqual(configMetadata)
    // })

    // it('should request ownership without content', async () => {
    //     let someGuyWallet = await blockchain.treasury('some guy');
    //     let randomPersonWallet = await blockchain.treasury('random person');

    //     let dataCell = beginCell()
    //         .storeUint(888, 16)
    //         .endCell();

    //     let res = await someGuyWallet.send({
    //         to: token.address,
    //         value: toNano(1),
    //         bounce: false,
    //         body: Queries.requestOwnerInfo({
    //             to: randomPersonWallet.address,
    //             data: dataCell,
    //             withContent: false
    //         })
    //     })
    
    //     expect(res.transactions).toHaveTransaction({
    //         from: someGuyWallet.address,
    //         to: token.address,
    //         success: true,
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: randomPersonWallet.address,
    //         success: true,
    //         op: Opcodes.,
    //     });

    //     let tx = flattenTransaction(findTransactionRequired(res.transactions, { op: OperationCodes.OwnerInfo }))
    //     let response = tx.body!.beginParse()

    //     let op = response.loadUint(32)
    //     let queryId = response.loadUint(64)
    //     let index = response.loadUint(256)
    //     let sender = response.loadAddress()
    //     let owner = response.loadAddress()
    //     let data = response.loadRef().beginParse()
    //     let revokedAt = response.loadUint(64)
    //     let withCont = response.loadBit()

    //     expect(op).toEqual(OperationCodes.OwnerInfo)
    //     expect(queryId).toEqual(0)
    //     expect(index).toEqual(777)
    //     expect(sender.toString()).toEqual(someGuyWallet.address.toString())
    //     expect(owner.toString()).toEqual(config.ownerAddress!.toString())
    //     expect(data.loadUint(16)).toEqual(888)
    //     expect(revokedAt).toEqual(0)
    //     expect(withCont).toEqual(false)
    // })

    // it('should verify ownership bounce to owner', async () => {
    //     let nonExistAddr = randomAddress();

    //     let dataCell = beginCell()
    //         .storeUint(888, 16)
    //         .endCell();

    //     let res = await deployer.send({
    //         to: token.address,
    //         value: toNano(1),
    //         bounce: true,
    //         body: Queries.proveOwnership({
    //             queryId: 777,
    //             to: nonExistAddr,
    //             data: dataCell,
    //             withContent: false
    //         })
    //     })

    //     expect(res.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: token.address,
    //         success: true,
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: nonExistAddr,
    //         success: false,
    //         op: OperationCodes.OwnershipProof,
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: nonExistAddr,
    //         to: token.address,
    //         success: true,
    //         inMessageBounced: true,
    //     });

    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: OWNER_ADDRESS,
    //         success: true,
    //         op: OperationCodes.OwnershipProofBounced,
    //     });

    //     let tx = flattenTransaction(findTransactionRequired(res.transactions, { op: OperationCodes.OwnershipProofBounced }))
    //     let response = tx.body!.beginParse()

    //     let op = response.loadUint(32)
    //     let queryId = response.loadUint(64)

    //     expect(op).toEqual(OperationCodes.OwnershipProofBounced)
    //     expect(queryId).toEqual(777)
    // })

    // it('should not verify ownership non bounced', async () => {
    //     let proofReq = await blockchain.treasury('proove req by');

    //     let dataCell = beginCell()
    //         .storeUint(888, 16)
    //         .endCell();

    //     let res = await proofReq.send({
    //         to: token.address,
    //         value: toNano(1),
    //         bounce: false,
    //         body: Queries.ownershipProof({
    //             id: 777,
    //             owner: config.ownerAddress!,
    //             data: dataCell,
    //         })
    //     })
        
    //     expect(res.transactions).toHaveTransaction({
    //         from: proofReq.address,
    //         to: token.address,
    //         success: false,
    //         exitCode: 0xffff,
    //     });
    // })

    // it('should revoke', async () => {
    //     let tm1 = await token.getRevokedTime()
    //     expect(tm1).toEqual(null)

    //     let res = await token.sendRevoke(authority_wallet.getSender())
    //     expect(res.transactions).toHaveTransaction({
    //         from: authority_wallet.address,
    //         to: token.address,
    //         success: true,
    //         op: OperationCodes.Revoke,
    //     });

    //     let tm = await token.getRevokedTime()
    //     expect(tm).toBeGreaterThanOrEqual(1)
    // })

    // it('should not revoke', async () => {
    //     let res = await token.sendRevoke(deployer.getSender())
    //     expect(res.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: token.address,
    //         success: false,
    //         op: OperationCodes.Revoke,
    //         exitCode: 401,
    //     });
    // })

    // it('should not take excess', async () => {
    //     let res = await token.sendTakeExcess(authority_wallet.getSender())
    //     expect(res.transactions).toHaveTransaction({
    //         from: authority_wallet.address,
    //         to: token.address,
    //         success: false,
    //         op: OperationCodes.TakeExcess,
    //         exitCode: 401,
    //     });       
    // })

    // it('should take excess', async () => {
    //     let res = await token.sendTakeExcess(deployer.getSender())
    //     expect(res.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: token.address,
    //         success: true,
    //         op: OperationCodes.TakeExcess,
    //     });       
        
    //     expect(res.transactions).toHaveTransaction({
    //         from: token.address,
    //         to: deployer.address,
    //         success: true,
    //         op: OperationCodes.excesses,
    //     });       
    // })

    // it('custom :: should return tg_nick', async () => {
    //     let res = await token.getTgNick()
    //     expect(res).toBe(configMetadata.name);
    // })

    // it('custom :: should allow to edit description', async () => {
    //     let configMetadataEdit1 = {
    //         "description": "New value",
    //     };
    //     let configMetadataEdit2 = {
    //         "name": "New name",
    //     };

    //     let res1 = await token.sendEditContent(authority_wallet.getSender(), { content: encodeOnChainContent(configMetadataEdit1) });
    //     // should fail if sender is not editor (owner)
    //     expect(res1.transactions).toHaveTransaction({
    //         from: authority_wallet.address,
    //         to: token.address,
    //         success: false,
    //         exitCode: 410
    //     });

    //     let res2 = await token.sendEditContent(deployer.getSender(), { content: encodeOnChainContent(configMetadataEdit1) });
    //     // should succeed because 'description' field is editable
    //     expect(res2.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: token.address,
    //         success: true
    //     });

    //     let data = await token.getNftData()
    //     expect(((data.content instanceof Cell) ? decodeOnChainContent(data.content, custom_nft_fields) : {}).description).toEqual(configMetadataEdit1.description)

    //     let res3 = await token.sendEditContent(deployer.getSender(), { content: encodeOnChainContent(configMetadataEdit2) });
    //     // should fail because 'name' field is not editable
    //     expect(res3.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         success: false,
    //         exitCode: 403
    //     });
    // })
})