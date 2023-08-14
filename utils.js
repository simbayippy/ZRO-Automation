const { ethers } = require("ethers");
const { RPC, Chain, Stargate, privateKey, StableCoins, WNative } = require('./configs.json');
const {waitForMessageReceived} = require('@layerzerolabs/scan-client');
const { BigNumber } = require('@ethersproject/bignumber');

const ERC20_abi = require("./abis/ERC20_abi.json");
const sg_abi = require("./abis/stargate_abi.json");

async function sleep(minSeconds, maxSeconds) {
    const randomSeconds = Math.random() * (maxSeconds - minSeconds) + minSeconds;

    if (randomSeconds > 5) {
        console.log(`Sleeping for ${randomSeconds}s...\n`)
    }
    return new Promise((resolve) => {
      setTimeout(resolve, randomSeconds * 1000);
    });
}

async function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
    let highestBalanceUnformatted = 0;
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
                const balanceDetails = await getBalance(provider, usdAddress, walletAddress);
                console.log(`   ${stableCoin} balance on ${chain}: ${balanceDetails.formatted}`);
    
                if (parseFloat(balanceDetails.formatted) > highestBalance) {
                    highestBalance = parseFloat(balanceDetails.formatted);
                    // return the unformatted in its respective decimals
                    highestBalanceUnformatted = parseFloat(balanceDetails.unformattedBalance)
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

    return { highestChain, highestChainProvider, highestBalanceUnformatted, highestStableCoin, usdAddr, nativeAddr };
}

async function getBalance(provider, contractAddress, walletAddress) {
    const contract = new ethers.Contract(contractAddress, ERC20_abi, provider);
    const unformattedBalance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    const formatted = ethers.utils.formatUnits(unformattedBalance, decimals);
    return { formatted, unformattedBalance };
}

async function attemptBridge(provider, chain, balance, usd) {
  try {
      await sleep(1,2);
      const validChains = ["Arb", "Optimism", "Polygon"];
      console.log(`\n${chain} is currently not supported. Choosing random chain to bridge to...`);
      await sleep(1,2);
      const index = await getRandomNumber(0,2);
      const chainToUse = validChains[index];
      console.log(`   ${chainToUse} selected. Bridging...\n`);
      await bridge(provider, chain, balance, usd, chainToUse, 0);

  } catch (e) {
      if (e instanceof USDBridgingError) {
          if (e.retries >= MAX_RETRIES) {
              console.log("failed");
              throw new Error("Exceeded maximum number of attempts");
          }
          await bridge(e.provider, e.srcChain, e.balanceUSD, e.srcUSD, e.destChain, e.retries)
      }
      else {
          console.log('An unexpected error occurred:', e);
      }
  }
}

async function bridge(provider, srcChain, balanceUSD, srcUSD, destChain, retries) {
    const usdAddr = StableCoins[srcUSD][srcChain];
    const sgAddr = Stargate["Addr"][srcChain];
    const sgSrcChainId = Stargate["ChainId"][srcChain]
    const sgDestChainId = Stargate["ChainId"][destChain];
    // const minOutput = Math.floor(balanceUSD * (0.995));
    const originalAmount = BigNumber.from(balanceUSD.toString()); // Convert balanceUSD to string
    const minOutput = originalAmount.mul(BigNumber.from('995')).div(BigNumber.from('1000'));

    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    
    const stContract = new ethers.Contract(sgAddr, sg_abi, provider);
    const contractWithSigner = await stContract.connect(wallet);

    await checkAllowance(usdAddr, provider, sgAddr, balanceUSD, wallet, 0);

    let quoteData = await contractWithSigner.quoteLayerZeroFee(
        sgDestChainId,                 // destination chainId
        1,                          // function type: see Bridge.sol for all types
        walletAddress,                  // destination of tokens
        "0x",                       // payload, using abi.encode()
        ({
            dstGasForCall: 0,       // extra gas, if calling smart contract,
            dstNativeAmount: 0,     // amount of dust dropped in destination wallet 
            dstNativeAddr: walletAddress // destination wallet for dust
        })
    )
    let feeWei = quoteData[0]

    try {
      const tx = await contractWithSigner.swap(
          sgDestChainId,
          Stargate["PoolId"][srcUSD],
          Stargate["PoolId"]["USDC"], // fixed to usdc
          walletAddress,
          originalAmount,
          minOutput,
          { dstGasForCall: 0, dstNativeAmount: 0, dstNativeAddr: "0x" },   // lzTxObj
          walletAddress, 
          "0x", // no payload
          { value: feeWei }  // <------ feeWei from quoteData[0] from quoteLayerZeroFee()   
      )
      await tx.wait();
      console.log(`Bridge successful. Transaction hash: ${tx.hash}`)
      console.log(`   Waiting for funds to reach destination. This may take awhile...\n`)
      const done  = await waitForMessageReceived(sgSrcChainId, tx.hash);
      console.log(`${done.status}. Moving onto next steps...\n`);
      await sleep(20,60)
    } catch (e) {
      console.log(e);
      throw new USDBridgingError("USD Bridge failed, ", provider, srcChain, balanceUSD, srcUSD, destChain, retries + 1);
    }
}

async function checkAllowance(contractIn, provider, spender, balanceUSD, wallet, retries) {
  console.log("Checking allowance...")
  const walletAddress = wallet.address;
  const usdContract = new ethers.Contract(contractIn, ERC20_abi, provider);
  const contractWithSigner = await usdContract.connect(wallet);

  const allowanceIn = await contractWithSigner.allowance(walletAddress, spender);
  if (allowanceIn > balanceUSD) {
      console.log("   allowance already set\n");
      return;
  }
  console.log(`   allowance not set. setting allowance...`)
  const amtToApprove = getRandomNumber(999999999, 999999999999)
  try {
    const tx = await contractWithSigner.approve(spender, amtToApprove);
    const receipt = await tx.wait();
    if (receipt.status === 0)
        throw new SwapError("Approve transaction failed", retries + 1);
  
    console.log(`   allowance of ${amtToApprove} set\n`);
  } catch (e) {
    if (retries >= 2) {
      throw new Error("Failed");
    }
    console.log("Set allowance failed. Retrying...");
    checkAllowance(contractWithSigner, spender, balanceUSD, walletAddress, retries + 1);
  }
}

class USDBridgingError extends Error {
  constructor(message, provider, srcChain, balanceUSD, srcUSD, destChain) {
      super(message);
      this.name = 'USDBridgingError';
      this.provider = provider;
      this.srcChain = srcChain;
      this.balanceUSD = balanceUSD;
      this.srcUSD = srcUSD;
      this.destChain = destChain;
  }
}

module.exports = {
    sleep,
    getRandomNumber,
    determineChain,
    // bridge,
    attemptBridge,
    // USDBridgingError,
};