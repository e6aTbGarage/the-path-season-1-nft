import { NftCollection } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const code = await compile('NftCollection');
    const itemCode = await compile('NftItem');
    const config = NftCollection.createDefaultConfig(provider.sender().address!, itemCode)

    const collection = provider.open(await NftCollection.createFromConfig(config, code));

    const approve = await provider.ui().input(`Approve deploy to  ${collection.address.toString()}: y/n`);
    if (approve.toLowerCase() !== 'y')
        throw new Error("Cancel")

    if (await provider.isContractDeployed(collection.address)) {
        console.log('Already at:', collection.address)
    } else {
        await collection.sendDeploy(provider.sender())
        await provider.waitForDeploy(collection.address)
    }

    console.log('Collection data:', await collection.getCollectionData())
}
