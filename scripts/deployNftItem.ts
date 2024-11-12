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
        itemIndex: collectionData.nextItemId,
        itemOwnerAddress: Address.parse("0QDbYiUK03JjvFqqTDVl93lZjhSWE2Y-mqJp2PCxG8E5bvkM"),
        // itemOwnerAddress: provider.sender().address!,
        itemContent: "https://s3.pathgame.app/nft/h/1/0369383036959b7ba3e0bfbcb97e05e549e16f9df66412942f7841ca5dede8c7.json"
        // itemContent: "public/nft/item-meta.json"
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
