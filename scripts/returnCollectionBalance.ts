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
    await collection.sendReturnBalance(provider.sender(), { })

    console.log('balance return requested')
}
