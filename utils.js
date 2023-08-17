const { ethers } = require("ethers");
const { RPC, Chain, Stargate, StableCoins, WNative } = require('./configs.json');
const {waitForMessageReceived} = require('@layerzerolabs/scan-client');
const { BigNumber } = require('@ethersproject/bignumber');

const ERC20_abi = require("./abis/ERC20_abi.json");
const sg_abi = require("./abis/stargate_abi.json");
const MAX_RETRIES = 2;

async function sleep(minSeconds, maxSeconds, ...vaargs) {
    const randomSeconds = Math.random() * (maxSeconds - minSeconds) + minSeconds;
    const walletAddress = vaargs[0]; // Assuming the wallet address is the first argument

    if (randomSeconds > 5) {
        if (walletAddress) {
            print(walletAddress, `sleeping for ${randomSeconds}s...\n`)
            // console.log(`${walletAddress} Sleeping for ${randomSeconds}s...\n`);
        } else {
            console.log(`Sleeping for ${randomSeconds}s...\n`);
        }
    }

    return new Promise((resolve) => {
      setTimeout(resolve, randomSeconds * 1000);
    });
}

async function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

async function determineChain(privateKey) {
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
                // console.log(balanceDetails.unformattedBalance.toNumber());
                print(walletAddress, `   ${stableCoin} balance on ${chain}: ${balanceDetails.formatted}`);
                // console.log(`   ${stableCoin} balance on ${chain}: ${balanceDetails.formatted}`);
    
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
                print(walletAddress, `   ${stableCoin} not in use on ${chain}`)
                // console.log(`   ${stableCoin} not in use on ${chain}`);
            }
        }
    }
    print(walletAddress, `\n   Highest balance: ${highestBalance} on ${highestChain} for ${highestStableCoin}`);
    // console.log(`\n   Highest balance: ${highestBalance} on ${highestChain} for ${highestStableCoin}`);

    return { highestChain, highestChainProvider, highestBalanceUnformatted, highestStableCoin, usdAddr, nativeAddr };
}

async function getBalance(provider, contractAddress, walletAddress) {
    const contract = new ethers.Contract(contractAddress, ERC20_abi, provider);
    const unformattedBalance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    const formatted = ethers.utils.formatUnits(unformattedBalance, decimals);
    return { formatted, unformattedBalance };
}

async function attemptBridge(privateKey, provider, chain, balance, usd) {
  const wallet = new ethers.Wallet(privateKey, provider);
  const walletAddress = wallet.address;
  try {
      await sleep(1,2);
      const validChains = ["Arb", "Optimism", "Polygon"];
      print(walletAddress, `\n${chain} is currently not supported. Choosing random chain to bridge to...`);
      // console.log(`\n${chain} is currently not supported. Choosing random chain to bridge to...`);
      await sleep(1,2);
      const index = await getRandomNumber(0,2);
      const chainToUse = validChains[index];
      print(walletAddress, `   ${chainToUse} selected. Bridging...\n`);
      // console.log(`   ${chainToUse} selected. Bridging...\n`);
      await bridge(privateKey, provider, chain, balance, usd, chainToUse, 0);

  } catch (e) {
      if (e instanceof USDBridgingError) {
          if (e.retries >= MAX_RETRIES) {
              console.log("failed");
              throw new Error("Exceeded maximum number of attempts");
          }
          await bridge(privateKey, e.provider, e.srcChain, e.balanceUSD, e.srcUSD, e.destChain, e.retries)
      }
      else {
          print(walletAddress, `An unexpected error occurred: ${e}`)
          // console.log('An unexpected error occurred:', e);
      }
  }
}

