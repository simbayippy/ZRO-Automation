const { attemptSwap } = require('./swap');
const { attemptL2Marathon } = require('./L2marathonDetails');
const { gnosis } = require("./gnosis");
const { attemptMerkleyOFT } = require("./merkley");
const { determineChain, attemptBridge } = require('./utils');
const { MinMax } = require('./configs.json');

// main functions
async function runL2Marathon(privateKey) {
    console.log("running L2marathon full")
    let info = await determineChain(privateKey);
    
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain(privateKey);
    }
    await attemptSwap(privateKey, info.highestChain, info.highestChainProvider, info.usdAddr, info.nativeAddr);

    await attemptL2Marathon(privateKey, info.highestChain, info.highestChainProvider, MinMax["Normal"]["Min"], MinMax["Normal"]["Max"]);
}

async function runMerkley(privateKey) {
    console.log("running merkley full")
    let info = await determineChain(privateKey);
    
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
        info = await determineChain(privateKey);
    }

    await attemptSwap(privateKey, info.highestChain, info.highestChainProvider, info.usdAddr, info.nativeAddr);

    await attemptMerkleyOFT(privateKey, info.highestChain, info.highestChainProvider, MinMax["Normal"]["Min"], MinMax["Normal"]["Max"]);
}

async function runGnosis(privateKey) {
    console.log("running Gnosis full")
    // process: 
    // 1) checks current highest USD balance chain. if avax/bsc -> sends to op/arb/poly
    // 2) from here, refill to gnosis
    let info = await determineChain(privateKey);

    // send to op/arb/poly
    if (info.highestChain === "Avax" || info.highestChain === "BSC") {
        await attemptBridge(privateKey, info.highestChainProvider, info.highestChain, info.highestBalanceUnformatted, info.highestStableCoin);
    }

    // gnosis has in built refill to gnosis
    // randomly chooses between minting OFT (merkly) & NFT (L2 marathon)
    await gnosis(privateKey, MinMax["Gnosis"]["Min"], MinMax["Gnosis"]["Max"]); 
}

module.exports = {
    runL2Marathon,
    runMerkley,
    runGnosis
}

// helper functions
// async function attemptBridge(provider, chain, balance, usd) {
//     try {
//         await sleep(1,2);
//         const validChains = ["Arb", "Optimism", "Polygon"];
//         console.log(`\n${chain} is currently not supported. Choosing random chain to bridge to...`);
//         await sleep(1,2);
//         const index = await getRandomNumber(0,2);
//         const chainToUse = validChains[index];
//         console.log(`   ${chainToUse} selected. Bridging...\n`);
//         await bridge(provider, chain, balance, usd, chainToUse, 0);

//     } catch (e) {
//         if (e instanceof USDBridgingError) {
//             if (e.retries >= MAX_RETRIES) {
//                 console.log("failed");
//                 throw new Error("Exceeded maximum number of attempts");
//             }
//             await bridge(e.provider, e.srcChain, e.balanceUSD, e.srcUSD, e.destChain, e.retries)
//         }
//         else {
//             console.log('An unexpected error occurred:', e);
//         }
//     }
// }

// async function attemptSwap(provider, usdAddr, nativeAddr) {
//     try {
//         await swap(provider, usdAddr, nativeAddr, 0);
//     } catch (e) {
//         if (e.retries >= MAX_RETRIES) {
//             console.log("Exceeded maximum number of attempts");
//             return;
//         }

//         if (e instanceof SwapError) {
//             await swap(provider, usdAddr, nativeAddr, e.retries);
//         } else {
//             console.log(e);
//         }
//     }
// }

// async function attemptL2Marathon(chain, provider) {
//     try {
//         await L2marathon(chain, provider, 4, 7, 0);
//     } catch (e) {
//         if (e.retries >= MAX_RETRIES) {
//             console.log("Exceeded maximum number of attempts");
//             return;
//         }
//         if (e instanceof MintingError) {
//             await L2marathon(chain, provider, 4, 7, e.retries);
//         } else if (e instanceof BridgingError) {
//             await onlyBridge(chain, provider, e.times - 1, e.id, e.retries)
//         } else {
//             console.log(e);
//         }
//     }
// }



/*
break
*/


// async function retryOnlyBridge(chain, provider, times, id, retries) {
//     try {    
//         if (retries >= MAX_RETRIES) {
//             console.log("Failed!");
//             throw new Error("Exceeded maximum number of bridge attempts");
//         }
//         console.log("Bridging failed. Retrying with 1 less nft...");
//         console.log("Retry count: ", retries, " Max retries: ", MAX_RETRIES);

//         await sleep(1,2);
//         await onlyBridge(chain, provider, times, id, retries);
//     } catch (error) {
//         if (error instanceof BridgingError) {
//             await onlyBridge(chain, provider, error.times - 1, error.id, error.retries);
//         } 
//         else {
//             throw error; // Throw other errors as-is
//         }
//     }
// }

// async function SwapAndL2marathon(chain, provider, usdAddress, nativeAddr) {
//     try{
//         // First, perform the swap
//         // arguments are: 1) actual provider (of specific chain) 2) address of usdt/c 3) retries count
//         await swap(provider, usdAddress, nativeAddr, 0);

//         await sleep(15,35);
//         // Then, perform the minting and bridging
//         await L2marathon(chain, provider, 0);
//         console.log('All operations completed successfully!');
//         // await onlyBridge(chain, provider, 8, 5006373, 0);
//     } catch (e) {
//         if (e instanceof SwapError) {
//             await retrySwap(e.retries);
//         }
//         else if (e instanceof MintingError) {
//             await retryL2(e.retries);
//         } 
//         else if (e instanceof BridgingError) {
//             // retries with 1 less nft
//             console.log("here")
//             await retryOnlyBridge(e.chain, e.provider, e.times - 1, e.id, e.retries); // starts at 1
//         } 
//         else {
//             console.log('An unexpected error occurred:', e);
//         }
//     }
// }

// async function retrySwap(retries) {
//     try {
//         if (retries >= MAX_RETRIES) {
//             console.log("Failed!");
//             throw new Error("Exceeded maximum number of attempts");
//         }
//         console.log("Swap failed. Retrying...");
//         console.log("Retry count: ", retries, " Max retries: ", MAX_RETRIES);

//         await sleep(1,2);
//         await swap(retries);
//     } catch {
//         if (error instanceof SwapError) {
//             await retrySwap(e.retries);
//         } 
//         else {
//             throw error; // Throw other errors as-is
//         }
//     }
// }

// async function retryL2(retries) {
//     try {
//         if (retries >= MAX_RETRIES) {
//             console.log("Failed!");
//             throw new Error("Exceeded maximum number of attempts");
//         }
//         console.log("L2marathon minting failed. Retrying...");
//         console.log("Retry count: ", retries, " Max retries: ", MAX_RETRIES);

//         await sleep(1,2);
//         await L2marathon(retries);
//     } catch {
//         if (error instanceof MintingError) {
//             await retryL2(e.retries);
//         } 
//         else {
//             throw error; // Throw other errors as-is
//         }
//     }
// }


  
// Call the main function to execute both functionalities in sequence
