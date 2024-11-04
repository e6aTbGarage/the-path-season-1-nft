import { toNano } from '@ton/core';
import { EbatHero } from '../wrappers/EbatHero';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const ebatHero = provider.open(
        EbatHero.createFromConfig(
            {
                id: Math.floor(Math.random() * 10000),
                counter: 0,
            },
            await compile('EbatHero')
        )
    );

    await ebatHero.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(ebatHero.address);

    console.log('ID', await ebatHero.getID());
}
