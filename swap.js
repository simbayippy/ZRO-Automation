const { ethers } = require("ethers");
const { TradeType, Token, CurrencyAmount, Percent, } = require('@uniswap/sdk-core');
const { Pool, Trade, SwapRouter, Route } = require('@uniswap/v3-sdk');
const IUniswapV3Pool = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json');
const IUniswapV3Factory = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json');
const QuoterABI = require('@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json');
const { BigNumber } = require('@ethersproject/bignumber');
const { SwapAmount } = require('./configs.json');
const { sleep, getRandomNumber, print, getRandomDecimal } = require('./utils');

const ERC20_abi = require("./abis/ERC20_abi.json");
const WNative_abi = require("./abis/wnative_abi.json");

// address is the same for Arbitrum, Optimism, Polygon
const UNISWAP_FACTORY_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const UNISWAP_QUOTER_ADDRESS = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6'
const V3_SWAP_ROUTER_ADDRESS = '0xe592427a0aece92de3edee1f18e0157c05861564';


async function attemptSwap(privateKey, type, provider, from, to, toNative, ...vaargs) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    try {
        if (vaargs.length > 0) {
            await swap(privateKey, type, provider, from, to, toNative, 0, ...vaargs);
        } else {
            await swap(privateKey, type, provider, from, to, toNative, 0);
        }
    } catch (e) {
        if (e.retries >= 2) {
            print(walletAddress, "Exceeded maximum number of attempts")
            // console.log("Exceeded maximum number of attempts");
            return;
        }
        if (e instanceof SwapError) {
            if (vaargs.length > 0) {
                await swap(privateKey, type, provider, from, to, toNative, e.retries, ...vaargs);
            } else {
                await swap(privateKey, type, provider, from, to, toNative, e.retries);
            }
        } else {
            // console.log(e);
            print(walletAddress, e);
        }
    }
}

