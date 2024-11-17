# The Path - Season 1 NFT

## Project structure

-   `contracts` - source code of all the smart contracts of the project and their dependencies.
-   `wrappers` - wrapper classes (implementing `Contract` from ton-core) for the contracts, including any [de]serialization primitives and compilation functions.
-   `tests` - tests for the contracts.
-   `scripts` - scripts used by the project, mainly the deployment scripts.

## How to use

### Build

`npx blueprint build` or `yarn blueprint build`

### Test

`npx blueprint test` or `yarn blueprint test`

### Deploy or run another script

`npx blueprint run` or `yarn blueprint run`

### Add a new contract

`npx blueprint create ContractName` or `yarn blueprint create ContractName`

# Documentation

## Token standards:
- https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
- https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
- https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md

## Messages:
- https://docs.ton.org/v3/documentation/smart-contracts/message-management/sending-messages

## Address:
- https://docs.ton.org/learn/overviews/addresses

## Token data:
- https://github.com/getgems-io/nft-contracts/blob/main/docs/ru/metadata.md
- https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md

## Compilation methods:
- Natively via blueprint right during deployment: await compile('EbatHero')
- In advance in a separate build file before demployment: npx func-js contracts/counter.fc --boc build/counter.cell
- In advance directly in the code before demployment: https://github.com/getgems-io/nft-contracts/blob/main/packages/contracts/nft-collection/NftCollection.source.ts

## Guides:
- https://tonhelloworld.com/02-contract/
- https://docs.ton.org/v3/guidelines/get-started-with-ton
- https://docs.ton.org/v3/guidelines/dapps/tutorials/nft-minting-guide
- https://tonresear.ch/t/create-smart-contracts-on-ton-lesson-10-nft-standard/436
- https://docs.ton.org/v3/guidelines/dapps/asset-processing/nft-processing/nfts
- https://ton-blockchain.github.io/docs/#/howto/step-by-step

## Examples:
- https://github.com/ton-blockchain/ton/tree/master/crypto/smartcont
- https://github.com/ton-blockchain/token-contract/tree/main/nft
- https://github.com/getgems-io/nft-contracts/blob/main/packages/contracts
- https://github.com/getgems-io/nft-contracts/tree/main/packages/contracts/nft-collection
- https://github.com/akifoq/TonToken/tree/master
#### tests
- https://github.com/Stanislav-Povolotsky/ton--sbt-onchain--ton-dev-study/blob/0d85d74bf23dd902901c7a2b5773148413d663a2/wrappers/nft-collection/NftCollection.spec.ts#L5


## Testnet explorers:
- https://testnet.tonscan.org/address/EQAeKtoHERarrLU-uB3elLqOpaPWTHiTS52KUcJwaoEwyWpm
- https://testnet.tonscan.org/nft/EQAeKtoHERarrLU-uB3elLqOpaPWTHiTS52KUcJwaoEwyWpm
- https://testnet.explorer.tonnft.tools/collection/EQAeKtoHERarrLU-uB3elLqOpaPWTHiTS52KUcJwaoEwyWpm
- https://testnet.getgems.io/collection/EQAeKtoHERarrLU-uB3elLqOpaPWTHiTS52KUcJwaoEwyWpm
- https://testnet.tonviewer.com/EQAeKtoHERarrLU-uB3elLqOpaPWTHiTS52KUcJwaoEwyWpm

## Source proof
- https://verifier.ton.org/EQCb52THERUp0Ei4lE3oQih0NPzm3Sw-zr4tmaxC4CtWG4Tq
