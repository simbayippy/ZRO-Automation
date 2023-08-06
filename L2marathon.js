const { ethers } = require("ethers");
const { privateKey } = require('./configs.json');
const { BigNumber } = require('@ethersproject/bignumber');
const { sleep } = require('./utils');

// constants for L2marathon
const L2marathon_abi = require("./abis/L2marathon_abi.json");
const L2marathonAddrArb = "0x60aED56615849e51Faf98E585A71b6FE7452F360";
const L2marathonAddrPoly = "0x8A0536f8cd536286565EcDF891f0e207234D1F56";
const L2marathonAddrOp = "0x841Ce2611371E2db9eB49DdA783Ec67654f6818A";
const chainToAddress = {
    "Arb": L2marathonAddrArb,
    "Polygon": L2marathonAddrPoly,
    "Optimism": L2marathonAddrOp,
};
const feeArbnOp = "0.00033";
const feePoly = "0.66";
const chainToFee = {
    "Arb": feeArbnOp,
    "Polygon": feePoly,
    "Optimism": feeArbnOp,
};
// the destination chains that are cheapest and not already included in co-pilot
const destChains = [176,116,155,173,167,177,126,125,175,159];

async function L2marathon(chain, provider, retries) {
    // Check if the provided chain is valid
    if (!(chain in chainToAddress)) {
        throw new Error(`Invalid chain: ${chain}. Must be one of "Arb", "Poly", or "Optimism".`);
    }

    // Get the respective address based on the chain
    const L2marathonAddress = chainToAddress[chain];
    const fee = chainToFee[chain];
    
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    const times = await getRandomNumber(4,7);

    await sleep(0,2);

    console.log(`Number of NFTs to mint: ${times} (randomly chosen)\n`);

    await sleep(0,2);

    const contractL2Marathon = new ethers.Contract(L2marathonAddress, L2marathon_abi, provider);
    const contractWithSigner = await contractL2Marathon.connect(wallet);

    const payableAmountMint = ethers.utils.parseUnits(fee, "ether").mul(times); // 0.33 ETH in wei

    console.log("Connected to L2Marathon!\n");

    await sleep(0,2);
    console.log(`Minting ${times} time(s) Cost: ${fee*times} Native + gas`);

    const start = await contractWithSigner.nextMintId();
    const startId = start.toNumber();
    const endId = startId + times; // does not mint the endId (1 less)

    console.log(`    Minting ids from ${startId} to ${endId - 1}`);

    try {
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        const txMint = await contractWithSigner.ultraMint(times, { 
            value: payableAmountMint,
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas
        });
        const receiptMint = await txMint.wait();
        // if tx fails this doesn't actually reach lol
        if (receiptMint.status === 0) {
            throw new MintingError('Minting NFTs failed', retries + 1);
        }
        console.log("Successfully minted! Transaction Hash:", txMint.hash + "\n");
    } catch (e) {
        console.log(e);
        throw new MintingError('Minting NFTs failed', retries + 1);
    }

    await sleep(15, 35);

    console.log("Preparing to bridge NFTs...\n");

    const idArray = [];
    for (let i = startId; i < endId; i++) {
        idArray.push(i);
    }

    const adapterParams = ethers.utils.solidityPack(
        ['uint16','uint256'],
        [1, 300000] // 1 is version, next argument is gaslimit
    )

    const destChainsToUse = await getRandomElementsFromArray(times); // array of chains to send to
    console.log("   Destination chains selected:", destChainsToUse +"\n");

    const adapterArray = []
    const destChainFees = [];
    let totalFees = ethers.BigNumber.from(0);
    for (let i = 0; i < times; i++) {
        const fees = await contractWithSigner.estimateSendFee(
            destChainsToUse[i],            // the destination LayerZero chainId
            walletAddress,                 // your contract address that calls Endpoint.send()
            startId + i,
            false,                         // _payInZRO
            adapterParams                  // default '0x' adapterParams, see: Relayer Adapter Param docs
        )
        totalFees = totalFees.add(fees[0]);
        destChainFees.push(fees[0]);
        adapterArray.push(adapterParams);
    }

    console.log(`total destination fees in wei: ${totalFees}, in ethers: ${ethers.utils.formatEther(totalFees)}\n`)  

    // const payableAmountBridge = ethers.utils.parseUnits(totalFees.toString(), "wei");
    const payableAmountBridge = totalFees; // Use the BigNumber directly

    try {
        console.log("Sending transaction...\n");
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        const txBridge = await contractWithSigner.ultraRun(walletAddress, destChainsToUse, walletAddress, idArray, walletAddress, ethers.constants.AddressZero, adapterArray, destChainFees, {
            value: payableAmountBridge,
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            gasLimit: BigNumber.from('3000000')
        });
    
        const receiptBridge = await txBridge.wait();
        // if tx fails this doesn't actually reach lol
        if (receiptBridge.status === 0) {
            throw new BridgingError('Bridging transaction failed', chain, provider, times, startId, 1);
        }
        console.log("Successfully Bridged! Transaction Hash:", txBridge.hash);
    } catch (e) {
        throw new BridgingError("Bridge transaction failed", chain, provider, times, startId, 1);
    }
}

