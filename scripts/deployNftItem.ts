import { Address, toNano } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { NetworkProvider, sleep } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Collection address'));

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const collection = provider.open(NftCollection.createFromAddress(address))

    const collectionData = await collection.getCollectionData()

    const res = await collection.sendDeployNewNft(provider.sender(), {
        passAmount: toNano('0.5'),
        itemIndex: collectionData.nextItemId,
        itemOwnerAddress: provider.sender().address!,
        itemContent: "public/nft/item-meta.json"
    })

    ui.write('Waiting for deploy...');

    let dataAfter = await collection.getCollectionData();
    let attempt = 1;
    while (dataAfter.nextItemId === collectionData.nextItemId) {
        ui.setActionPrompt(`Attempt ${attempt}`);
        await sleep(2000);
        dataAfter = await collection.getCollectionData();
        attempt++;
    }

    ui.clearActionPrompt();
    ui.write('Counter increased successfully!');
}
