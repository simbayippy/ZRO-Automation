const { ethers } = require("ethers");
const axios = require('axios');
const { attemptSwap } = require('./swap');
const { RPC, Chain, Bungee } = require('./configs.json');
const { attemptL2Marathon } = require('./L2marathonDetails');
const { determineChain, getRandomNumber, print, sleep, getRandomDecimal } = require('./utils');
const { attemptMerkleyOFT } = require("./merkley");
const { BigNumber } = require('@ethersproject/bignumber');

const bungee_abi = require("./abis/bungee_abi.json");

async function refillGas(privateKey, chain, provider, min, max) {
    const walletDest = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(walletDest.address);
    const balanceEther = ethers.utils.formatEther(balance);
    const price = await getTokenPrice(chain);

    if (balanceEther * price > 0.5) {
        // if balance is already more than 0.5 cents
        print(walletDest.address, `Wallet already has sufficient native in ${chain}`);
        await attemptL2Marathon(privateKey, chain, provider, 1, 2);
        return;
    }

    let info = await determineChain(privateKey);
    await attemptSwap(privateKey, "Refill", info.highestChainProvider, info.usdAddr, info.nativeAddr, true);     
    const wallet = new ethers.Wallet(privateKey, info.highestChainProvider);
    const walletAddress = wallet.address;
    const bungeeAddr = Bungee["Addr"][info.highestChain];
    const bungeeContract = new ethers.Contract(bungeeAddr, bungee_abi, info.highestChainProvider);
    const contractWithSigner = await bungeeContract.connect(wallet);
    print(walletAddress, "Connected to bungee...");
    // console.log("Connected to bungee...")

    let valueInput = 0;
    if (info.highestChain === "Arb" || info.highestChain === "Optimism") {
        const etherAmount = await getRandomDecimal(0.00043, 0.00060); // Ether
        valueInput = ethers.utils.parseEther(etherAmount.toString());
    } else if (info.highestChain === "Polygon") {
        const etherAmount = await getRandomDecimal(1.1, 1.58); // Ether
        valueInput = ethers.utils.parseEther(etherAmount.toString());
    } else if (info.highestChain === "BSC") {
        const etherAmount = await getRandomDecimal(0.0031, 0.0041);
        valueInput = ethers.utils.parseEther(etherAmount.toString());
    } else if (info.highestChain === "Avax") {
        const etherAmount = await getRandomDecimal(0.0606, 0.089);
        valueInput = ethers.utils.parseEther(etherAmount.toString());    
    }
    print(walletAddress, `   refilling to Gnosis from ${info.highestChain}, using ${valueInput}native`);
    // console.log(`   refilling to Gnosis from ${info.highestChain}, using ${valueInput}native`);

    const gasPrice = await info.highestChainProvider.getGasPrice();
    const maxPriorityFeePerGas = gasPrice.mul(10).div(12);

    const tx = await contractWithSigner.depositNativeToken(
        100, 
        walletAddress,
        { 
            value: valueInput,
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas 
        }
    )
    await tx.wait();

    await waitArrival(walletAddress);

    const gnosisProvider = new ethers.providers.JsonRpcProvider(RPC["Gnosis"], Chain["Gnosis"]);

    const int = await getRandomNumber(0,1);
    if (int === 0) {
        await attemptL2Marathon(privateKey, chain, gnosisProvider, min, max);
    } else {
        await attemptMerkleyOFT(privateKey, chain, gnosisProvider, min, max);
    }

}

