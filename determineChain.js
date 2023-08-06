const { ethers } = require("ethers");
const { RPC, Chain, privateKey, StableCoins, WNative } = require('./configs.json');

const ERC20_abi = require("./abis/ERC20_abi.json");

async function determineChain() {
    const providers = [];
    const chains = [];
    for (chainName of Object.keys(RPC)) {
        providers.push(new ethers.providers.JsonRpcProvider(RPC[chainName], Chain[chainName]));
        chains.push(chainName);
    }

    const walletAddress = (new ethers.Wallet(privateKey, providers[0])).address;
    console.log(`Wallet address: ${walletAddress}`);

    let highestBalance = 0;
    let highestChain;
    let highestStableCoin;

    // the important things to return
    let highestChainProvider;
    let usdAddr;
    let nativeAddr;

    for (const chain of chains) {
        for (const stableCoin of Object.keys(StableCoins)) {
            const usdAddress = StableCoins[stableCoin][chain];
            const providerIndex = chains.indexOf(chain);
            const provider = providers[providerIndex];
            
            try {
                const balance = await getBalance(provider, usdAddress, walletAddress);
                console.log(`   ${stableCoin} balance on ${chain}: ${balance}`);
    
                if (parseFloat(balance) > highestBalance) {
                    highestBalance = parseFloat(balance);
                    highestChain = chain;
                    highestStableCoin = stableCoin;
                    
                    // the important things to return
                    highestChainProvider = provider;
                    usdAddr = usdAddress;
                    nativeAddr = WNative[highestChain];
                }
            } catch (error) {
                // Handle error when stablecoin not found on the chain
                console.log(`   ${stableCoin} not in use on ${chain}`);
            }
        }
    }

    console.log(`\n   Highest balance: ${highestBalance} on ${highestChain} for ${highestStableCoin}`);

    return { highestChain, highestChainProvider, usdAddr, nativeAddr };
}

async function getBalance(provider, contractAddress, walletAddress) {
    const contract = new ethers.Contract(contractAddress, ERC20_abi, provider);
    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    return ethers.utils.formatUnits(balance, decimals);
}


module.exports = {
    determineChain,
};