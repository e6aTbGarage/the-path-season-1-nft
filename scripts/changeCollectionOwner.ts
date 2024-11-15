import { Address, toNano } from '@ton/core';
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

    const newOwner = Address.parse(await ui.input('New owner address'));
    ui.write(`second owner address ${newOwner}`)

    const collection = provider.open(NftCollection.createFromAddress(address))
    await collection.sendChangeOwner(provider.sender(), { newOwner })

    console.log('owner change requested')
}