async function gnosis(privateKey, min, max) {
    const chain = "Gnosis";
    const gnosisProvider = new ethers.providers.JsonRpcProvider(RPC[chain], Chain[chain]);
    const walletGnosis = new ethers.Wallet(privateKey, gnosisProvider);
    const gnosisBalance = BigNumber.from(await gnosisProvider.getBalance(walletGnosis.address));
    if (gnosisBalance.gte(BigNumber.from("500000000000000000"))) {
        // if balance is already more than 0.5 cents
        await attemptL2Marathon(privateKey, chain, gnosisProvider, 1, 2);
        return;
    }

    let info = await determineChain(privateKey);
    await attemptSwap(privateKey, "Refill", info.highestChainProvider, info.usdAddr, info.nativeAddr, true);     
    const wallet = new ethers.Wallet(privateKey, info.highestChainProvider);
    const walletAddress = wallet.address;
    const bungeeAddr = Bungee["Addr"][info.highestChain];
    const bungeeContract = new ethers.Contract(bungeeAddr, bungee_abi, info.highestChainProvider);
    const contractWithSigner = await bungeeContract.connect(wallet);
    print(walletAddress, "Connected to bungee...");
    // console.log("Connected to bungee...")

    let valueInput = 0;
    if (info.highestChain === "Arb" || info.highestChain === "Optimism") {
        const etherAmount = await getRandomDecimal(0.00043, 0.00060); // Ether
        valueInput = ethers.utils.parseEther(etherAmount.toString());
    } else if (info.highestChain === "Polygon") {
        const etherAmount = await getRandomDecimal(1.1, 1.58); // Ether
        valueInput = ethers.utils.parseEther(etherAmount.toString());
    } else if (info.highestChain === "BSC") {
        const etherAmount = await getRandomDecimal(0.0031, 0.0041);
        valueInput = ethers.utils.parseEther(etherAmount.toString());
    } else if (info.highestChain === "Avax") {
        const etherAmount = await getRandomDecimal(0.0606, 0.089);
        valueInput = ethers.utils.parseEther(etherAmount.toString());    
    }
    print(walletAddress, `   refilling to Gnosis from ${info.highestChain}, using ${valueInput}native`);
    // console.log(`   refilling to Gnosis from ${info.highestChain}, using ${valueInput}native`);

    const gasPrice = await info.highestChainProvider.getGasPrice();
    const maxPriorityFeePerGas = gasPrice.mul(10).div(12);

    const tx = await contractWithSigner.depositNativeToken(
        100, 
        walletAddress,
        { 
            value: valueInput,
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas 
        }
    )
    await tx.wait();

    await waitArrival(walletAddress);

    const int = await getRandomNumber(0,1);
    if (int === 0) {
        await attemptL2Marathon(privateKey, chain, gnosisProvider, min, max);
    } else {
        await attemptMerkleyOFT(privateKey, chain, gnosisProvider, min, max);
    }

}

async function waitArrival(walletAddress) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["Gnosis"], Chain["Gnosis"]);
    let isBalanceReached = false;

    while (!isBalanceReached) {
        const balance = await provider.getBalance(walletAddress);
        const bigNumberBalance = BigNumber.from(balance);

        // more than 50 cents
        if (bigNumberBalance.gte(BigNumber.from("500000000000000000"))) {
            isBalanceReached = true;
        } else {
            print(walletAddress, 'Waiting for xDai to reach Gnosis...');
            // console.log('Waiting for xDai to reach Gnosis...');
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute
        }
    }

    console.log(`${await provider.getBalance(walletAddress)} xDai reached Gnosis\n`)
}

async function getTokenPrice(chain) {
    let input;
    if (chain === "Arb" || chain === "Optimism") {
        input = "ethereum";
    } else if (chain === "Polygon") {
        input = "polygon";
    } else if (chain === "Avax") {
        input = "avalanche";
    } else if (chain === "BSC") {
        input = "binance-coin";
    } else if (chain === "Gnosis") {
        input = "tether";
    }

    try {
        const response = await axios.get(`https://api.coincap.io/v2/assets/${input}`);
        const price = response.data.data.priceUsd;
        return price;
    } catch (error) {
        console.error('Error fetching token price:', error);
    }
}

module.exports = {
    refillGas,
    gnosis,
    getTokenPrice
};