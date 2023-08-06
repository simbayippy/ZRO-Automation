const { arbSwap, SwapError } = require('./arbSwap');
const { L2marathon, onlyBridge, MintingError, BridgingError } = require('./L2marathon');
const { determineChain } = require('./determineChain')
const { sleep } = require('./utils');

const MAX_RETRIES = 2;

async function main() {
    try {
        const info = await determineChain();
        
        if (info.highestChain === "Avax" || info.highestChain === "BSC") {
            throw `\n${info.highestChain} not yet supported. Coming soon.`;
        }

        await SwapAndL2marathon(info.highestChain, info.highestChainProvider, info.usdAddr, info.nativeAddr);    
        console.log('All operations completed successfully!');

    } catch (e) {
        console.log(e);
    }
}

async function SwapAndL2marathon(chain, provider, usdAddress, nativeAddr) {
    try{
        // First, perform the swap
        // arguments are: 1) actual provider (of specific chain) 2) address of usdt/c 3) retries count
        await arbSwap(provider, usdAddress, nativeAddr, 0);

        await sleep(15,35);
        // Then, perform the minting and bridging
        await L2marathon(chain, provider, 0);

        // await onlyBridge(chain, provider, 8, 5006373, 0);
    } catch (e) {
        if (e instanceof SwapError) {
            await retrySwap(e.retries);
        }
        else if (e instanceof MintingError) {
            await retryL2(e.retries);
        } 
        else if (e instanceof BridgingError) {
            // retries with 1 less nft
            console.log("here")
            await retryOnlyBridge(e.chain, e.provider, e.times - 1, e.id, e.retries); // starts at 1
        } 
        else {
            console.log('An unexpected error occurred:', e);
        }
    }
}

async function retrySwap(retries) {
    try {
        if (retries >= MAX_RETRIES) {
            console.log("Failed!");
            throw new Error("Exceeded maximum number of attempts");
        }
        console.log("Swap failed. Retrying...");
        console.log("Retry count: ", retries, " Max retries: ", MAX_RETRIES);

        await sleep(1,2);
        await arbSwap(retries);
    } catch {
        if (error instanceof SwapError) {
            await retrySwap(e.retries);
        } 
        else {
            throw error; // Throw other errors as-is
        }
    }
}

async function retryL2(retries) {
    try {
        if (retries >= MAX_RETRIES) {
            console.log("Failed!");
            throw new Error("Exceeded maximum number of attempts");
        }
        console.log("L2marathon minting failed. Retrying...");
        console.log("Retry count: ", retries, " Max retries: ", MAX_RETRIES);

        await sleep(1,2);
        await L2marathon(retries);
    } catch {
        if (error instanceof MintingError) {
            await retryL2(e.retries);
        } 
        else {
            throw error; // Throw other errors as-is
        }
    }
}

async function retryOnlyBridge(chain, provider, times, id, retries) {
    try {    
        if (retries >= MAX_RETRIES) {
            console.log("Failed!");
            throw new Error("Exceeded maximum number of bridge attempts");
        }
        console.log("Bridging failed. Retrying with 1 less nft...");
        console.log("Retry count: ", retries, " Max retries: ", MAX_RETRIES);

        await sleep(1,2);
        await onlyBridge(chain, provider, times, id, retries);
    } catch (error) {
        if (error instanceof BridgingError) {
            await retryOnlyBridge(error.chain, error.provider, error.times - 1, error.id, error.retries);
        } 
        else {
            throw error; // Throw other errors as-is
        }
    }
}

  
// Call the main function to execute both functionalities in sequence
main();
