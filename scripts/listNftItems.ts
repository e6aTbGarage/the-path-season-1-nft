import { Address } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { NetworkProvider } from '@ton/blueprint';
import { NftItem } from '../wrappers/NftItem';

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const address = Address.parse(args.length > 0 ? args[0] : await ui.input('Collection address'));

    ui.write(`address ${address}`)
    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const collection = provider.open(NftCollection.createFromAddress(address))
    const collectionData = await collection.getCollectionData()

    ui.write(`Found ${collectionData.nextItemId} items`)

    for (let i = 0; i < collectionData.nextItemId; i++) {
        const itemAddress = await collection.getNftAddressByIndex(i)
        const item = provider.open(NftItem.createFromAddress(itemAddress))
        const itemContent = await item.getNftData()

        ui.write(`Item{${i}}: ${JSON.stringify(itemContent) }`)
    }

    ui.write(`No more items`)
}