async function swap(privateKey, type, provider, from, to, retries, toNative, ...vaargs) {
    // Use WNative_abi by default if vaargs[0] is not provided
    const toAbi = vaargs[0] || WNative_abi; 

    const rangeMin = SwapAmount[type]["Min"];
    const rangeMax = SwapAmount[type]["Max"];
    const randomDecimalAmt = await getRandomDecimal(rangeMin, rangeMax);
    const inAmountStr = randomDecimalAmt.toString();

    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    // swapping USDC.e -> weth -> unwrap to eth
    const contractIn = new ethers.Contract(from, ERC20_abi, provider);

    const contractOut = new ethers.Contract(to, toAbi, provider);
    const balanceEth = await provider.getBalance(walletAddress);

    print(walletAddress, "Checking balance of wallet...");
    print(walletAddress, `Native balance: ${ethers.utils.formatEther(balanceEth)}`);
    // console.log("Checking balance of wallet...")
    // console.log("   Native balance: ",  ethers.utils.formatEther(balanceEth))

    const balanceWNative = await contractOut.balanceOf(walletAddress);
    const decimalsWNative = await contractOut.decimals();
    const WNativeSymbol = await contractOut.symbol();
    print(walletAddress, `   ${WNativeSymbol} balance: ${balanceWNative}`);
    // console.log(`   ${WNativeSymbol} balance: ${balanceWNative}`);
    
    const balanceUSD = await contractIn.balanceOf(walletAddress);
    const decimalsUSD = await contractIn.decimals();
    const formattedBalance = ethers.utils.formatUnits(balanceUSD, decimalsUSD);
    const USDSymbol = await contractIn.symbol()
    print(walletAddress, `   ${USDSymbol} balance: ${formattedBalance}`);
    // console.log(`   ${USDSymbol} balance: ${formattedBalance}\n`);

    await sleep(0,2);

    const network = await provider.getNetwork();
    // uniswap
    const tokenIn = new Token(network.chainId, from, decimalsUSD, USDSymbol);
    const tokenOut = new Token(network.chainId, to, decimalsWNative, WNativeSymbol);

    if (parseFloat(formattedBalance) < parseFloat(inAmountStr)) {
        print(walletAddress, `Error: not enough ${tokenIn.symbol}. Have: ${formattedBalance}, need: ${inAmountStr}\nTop up wallet ${walletAddress}`);
        // console.log(`Error: not enough ${tokenIn.symbol}. Have: ${formattedBalance}, need: ${inAmountStr}\nTop up wallet ${walletAddress}`);
        throw new SwapError("Not enough balance", retries + 1);
    }

    // ============= PART 2 --- get Uniswap pool for pair TokenIn-TokenOut
    const pool = await uniswapPool(tokenIn, tokenOut, provider);

    await sleep(0,2);

    // ============= PART 3 --- Giving a quote for user input
    print(walletAddress, "Getting quote for swap...");
    // console.log("Getting quote for swap...");
    const amountIn = ethers.utils.parseUnits(inAmountStr, tokenIn.decimals);

    const approxAmountOut = await getQuote(amountIn, tokenIn, tokenOut, pool, inAmountStr, provider);

    await sleep(0,2);

    // ============= PART 4 --- Loading a swap route
    print(walletAddress, "Creating swap route based on quote...")
    // console.log("Creating swap route based on quote...");

    const uncheckedTrade = await createRoute(pool, tokenIn, tokenOut, amountIn, approxAmountOut);

    await sleep(0,2);

    // // ============= PART 5 --- Making actual swap
    print(walletAddress, "Checking allowance...");
    // console.log("Checking allowance..."); 
    await checkAllowance(contractIn, network.chainId, wallet, inAmountStr, provider, retries);

    await sleep(5,25, walletAddress);
    print(walletAddress, "Sending swap...\n");
    // console.log("Sending swap...\n");

    const options = {
        slippageTolerance: new Percent(50, 10000), // 50 bips, or 0.50%
        deadline: Math.floor(Date.now() / 1000 + 1800),
        recipient: walletAddress,
    };

    const methodParameters = SwapRouter.swapCallParameters([uncheckedTrade], options)

    const gasPrice = await provider.getGasPrice();
    const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
    const transaction = {
        data: methodParameters.calldata,
        to: V3_SWAP_ROUTER_ADDRESS,
        value: BigNumber.from(methodParameters.value),
        from: walletAddress,
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: maxPriorityFeePerGas,
        gasLimit: BigNumber.from('200000')
    }

    try {
        // Send the swap transaction
        let tx = await wallet.sendTransaction(transaction);
        let receipt = await tx.wait();

        if (receipt.status === 0) {
            throw new SwapError("Swap transaction failed", retries + 1);
        }
    } catch(e) {
        print(walletAddress, e);
        // console.log(e)
        throw new SwapError("Swap transaction failed", retries + 1);
    }

    // ============= Final part --- printing results
    let [newBalanceIn, newBalanceOut] = await Promise.all([
        contractIn.balanceOf(walletAddress),
        contractOut.balanceOf(walletAddress)
    ]);

    print(walletAddress, 'Swap completed successfully!\n');
    print(walletAddress, 'Updated balances:')
    print("   Native: ", ethers.utils.formatEther(await provider.getBalance(walletAddress)));
    print(`   ${tokenIn.symbol}: ${ethers.utils.formatUnits(newBalanceIn, tokenIn.decimals)}`);
    print(`   ${tokenOut.symbol}: ${ethers.utils.formatUnits(newBalanceOut, tokenOut.decimals)}\n`);
    // console.log('Swap completed successfully!\n');
    // console.log('Updated balances:');
    // console.log("   Native: ", ethers.utils.formatEther(await provider.getBalance(walletAddress)));
    // console.log(`   ${tokenIn.symbol}: ${ethers.utils.formatUnits(newBalanceIn, tokenIn.decimals)}`);
    // console.log(`   ${tokenOut.symbol}: ${ethers.utils.formatUnits(newBalanceOut, tokenOut.decimals)}\n`);

    await sleep(5,22, walletAddress);

    // if native then need to unwrap, else return immediately
    if (!toNative) {
        return;
    }

    print(walletAddress, `Unwrapping ${WNativeSymbol} to Native...\n`);
    // console.log(`Unwrapping ${WNativeSymbol} to Native...\n`);

    const contractWithSigner = await contractOut.connect(wallet);
    const payableAmount = ethers.utils.parseUnits("0", "ether"); // 0

    try {
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        tx = await contractWithSigner.withdraw(newBalanceOut, { 
            value: payableAmount,
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas
        });
        receipt = await tx.wait();
        if (receipt.status === 0) {
            throw new SwapError("Unwrap failed", retries + 1);
        }
        console.log("Successfully unwraped! Transaction Hash:", tx.hash, "\n");    
    } catch (e) {
        console.log(e);
        throw new SwapError("Unwrap failed", retries + 1);
    }

    [newBalanceIn, newBalanceOut] = await Promise.all([
        contractIn.balanceOf(walletAddress),
        contractOut.balanceOf(walletAddress)
    ]);

    print(walletAddress, 'Updated balances:');
    print("   Native: ", ethers.utils.formatEther(await provider.getBalance(walletAddress)));
    print(`   ${tokenIn.symbol}: ${ethers.utils.formatUnits(newBalanceIn, tokenIn.decimals)}`);
    print(`   ${tokenOut.symbol}: ${ethers.utils.formatUnits(newBalanceOut, tokenOut.decimals)}\n`);
    // console.log('Updated balances:');
    // console.log("   Native: ", ethers.utils.formatEther(await provider.getBalance(walletAddress)));
    // console.log(`   ${tokenIn.symbol}: ${ethers.utils.formatUnits(newBalanceIn, tokenIn.decimals)}`);
    // console.log(`   ${tokenOut.symbol}: ${ethers.utils.formatUnits(newBalanceOut, tokenOut.decimals)}\n`);

    print(walletAddress, "Swapping done.\n");
    // console.log("Swapping done.\n")
}

