const { ethers } = require('ethers');
const { JSBI, Pair, Trade, TradeOptions, Fetcher } = require('@traderjoe-xyz/sdk');
const { PairV2, RouteV2, TradeV2, LB_ROUTER_V21_ADDRESS, LBRouterV21ABI } = require('@traderjoe-xyz/sdk-v2');
const { Token, ChainId, WNATIVE, TradeType, TokenAmount, Percent, } = require('@traderjoe-xyz/sdk-core');

const { Chain, privateKey, inAmountStr } = require('./configs.json');

const traderjoe_abi = require("./abis/traderjoe_abi.json");

const provider = new ethers.providers.JsonRpcProvider("https://1rpc.io/WZojy2kHaKw235pu/avax/c", 43114);
const wallet = new ethers.Wallet(privateKey, provider);
const walletAddress = wallet.address;

const usdcAddress = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'; // USDC token address on Avalanche
const avaxAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'; // AVAX token address on Avalanche

const usdc = new Token(ChainId.AVALANCHE, usdcAddress, 6, 'USDC', 'USD Coin');
const avax = new Token(ChainId.AVALANCHE, avaxAddress, 18, 'AVAX', 'Wrapped AVAX');

console.log("hi");

(async () => {
    console.log("passed0")

    const pairs = await Fetcher.fetchPairData(usdc, avax, provider);
    const route = new RouteV2(pairs, usdc);
    console.log("passed")
    const trade = new Trade(route, new TokenAmount(usdc, '1000000000000000000'), TradeType.EXACT_INPUT);
    const slippageTolerance = new JSBI.BigInt(500); // 0.5% slippage tolerance
  
    const amountOutMin = trade.minimumAmountOut(slippageTolerance).raw;
    const deadline = Math.floor(Date.now() / 1000) + 1800; // Set the deadline to 30 minutes from now
  
    const traderjoe = new ethers.Contract('0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30', traderjoe_abi, provider);
    const contractWithSigner = await traderjoe.connect(wallet);
  
    console.log('Swapping...');
    const tx = await contractWithSigner.swapExactTokensForTokens(
      trade.inputAmount.raw.toString(),
      amountOutMin.toString(),
      trade.route.path.map((token) => token.address),
      walletAddress,
      deadline,
      {
        gasLimit: 400000,
      }
    );
  
    console.log('Transaction Hash:', tx.hash);
  })();
  