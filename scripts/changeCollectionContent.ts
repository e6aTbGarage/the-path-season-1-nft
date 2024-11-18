import { Address } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();

    const address = Address.parse(await ui.input('Collection address'));
    ui.write(`collection address ${address}`)

    if (!(await provider.isContractDeployed(address))) {
        ui.write(`Error: Contract at address ${address} is not deployed!`);
        return;
    }

    const collection = provider.open(NftCollection.createFromAddress(address))
    const royalty = await collection.getRoyaltyParams()

    await collection.sendEditContent(provider.sender(), {
        collectionContent: "https://s3.pathgame.app/nft/c/2/metadata.json",
        commonContent: "https://s3.pathgame.app/nft/h/1/",
        royaltyParams: royalty,
    })

    const data = await collection.getCollectionData()
    console.log('new data: ', data)
}
