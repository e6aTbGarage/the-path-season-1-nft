import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'func',
    targets: [
        'contracts/imports/stdlib.fc',
        'contracts/imports/op-codes.fc',
        'contracts/imports/params.fc',
        'contracts/nft_collection.fc',
    ],
};
