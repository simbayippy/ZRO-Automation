const { ethers } = require("ethers");
const { swap, SwapError } = require('./swap');
const { RPC, Chain, Bungee, privateKey, StableCoins, WNative } = require('./configs.json');
const { L2marathon, onlyBridge, MintingError, BridgingError } = require('./L2marathon');
const { sleep, getRandomNumber, determineChain, bridge, USDBridgingError } = require('./utils');
const { BigNumber } = require('@ethersproject/bignumber');

const ERC20_abi = require("./abis/ERC20_abi.json");
const bungee_abi = require("./abis/bungee_abi.json");

// firstly, swap 1 usdc -> native
// then, bungee refill -> gnosis

const MAX_RETRIES = 2;

async function gnosis() {
    const chain = "Gnosis";
    const gnosisProvider = new ethers.providers.JsonRpcProvider(RPC[chain], Chain[chain]);
    const walletGnosis = new ethers.Wallet(privateKey, gnosisProvider);
    const gnosisBalance = BigNumber.from(await gnosisProvider.getBalance(walletGnosis.address));
    if (gnosisBalance.gte(BigNumber.from("500000000000000000"))) {
        await L2marathon(chain, gnosisProvider, 1, 3, 0);
        return;
    }

    let info = await determineChain();
    await attemptSwap(info.highestChainProvider, info.usdAddr, info.nativeAddr);     
    const wallet = new ethers.Wallet(privateKey, info.highestChainProvider);
    const walletAddress = wallet.address;
    const bungeeAddr = Bungee["Addr"][info.highestChain];
    const bungeeContract = new ethers.Contract(bungeeAddr, bungee_abi, info.highestChainProvider);
    const contractWithSigner = await bungeeContract.connect(wallet);

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

    try {
        await L2marathon(chain, gnosisProvider, 1, 3, 0);
    } catch (e) {
        if (e.retries >= 2) {
            console.log("Exceeded maximum number of attempts");
            return;
        }
        if (e instanceof MintingError) {
            await L2marathon(chain, provider, 1, 3, e.retries);
        } else if (e instanceof BridgingError) {
            await onlyBridge(chain, provider, e.times - 1, e.id, e.retries)
        } else {
            console.log(e);
        }
    }
}

async function attemptSwap(provider, usdAddr, nativeAddr) {
    try {
        await swap(provider, usdAddr, nativeAddr, 0);
    } catch (e) {
        if (e.retries >= MAX_RETRIES) {
            console.log("Exceeded maximum number of attempts");
            return;
        }

        if (e instanceof SwapError) {
            await swap(provider, usdAddr, nativeAddr, e.retries);
        } else {
            console.log(e);
        }
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

// waitArrival("0x48effb193084197000f280fa751c993444e79f04");
gnosis()