async function bridge(privateKey, provider, srcChain, balanceUSD, srcUSD, destChain, retries) {
    const usdAddr = StableCoins[srcUSD][srcChain];
    const sgAddr = Stargate["Addr"][srcChain];
    const sgSrcChainId = Stargate["ChainId"][srcChain]
    const sgDestChainId = Stargate["ChainId"][destChain];
    const originalAmount = BigNumber.from(balanceUSD.toString()); // Convert balanceUSD to string
    const minOutput = originalAmount.mul(BigNumber.from('995')).div(BigNumber.from('1000'));

    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    
    const stContract = new ethers.Contract(sgAddr, sg_abi, provider);
    const contractWithSigner = await stContract.connect(wallet);

    await checkAllowance(usdAddr, provider, sgAddr, wallet, 0);
    await sleep(1, 3);
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
          { 
            value: feeWei
          }  // <------ feeWei from quoteData[0] from quoteLayerZeroFee()   
      )
      await tx.wait();
      print(walletAddress, `Bridge successful. Transaction hash: ${tx.hash}`);
      // console.log(`Bridge successful. Transaction hash: ${tx.hash}`)
      print(walletAddress, `   Waiting for funds to reach destination. This may take awhile...\n`);
      // console.log(`   Waiting for funds to reach destination. This may take awhile...\n`)
      const done  = await waitForMessageReceived(sgSrcChainId, tx.hash);
      print(walletAddress, `${done.status}. Moving onto next steps...\n`);
      // console.log(`${done.status}. Moving onto next steps...\n`);
      await sleep(20,60, walletAddress)
    } catch (e) {
      print(walletAddress, `Bridge failed: ${e}`);
      throw new USDBridgingError("USD Bridge failed, ", provider, srcChain, srcUSD, destChain, retries + 1);
    }
}

async function checkAllowance(contractIn, provider, spender, wallet, retries) {
  const walletAddress = wallet.address;
  print(walletAddress, "Checking allowance...");
  // console.log("Checking allowance...")
  const usdContract = new ethers.Contract(contractIn, ERC20_abi, provider);
  const contractWithSigner = await usdContract.connect(wallet);

  const allowanceIn = await contractWithSigner.allowance(walletAddress, spender);
  const desiredAllowance = BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935");
  const checkAllowanceBenchmark = BigNumber.from("115792089237316195423570985008687907853269984665640394575");

  if (allowanceIn.gt(checkAllowanceBenchmark)) {
    print(walletAddress, "   Allowance already sufficient\n");
    // console.log("   Allowance already sufficient\n");
    return;
  } 
  print(walletAddress, "   Allowance not sufficient. Setting allowance...")
  // console.log("   Allowance not sufficient. Setting allowance...");

  try {
    const gasPrice = await provider.getGasPrice();
    const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
    const tx = await contractWithSigner.approve(spender, desiredAllowance, {
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: maxPriorityFeePerGas
    });
    await tx.wait();
    print(walletAddress, `   allowance of ${desiredAllowance} set\n`)
    // console.log(`   allowance of ${desiredAllowance} set\n`);
  } catch (e) {
    if (retries >= 2) {
      throw new Error("Failed");
    }
    // console.log(e)
    print(walletAddress, `Set allowance failed: ${e}`);
    // console.log("Set allowance failed. Retrying...");
    checkAllowance(contractIn, provider, spender, wallet, retries + 1);
  }
}

class USDBridgingError extends Error {
  constructor(message, provider, srcChain, srcUSD, destChain) {
      super(message);
      this.name = 'USDBridgingError';
      this.provider = provider;
      this.srcChain = srcChain;
      this.srcUSD = srcUSD;
      this.destChain = destChain;
  }
}

function print(walletAddr, string) {
  const shortenedWallet = `${walletAddr.slice(0, 4)}...${walletAddr.slice(-4)}`;
  console.log(`${shortenedWallet}: ${string}`);
}

module.exports = {
    sleep,
    getRandomNumber,
    getRandomDecimal,
    determineChain,
    // bridge,
    attemptBridge,
    print,
    checkAllowance,
    // USDBridgingError,
};