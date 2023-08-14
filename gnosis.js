const { ethers } = require("ethers");
const { attemptSwap } = require('./swap');
const { RPC, Chain, Bungee, privateKey } = require('./configs.json');
const { attemptL2Marathon } = require('./L2marathonDetails');
const { determineChain, getRandomNumber } = require('./utils');
const { attemptMerkleyOFT } = require("./merkley");
const { BigNumber } = require('@ethersproject/bignumber');

const bungee_abi = require("./abis/bungee_abi.json");

async function gnosis(min, max) {
    const chain = "Gnosis";
    const gnosisProvider = new ethers.providers.JsonRpcProvider(RPC[chain], Chain[chain]);
    const walletGnosis = new ethers.Wallet(privateKey, gnosisProvider);
    const gnosisBalance = BigNumber.from(await gnosisProvider.getBalance(walletGnosis.address));
    if (gnosisBalance.gte(BigNumber.from("500000000000000000"))) {
        // if balance is already more than 0.5 cents
        await L2marathon(chain, gnosisProvider, 1, 2, 0);
        return;
    }

    let info = await determineChain();
    await attemptSwap("Gnosis", info.highestChainProvider, info.usdAddr, info.nativeAddr);     
    const wallet = new ethers.Wallet(privateKey, info.highestChainProvider);
    const walletAddress = wallet.address;
    const bungeeAddr = Bungee["Addr"][info.highestChain];
    const bungeeContract = new ethers.Contract(bungeeAddr, bungee_abi, info.highestChainProvider);
    const contractWithSigner = await bungeeContract.connect(wallet);
    console.log("Connected to bungee...")

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
    console.log(`   refilling to Gnosis from ${info.highestChain}, using ${valueInput}native`)

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
        await attemptL2Marathon(chain, gnosisProvider, min, max);
    } else {
        await attemptMerkleyOFT(chain, gnosisProvider, min, max);
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
            console.log('Waiting for xDai to reach Gnosis...');
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute
        }
    }

    console.log(`${await provider.getBalance(walletAddress)} xDai reached Gnosis\n`)
}

async function getRandomDecimal(min, max) {
    // Convert decimals to integers by multiplying with a power of 10
    const factor = 1000; // Adjust this based on the number of decimal places you want
    min *= factor;
    max *= factor;
    
    // Generate a random integer within the range
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    
    // Convert the random integer back to a decimal
    const result = randomNumber / factor;
    
    return result;
}

module.exports = {
    gnosis,
};