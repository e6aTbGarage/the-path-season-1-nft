import { Address, toNano } from '@ton/core';
import { NftCollection, RoyaltyParams } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, royaltyParams: RoyaltyParams) {
    const collection = provider.open(
        NftCollection.createFromConfig(
            {
                ownerAddress: provider.sender().address!,
                // nextItemIndex: number | BN
                nextItemIndex: 1,
                collectionContent: "https://s3.pathgame.app/public/nft/collection-meta.json",
                commonContent: "",
                nftItemCode: await compile('NftItem'),
                royaltyParams: {
                    royaltyFactor: 10,
                    royaltyBase: 10,
                    royaltyAddress: provider.sender().address!,
                },
            },
            await compile('NftCollection')
        )
    );

    if (await provider.isContractDeployed(collection.address)) {
        console.log('Already at:', collection.address)
    } else {
        await collection.sendDeploy(provider.sender(), toNano('0.05'))
        await provider.waitForDeploy(collection.address)
    }

    console.log('data:', await collection.getCollectionData())
    // console.log('data', Address.parse("0QDm9oyItkU9NNPLt5Lka8LFPfjRF6FZTg4MKw7k--okpZcc"))
}
