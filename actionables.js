const { attemptSwap } = require('./swap');
const { attemptL2Marathon } = require('./L2marathonDetails');
const { gnosis } = require("./gnosis");
const { attemptMerkleyOFT } = require("./merkley");
const { determineChain, attemptBridge } = require('./utils');
const { MinMax } = require('./configs.json');

// main functions
async function runL2Marathon() {
    let info = await determineChain();
    
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        await attemptBridge(info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain();
    }

    await attemptSwap(info.highestChainProvider, info.usdAddr, info.nativeAddr);

    await attemptL2Marathon(info.highestChain, info.highestChainProvider, MinMax["Normal"]["Min"], MinMax["Normal"]["Max"]);
}

async function runMerkley() {
    let info = await determineChain();
    
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        await attemptBridge(info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain();
    }

    await attemptSwap(info.highestChainProvider, info.usdAddr, info.nativeAddr);

    await attemptMerkleyOFT(info.highestChain, info.highestChainProvider, MinMax["Normal"]["Min"], MinMax["Normal"]["Max"]);
}

async function runGnosis() {
    // process: 
    // 1) checks current highest USD balance chain. if avax/bsc -> sends to op/arb/poly
    // 2) from here, refill to gnosis
    let info = await determineChain();

    // send to op/arb/poly
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        await attemptBridge(info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
    }

    // gnosis has in built refill to gnosis
    // randomly chooses between minting OFT (merkly) & NFT (L2 marathon)
    await gnosis(MinMax["Gnosis"]["Min"], MinMax["Gnosis"]["Max"]); 
}


module.exports = {
    runL2Marathon,
    runMerkley,
    runGnosis
}