async function uniswapPool(tokenIn, tokenOut, provider) {
    const factoryContract = new ethers.Contract(UNISWAP_FACTORY_ADDRESS, IUniswapV3Factory.abi, provider);
    
    // loading pool smart contract address
    const poolAddress = await factoryContract.getPool(
        tokenIn.address,
        tokenOut.address,
        3000 // commission - 0.3%
    ); 

    if (Number(poolAddress).toString() === "0") {// there is no such pool for provided In-Out tokens.
        console.log(`Error: No pool ${tokenIn.symbol}-${tokenOut.symbol}`);
        throw new SwapError(`No pool ${tokenIn.symbol}-${tokenOut.symbol}`, retries + 1);
    }
    const poolContract = new ethers.Contract(poolAddress, IUniswapV3Pool.abi, provider);

    const getPoolState = async function () {
        const [liquidity, slot] = await Promise.all([poolContract.liquidity(), poolContract.slot0()]);
        return {
            liquidity: liquidity,
            sqrtPriceX96: slot[0],
            tick: slot[1],
            observationIndex: slot[2],
            observationCardinality: slot[3],
            observationCardinalityNext: slot[4],
            feeProtocol: slot[5],
            unlocked: slot[6],
        }
    }
    const getPoolImmutables = async function () {
        const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] = await Promise.all([
            poolContract.factory(),
            poolContract.token0(),
            poolContract.token1(),
            poolContract.fee(),
            poolContract.tickSpacing(),
            poolContract.maxLiquidityPerTick(),
        ]);

        return {
            factory: factory,
            token0: token0,
            token1: token1,
            fee: fee,
            tickSpacing: tickSpacing,
            maxLiquidityPerTick: maxLiquidityPerTick,
        }
    }

    // loading immutable pool parameters and its current state (variable parameters)
    const [immutables, state] = await Promise.all([getPoolImmutables(), getPoolState()]);

    const pool = new Pool(
        tokenIn,
        tokenOut,
        immutables.fee,
        state.sqrtPriceX96.toString(),
        state.liquidity.toString(),
        state.tick
    );

    // print token prices in the pool
    console.log("Token prices in pool:");
    console.log(`   1 ${pool.token0.symbol} = ${pool.token0Price.toSignificant()} ${pool.token1.symbol}`);
    console.log(`   1 ${pool.token1.symbol} = ${pool.token1Price.toSignificant()} ${pool.token0.symbol}`);
    console.log('');

    return pool;
}

