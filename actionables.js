const { attemptSwap } = require('./swap');
const { attemptL2Marathon } = require('./L2marathonDetails');
const { gnosis, refillGas } = require("./gnosis");
const { attemptMerkleyOFT } = require("./merkley");
const { attemptAngleProtocol } = require("./angleProtocol");
const { attemptStakeStg, attemptPoolUsd } = require("./stakeStgUsd");
const { determineChain, attemptBridge, print } = require('./utils');
const { MinMax, RPC, Chain } = require('./configs.json');
const { ethers } = require("ethers");

// main functions
async function runL2Marathon(privateKey) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["Avax"], Chain["Avax"]);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    print(walletAddress, "running L2marathon full");
    // console.log("running L2marathon full")
    let info = await determineChain(privateKey);
    
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        print(walletAddress, `\n${info.highestChain} is currently not supported. Choosing random chain to bridge to...`);
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain(privateKey);
    }
    await attemptSwap(privateKey, "Normal", info.highestChainProvider, info.usdAddr, info.nativeAddr, true);

    await attemptL2Marathon(privateKey, info.highestChain, info.highestChainProvider, MinMax["Normal"]["Min"], MinMax["Normal"]["Max"]);
}

async function runMerkley(privateKey) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["BSC"], Chain["BSC"]);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    print(walletAddress, "running merkley full");
    // console.log("running merkley full")
    let info = await determineChain(privateKey);
    
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        print(walletAddress, `\n${info.highestChain} is currently not supported. Choosing random chain to bridge to...`);
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain(privateKey);
    }

    await attemptSwap(privateKey, "Normal", info.highestChainProvider, info.usdAddr, info.nativeAddr, true);

    await attemptMerkleyOFT(privateKey, info.highestChain, info.highestChainProvider, MinMax["Normal"]["Min"], MinMax["Normal"]["Max"]);
}

async function runGnosis(privateKey) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["Optimism"], Chain["Optimism"]);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    print(walletAddress, "running Gnosis full");
    // console.log("running Gnosis full")
    // process: 
    // 1) checks current highest USD balance chain. if avax/bsc -> sends to op/arb/poly
    // 2) from here, refill to gnosis
    let info = await determineChain(privateKey);

    // send to op/arb/poly
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        print(walletAddress, `\n${info.highestChain} is currently not supported. Choosing random chain to bridge to...`);
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
    }

    const chain = "Gnosis";
    const gnosisProvider = new ethers.providers.JsonRpcProvider(RPC[chain], Chain[chain]);

    // gnosis has in built refill to gnosis
    // randomly chooses between minting OFT (merkly) & NFT (L2 marathon)
    // await gnosis(privateKey, MinMax["Gnosis"]["Min"], MinMax["Gnosis"]["Max"]); 
    await refillGas(privateKey, chain, gnosisProvider, MinMax["Gnosis"]["Min"], MinMax["Gnosis"]["Max"]);
}

async function runAngleProtocol(privateKey) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["Polygon"], Chain["Polygon"]);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    print(walletAddress, "running Angle protocol full");

    let info = await determineChain(privateKey);
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        print(walletAddress, `\n${info.highestChain} is currently not supported. Choosing random chain to bridge to...`);
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain(privateKey);
    }

    await attemptAngleProtocol(privateKey, info.highestChain, info.highestChainProvider, info.usdAddr)
}

async function runStakeStg(privateKey) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["BSC"], Chain["BSC"]);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    print(walletAddress, "running stake stg full");

    let info = await determineChain(privateKey);
    
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        print(walletAddress, `\n${info.highestChain} is currently not supported. Choosing random chain to bridge to...`);
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain(privateKey);
    }

    await attemptStakeStg(privateKey, info.highestChain, info.highestChainProvider, info.usdAddr);
}

async function runPoolUsd(privateKey) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["BSC"], Chain["BSC"]);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    print(walletAddress, "running stake stg full");

    let info = await determineChain(privateKey);
    
    await attemptPoolUsd(privateKey, info.highestChain, info.highestChainProvider, info.highestStableCoin, info.usdAddr);
}

async function runTest(privateKey) {
    // await runL2Marathon(privateKey)
    // await runGnosis(privateKey);
    let info = await determineChain(privateKey);
    await attemptStakeStg(privateKey, info.highestChain, info.highestChainProvider, info.usdAddr)
    // await attemptPoolUsd(privateKey, info.highestChain, info.highestChainProvider, info.highestStableCoin, info.usdAddr);
}

// runTest("7470199b35c2c6a3d37a1708a8bf9797583d8a92e86320e4bed88c0587974b65")

module.exports = {
    runL2Marathon,
    runMerkley,
    runAngleProtocol,
    runGnosis,
    runStakeStg,
    runPoolUsd
}