async function onlyBridge(chain, provider, int, start, retries) {
    if (!(chain in chainToAddress)) {
        throw new Error(`Invalid chain: ${chain}. Must be one of "Arb", "Poly", or "Optimism".`);
    }

    // Get the respective address based on the chain
    const L2marathonAddress = chainToAddress[chain];

    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    const times = int;
    const contractL2Marathon = new ethers.Contract(L2marathonAddress, L2marathon_abi, provider);
    const contractWithSigner = await contractL2Marathon.connect(wallet);

    const startId = start;
    const endId = startId + times; // does not mint the endId (1 less)

    console.log("Preparing to bridge NFTs...\n");

    await sleep(1,2);

    const idArray = [];
    for (let i = startId; i < endId; i++) {
        idArray.push(i);
    }

    const adapterParams = ethers.utils.solidityPack(
        ['uint16','uint256'],
        [1, 300000] // 1 is version, next argument is gaslimit
    )

    const destChainsToUse = await getRandomElementsFromArray(times); // array of chains to send to
    console.log("   Destination chains selected: ", destChainsToUse +"\n");

    const adapterArray = []
    const destChainFees = [];
    let totalFees = ethers.BigNumber.from(0);
    for (let i = 0; i < times; i++) {
        const fees = await contractWithSigner.estimateSendFee(
            destChainsToUse[i],            // the destination LayerZero chainId
            walletAddress,                 // your contract address that calls Endpoint.send()
            startId + i,
            false,                         // _payInZRO
            adapterParams                  // default '0x' adapterParams, see: Relayer Adapter Param docs
        )
        totalFees = totalFees.add(fees[0]);
        destChainFees.push(fees[0]);
        adapterArray.push(adapterParams);
    }

    console.log(`total destination fees in wei: ${totalFees}, in ethers: ${ethers.utils.formatEther(totalFees)}\n`)  

    // const payableAmountBridge = ethers.utils.parseUnits(totalFees.toString(), "wei");
    const payableAmountBridge = totalFees; // Use the BigNumber directly

    console.log("Sending transaction...\n");

    try {
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        const txBridge = await contractWithSigner.ultraRun(walletAddress, destChainsToUse, walletAddress, idArray, walletAddress, ethers.constants.AddressZero, adapterArray, destChainFees, {
            value: payableAmountBridge,
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            gasLimit: BigNumber.from('4000000')
        });
        const receiptBridge = await txBridge.wait();
        // if tx fails this doesn't actually reach lol
        if (receiptBridge.status === 0) {
            console.log("here first");
            throw new BridgingError("Bridge transaction failed", chain, provider, times, startId, retries + 1);
        } 
        console.log("Successfully Bridged! Transaction Hash:", txBridge.hash, "\n");
    } catch(e) {
        console.log(e);
        throw new BridgingError("Bridge transaction failed", chain, provider, times, startId, retries + 1);
    }
}

async function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
  
async function getRandomElementsFromArray(numElements) {
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
    constructor(message, chain, provider, times, id, retries) {
        super(message);
        this.name = 'BridgingError';
        this.chain = chain;
        this.provider = provider;
        this.times = times;
        this.id = id;
        this.retries = retries;
    }
}

module.exports = {
    L2marathon,
    onlyBridge,
    MintingError,
    BridgingError,
};