async function getQuote(amountIn, tokenIn, tokenOut, pool, inAmountStr, provider) {
    const quoterContract = new ethers.Contract(UNISWAP_QUOTER_ADDRESS, QuoterABI.abi, provider);
    const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
        tokenIn.address,
        tokenOut.address,
        pool.fee,
        amountIn,
        0
    );
    const approxAmountOut = ethers.utils.formatUnits(quotedAmountOut, tokenOut.decimals);
    console.log(`   You'll get approximately ${approxAmountOut} ${tokenOut.symbol} for ${inAmountStr} ${tokenIn.symbol} \n`);

    return approxAmountOut;
}

async function createRoute(pool, tokenIn, tokenOut, amountIn, approxAmountOut) {
    const swapRoute = new Route(
        [pool],
        tokenIn,
        tokenOut
    )

    const amountOut = Math.floor(approxAmountOut * 10**18);

    const uncheckedTrade = Trade.createUncheckedTrade({
        route: swapRoute,
        inputAmount: CurrencyAmount.fromRawAmount(tokenIn, amountIn.toString()),
        outputAmount: CurrencyAmount.fromRawAmount(tokenOut, amountOut.toString()),
        tradeType: TradeType.EXACT_INPUT,
    })
    console.log("   Swap route created\n");

    return uncheckedTrade;
}

async function checkAllowance(contractIn, chainId, wallet, inAmountStr, provider, retries) {
    const walletAddress = wallet.address;
    const allowanceIn = await contractIn.allowance(walletAddress, V3_SWAP_ROUTER_ADDRESS);
    const decimals = await contractIn.decimals();
    if ((allowanceIn / (10**decimals)) > inAmountStr) {
        print(walletAddress, "   allowance already set\n");
        // console.log("   allowance already set\n");
        return;
    }
    print(walletAddress, `   allowance not set. setting allowance...`);
    // console.log(`   allowance not set. setting allowance...`)
    const amtToApprove = getRandomNumber(999999999, 999999999999)

    // const amtToApprove = 999999999999;
    const approveTxUnsigned = await contractIn.populateTransaction.approve(V3_SWAP_ROUTER_ADDRESS, amtToApprove);
    // by default chainid is not set https://ethereum.stackexchange.com/questions/94412/valueerror-code-32000-message-only-replay-protected-eip-155-transac
    approveTxUnsigned.chainId = chainId;
    // estimate gas required to make approve call (not sending it to blockchain either)
    approveTxUnsigned.gasLimit = BigNumber.from('80000');
    // suggested gas price (increase if you want faster execution)
    approveTxUnsigned.gasPrice = await provider.getGasPrice();
    // nonce is the same as number previous transactions
    approveTxUnsigned.nonce = await provider.getTransactionCount(walletAddress);

    // sign transaction by our signer
    const approveTxSigned = await wallet.signTransaction(approveTxUnsigned);
    // submit transaction to blockchain
    try {
        const submittedTx = await provider.sendTransaction(approveTxSigned);
        const approveReceipt = await submittedTx.wait();
        if (approveReceipt.status === 0)
            throw new SwapError("Approve transaction failed", retries + 1);
        print(walletAddress, "   allowance of 999999999999 set\n");
        // console.log("   allowance of 999999999999 set\n");
    } catch (e) {
        print(walletAddress, e);
        // console.log(e)
        throw new SwapError("Approve transaction failed", retries + 1);
    }
}

class SwapError extends Error {
    constructor(message, retries) {
      super(message);
      this.name = 'SwapError';
      this.retries = retries;
    }
}

module.exports = {
    attemptSwap,
    sleep,
};