const { ethers } = require("ethers");
const { parseUnits } = require('@ethersproject/units');
const { Contract } = require('@ethersproject/contracts');
const { Chain, privateKey, inAmountStr } = require('./configs.json');
const { sleep } = require('./utils');
// const { PairV2, RouteV2, TradeV2, LB_ROUTER_V21_ADDRESS, LBRouterV21ABI } = require('@traderjoe-xyz/sdk-v2');
const { PairV2, RouteV2, TradeV2, LB_ROUTER_V21_ADDRESS, LBRouterV21ABI } = require('@traderjoe-xyz/sdk-v2');

const { Token, ChainId, WNATIVE, TokenAmount, Percent, } = require('@traderjoe-xyz/sdk-core');
// const { JSBI } = require('@traderjoe-xyz/sdk');

// const {JSBI} =require('@traderjoe-xyz/sdk');
const ERC20_abi = require("./abis/ERC20_abi.json");
const WNative_abi = require("./abis/wnative_abi.json");

// import { Wallet } from 'ethers'
// import { Contract } from '@ethersproject/contracts'
// import { parseUnits } from '@ethersproject/units'
// import { JsonRpcProvider } from '@ethersproject/providers'

// const AVAX_URL = 'https://api.avax.network/ext/bc/C/rpc' //
const CHAIN_ID = ChainId.AVALANCHE

// initialize tokens
const WAVAX = WNATIVE[CHAIN_ID] // Token instance of WAVAX
// const USDC = new Token(
//     CHAIN_ID,
//     '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
//     6,
//     'USDC',
//     'USD Coin'
// )
// const USDT = new Token(
//     CHAIN_ID,
//     '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
//     6,
//     'USDT',
//     'Tether USD'
// )

// declare bases used to generate trade routes
const traderjoe_abi = require("./abis/traderjoe_abi.json");

async function avaxSwap() {
    const provider = new ethers.providers.JsonRpcProvider("https://1rpc.io/WZojy2kHaKw235pu/avax/c", CHAIN_ID);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    // first approve
    // const avaxUsdc = new ethers.Contract("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", ERC20_abi, provider);
    // const avaxUsdcWithSigner = avaxUsdc.connect(wallet);

    // await avaxUsdcWithSigner.approve("0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", 1000000000000)

    // goto traderjoe
    const usdAddress = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";

    const USDC = new Token(CHAIN_ID, usdAddress, 6, 'USDC', 'USD Coin');
    const BASES = [WAVAX, USDC];

    // the input token in the trade
    const inputToken = USDC;

    // the output token in the trade
    const outputToken = WAVAX;

    // get all [Token, Token] combinations 
    const allTokenPairs = PairV2.createAllTokenPairs(
        inputToken,
        outputToken,
        BASES
    )
    
    // init PairV2 instances for the [Token, Token] pairs
    const allPairs = PairV2.initPairs(allTokenPairs);
    console.log(allPairs)
    // generates all possible routes to consider
    const allRoutes = RouteV2.createAllRoutes(
        allPairs,
        inputToken,
        outputToken,
        1 // maxHops 
    )
    console.log(allRoutes)
    const traderjoe = new ethers.Contract("0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30", traderjoe_abi, provider);
    const contractWithSigner = await traderjoe.connect(wallet);
    console.log("connected, sending")
    await contractWithSigner.swapExactTokensForNATIVE(12563, 998072592165936, allRoutes, walletAddress, Math.floor(Date.now() / 1000 + 1800));

}

// async function avaxSwap() {
//     const provider = new ethers.providers.JsonRpcProvider("https://1rpc.io/WZojy2kHaKw235pu/avax/c", CHAIN_ID);
//     const usdAddress = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
//     const wallet = new ethers.Wallet(privateKey, provider);
//     const walletAddress = wallet.address;

//     const USDC = new Token(CHAIN_ID, usdAddress, 6, 'USDC', 'USD Coin');
//     const BASES = [WAVAX, USDC];

