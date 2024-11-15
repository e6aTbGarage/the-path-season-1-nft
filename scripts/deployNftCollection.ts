import { toNano } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const collection = provider.open(await NftCollection.createDefault(provider.sender().address!));

    if (await provider.isContractDeployed(collection.address)) {
        console.log('Already at:', collection.address)
    } else {
        await collection.sendDeploy(provider.sender())
        await provider.waitForDeploy(collection.address)
    }

    console.log('Collection data:', await collection.getCollectionData())
}
