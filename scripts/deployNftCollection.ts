import { toNano } from '@ton/core';
import { NftCollection, RoyaltyParams } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, royaltyParams: RoyaltyParams) {
    const collection = provider.open(
        NftCollection.createFromConfig(
            {
                ownerAddress: provider.sender().address!,
                nextItemIndex: 0,
                collectionContent: "https://s3.pathgame.app/public/nft/collection-meta.json",
                commonContent: "https://s3.pathgame.app/",
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
}