//     // the input token in the trade
//     const inputToken = USDC;

//     // the output token in the trade
//     const outputToken = WAVAX;

//     // specify whether user gave an exact inputToken or outputToken value for the trade
//     const isExactIn = true


//     // parse user input into inputToken's decimal precision, which is 6 for USDC
//     const typedValueInParsed = parseUnits(inAmountStr, inputToken.decimals).toString(); // returns 20000000

//     // wrap into TokenAmount
//     console.log("jere")
//     const amountIn = new TokenAmount(inputToken, BigInt(typedValueInParsed));
//     console.log(amountIn)
//     // get all [Token, Token] combinations 
//     const allTokenPairs = PairV2.createAllTokenPairs(
//         inputToken,
//         outputToken,
//         BASES
//     )
    
//     // init PairV2 instances for the [Token, Token] pairs
//     const allPairs = PairV2.initPairs(allTokenPairs);
//     console.log(allPairs)
//     // generates all possible routes to consider
//     const allRoutes = RouteV2.createAllRoutes(
//         allPairs,
//         inputToken,
//         outputToken,
//         1 // maxHops 
//     ) 

//     console.log(allRoutes, "\n\n")


//     const isAvaxIn = false // set to 'true' if swapping from AVAX; otherwise, 'false'
//     const isAvaxOut = true // set to 'true' if swapping to AVAX; otherwise, 'false'

//     console.log("Trades ared")

//     // generates all possible TradeV2 instances
//     const trades = await TradeV2.getTradesExactIn(
//         allRoutes,
//         amountIn,
//         outputToken,
//         isAvaxIn,
//         isAvaxOut, 
//         provider,
//         CHAIN_ID
//     ) 

//     console.log("Trades are", trades)
//     // chooses the best trade 
//     const bestTrade = TradeV2.chooseBestTrade(trades, isExactIn);

//     // print useful information about the trade, such as the quote, executionPrice, fees, etc
//     console.log("\n\nHUHH", bestTrade);

//     // get trade fee information
//     const { totalFeePct, feeAmountIn } = await bestTrade.getTradeFee(provider);
//     console.log('Total fees percentage', totalFeePct.toSignificant(6), '%');
//     console.log(`Fee: ${feeAmountIn.toSignificant(6)} ${feeAmountIn.token.symbol}`);

//     // set slippage tolerance
//     console.log("jere2")

//     const userSlippageTolerance = new Percent(BigInt(50), BigInt(10000)); // 0.5%

//     // set deadline for the transaction
//     const currenTimeInSec =  Math.floor((new Date().getTime()) / 1000);
//     const deadline = currenTimeInSec + 3600;

//     // set swap options
//     const swapOptions = {
//         recipient: walletAddress, 
//         allowedSlippage: userSlippageTolerance, 
//         deadline,
//         feeOnTransfer: false // or true
//     }

//     // generate swap method and parameters for contract call
//     const {
//         methodName, // e.g. swapExactTokensForAVAX,
//         args,       // e.g.[amountIn, amountOut, binSteps, path, to, deadline]
//         value       // e.g. 0x0
//     } = bestTrade.swapCallParameters(swapOptions);

//     // init router contract
//     const router = new Contract(
//         LB_ROUTER_V21_ADDRESS[CHAIN_ID],
//         LBRouterV21ABI,
//         wallet
//     )
    
//     // estimate gas
//     const gasOptions = value && !isZero(value) ? { value } : {} 
//     const gasEstimate = await router.estimateGas[methodName](...args, options)
    
//     // execute swap
//     const options = value && !isZero(value) 
//         ? { value, from: ACCOUNT }
//         : { from: ACCOUNT }
//     await router[methodName](...args, {
//         gasLimit: calculateGasMargin(gasEstimate),
//         ...options
//     })

//     console.log('Swap executed successfully!')
// }

avaxSwap();