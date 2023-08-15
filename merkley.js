const { ethers } = require("ethers");
const { Merkley } = require('./configs.json');
const { getRandomNumber, sleep } = require('./utils');
const { BigNumber } = require('@ethersproject/bignumber');

const merkleyOFT_abi = require("./abis/merkleyOFT_abi.json");

const MAX_RETRIES = 2;

const chainToFee = {
    "Arb": "0.0000025",
    "Polygon": "0.00063751115",
    "Optimism": "0.0000025",
    "Gnosis": "0.0005",
};
const destChains = [175, 155, 125, 116, 126, 153, 177, 176];
const destChainsGnosis = [125, 138, 150];

async function attemptMerkleyOFT(privateKey, chain, provider, min, max) {
    try {
        await merkleyOFT(privateKey, chain, provider, min, max, 0);
    } catch (e) {
        if (e.retries >= MAX_RETRIES) {
            console.log("Exceeded maximum number of attempts");
            return;
        }
        if (e instanceof MintingError) {
            await merkleyOFT(privateKey, chain, provider, min, max, e.retries);
        } else if (e instanceof BridgingError) {
            await onlyBridge(privateKey, chain, provider, e.times - 1, e.retries)
        } else {
            console.log(e);
        }
    }
}

async function merkleyOFT(privateKey, chain, provider, min, max, retries) {  
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    const merkleyOFTAddr = Merkley["OFT"][chain];
    const merkleyOFTContract = new ethers.Contract(merkleyOFTAddr, merkleyOFT_abi, provider);
    const contractWithSigner = await merkleyOFTContract.connect(wallet);
    console.log("Connected to merkley OFT...")

    const fee = chainToFee[chain];
    const times = await getRandomNumber(min, max);
    console.log(`   minting 5 OFT ${times} times...`);
    const payableAmountMint = ethers.utils.parseUnits(fee, "ether").mul(times).mul(5);

    try {
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        const tx = await contractWithSigner.mint(
            walletAddress,
            times * 5,
            {
                value: payableAmountMint,
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: maxPriorityFeePerGas
            }
        )
        await tx.wait();
    } catch (e) {
        throw new MintingError("Minting OFT failed", retries + 1);
    }
    console.log(`   minted successfully!\n`);

    await sleep(10,35);

    console.log("Preparing to bridge OFTs...\n");

    let destChainsToUse;
    if (chain === "Gnosis") {
        destChainsToUse = await getRandomElementsFromArray(times, destChainsGnosis);
    } else {
        destChainsToUse = await getRandomElementsFromArray(times, destChains);
    }
    console.log("   Destination chains selected:", destChainsToUse +"\n");

    const adapterParams = ethers.utils.solidityPack(
        ['uint16','uint256'],
        [1, 300000] // 1 is version, next argument is gaslimit
    )

    const amtBridge = BigNumber.from("5000000000000000000");
    const destChainFees = [];
    for (let i = 0; i < times; i++) {
        const fees = await contractWithSigner.estimateSendFee(
            destChainsToUse[i],            // the destination LayerZero chainId
            walletAddress,                 // your contract address that calls Endpoint.send()
            amtBridge,
            false,                         // _payInZRO
            adapterParams                  // default '0x' adapterParams, see: Relayer Adapter Param docs
        )
        destChainFees.push(fees[0]);
    }

    try {
        console.log(`Sending ${times} transactions...`);
        for (let i = 0; i < times; i++) {   
            const gasPrice = await provider.getGasPrice();
            const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
            const txBridge = await contractWithSigner.sendFrom(walletAddress, destChainsToUse[i], walletAddress, amtBridge, walletAddress, ethers.constants.AddressZero, "0x", {
                value: destChainFees[i],
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: maxPriorityFeePerGas,
                gasLimit: BigNumber.from('300000')
            });
        
            await txBridge.wait();  
            console.log(`   Successfully Bridged, tx hash: ${txBridge.hash}`);
        }
        console.log("Successfully Bridged all!");
    } catch (e) {
        console.log("bridge error: ", e)
        throw new BridgingError("Bridge transaction failed", times, 1);
    }
}

async function onlyBridge(privateKey, chain, provider, int, retries) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    const merkleyOFTAddr = Merkley["OFT"][chain];
    const merkleyOFTContract = new ethers.Contract(merkleyOFTAddr, merkleyOFT_abi, provider);
    const contractWithSigner = await merkleyOFTContract.connect(wallet);
    console.log("Connected to merkley OFT...")

    const times = int;

    console.log("Preparing to bridge OFTs...\n");

    let destChainsToUse;
    if (chain === "Gnosis") {
        destChainsToUse = await getRandomElementsFromArray(times, destChainsGnosis);
    } else {
        destChainsToUse = await getRandomElementsFromArray(times, destChains);
    }
    console.log(`   Destination chains selected: ${destChainsToUse}\n`);

    const adapterParams = ethers.utils.solidityPack(
        ['uint16','uint256'],
        [1, 300000] // 1 is version, next argument is gaslimit
    )

    const amtBridge = BigNumber.from("5000000000000000000");
    const destChainFees = [];
    for (let i = 0; i < times; i++) {
        const fees = await contractWithSigner.estimateSendFee(
            destChainsToUse[i],            // the destination LayerZero chainId
            walletAddress,                 // your contract address that calls Endpoint.send()
            amtBridge,
            false,                         // _payInZRO
            adapterParams                  // default '0x' adapterParams, see: Relayer Adapter Param docs
        )
        destChainFees.push(fees[0]);
    }

    try {
        console.log(`Sending ${times} transactions...`);
        for (let i = 0; i < times; i++) {   
            const gasPrice = await provider.getGasPrice();
            const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
            const txBridge = await contractWithSigner.sendFrom(walletAddress, destChainsToUse[i], walletAddress, amtBridge, walletAddress, ethers.constants.AddressZero, "0x", {
                value: destChainFees[i],
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: maxPriorityFeePerGas,
                gasLimit: BigNumber.from('300000')
            });
        
            await txBridge.wait();  
            console.log(`   Successfully Bridged, tx hash: ${txBridge.hash}`);
        }
        console.log("Successfully Bridged all!");
    } catch (e) {
        console.log("bridge error: ", e)
        throw new BridgingError("Bridge transaction failed", times, retries + 1);
    }
}

async function getRandomElementsFromArray(numElements, destChains) {
    if (numElements > destChains.length) {
        throw new Error('Number of elements requested is greater than the array length');
    }
    console.log("Randomly selecting destination chains to use...");
    await sleep(1,2);
    const shuffledArray = destChains.slice().sort(() => Math.random() - 0.5);
    return shuffledArray.slice(0, numElements);
}


class MintingError extends Error {
    constructor(message, retries) {
      super(message);
      this.name = 'MintingError';
      this.retries = retries;
    }
}

class BridgingError extends Error {
    constructor(message, times, id, retries) {
        super(message);
        this.name = 'BridgingError';
        this.times = times;
        this.retries = retries;
    }
}

module.exports = {
    attemptMerkleyOFT
};
