import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { EbatHero } from '../wrappers/EbatHero';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('EbatHero', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('EbatHero');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let ebatHero: SandboxContract<EbatHero>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        ebatHero = blockchain.openContract(
            EbatHero.createFromConfig(
                {
                    id: 0,
                    counter: 0,
                },
                code
            )
        );

        deployer = await blockchain.treasury('deployer');

        const deployResult = await ebatHero.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: ebatHero.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and ebatHero are ready to use
    });

    it('should increase counter', async () => {
        const increaseTimes = 3;
        for (let i = 0; i < increaseTimes; i++) {
            // console.log(`increase ${i + 1}/${increaseTimes}`);

            const increaser = await blockchain.treasury('increaser' + i);

            const counterBefore = await ebatHero.getCounter();

            // console.log('counter before increasing', counterBefore);

            const increaseBy = Math.floor(Math.random() * 100);

            // console.log('increasing by', increaseBy);

            const increaseResult = await ebatHero.sendIncrease(increaser.getSender(), {
                increaseBy,
                value: toNano('0.05'),
            });
            // console.log('Res: ', increaseResult)

            expect(increaseResult.transactions).toHaveTransaction({
                from: increaser.address,
                to: ebatHero.address,
                success: true,
            });

            const counterAfter = await ebatHero.getCounter();

            // console.log('counter after increasing', counterAfter);

            expect(counterAfter).toBe(counterBefore + increaseBy);
        }
    });
});
