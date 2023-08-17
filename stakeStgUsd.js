const { attemptSwap } = require('./swap');
const { print, checkAllowance, getRandomNumber, sleep } = require('./utils');
const { Stargate } = require('./configs.json');
const { ethers } = require("ethers");
const { BigNumber } = require('@ethersproject/bignumber');

const ERC20_abi = require("./abis/ERC20_abi.json");
const stgToken_abi = require("./abis/stgToken_abi.json");
const stgStaking_abi = require("./abis/stgStaking_abi.json");
const stargate_abi = require("./abis/stargate_abi.json");
const stgPooledUsd_abi = require("./abis/stgPooledUsd_abi.json");
const stgPoolContract_abi = require("./abis/stgPoolContract_abi.json");

const MAX_RETRIES = 2;

async function attemptStakeStg(privateKey, chain, provider, inAddr) {
    try {
        stakeStg(privateKey, chain, provider, inAddr, 0);
    } catch(e) {
        if (e.retries >= MAX_RETRIES) {
            console.log("Exceeded maximum number of attempts");
            return;
        }
        if (e instanceof StakeError) {
            await stakeStg(privateKey, chain, provider, inAddr, e.retries);
        } else {
            console.log(e);
        }
    }
}

async function stakeStg(privateKey, chain, provider, inAddr, retries) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    print(walletAddress, "Swapping usd to STG...");
    await attemptSwap(privateKey, "StakeStg", provider, inAddr, Stargate["StgToken"][chain], false, stgToken_abi);
    await checkAllowance(Stargate["StgToken"][chain], provider, Stargate["StgStakingAddr"][chain], wallet, 0);

    const contractStg = new ethers.Contract(Stargate["StgToken"][chain], stgToken_abi, provider);
    const contractStgWithSigner = await contractStg.connect(wallet);
    const stgBalance = await contractStgWithSigner.balanceOf(walletAddress);
    const stgFormatted = ethers.utils.formatEther(stgBalance);

    const contractVeStg = new ethers.Contract(Stargate["StgStakingAddr"][chain], stgStaking_abi, provider);
    const contractWithSigner = await contractVeStg.connect(wallet);
    const currentDate = new Date();
    const numMonthsStake = await getRandomNumber(4,6);
    const futureDate = addMonthsToDate(currentDate, numMonthsStake); // Add 5 months to the current date

    const unlockTime = Math.floor(futureDate.getTime() / 1000);

    print(walletAddress, `Staking for ${numMonthsStake} months...\n`)
    try {
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        const estimatedGasLimit = await contractWithSigner.estimateGas.create_lock(stgBalance, unlockTime, {
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas
        });
        const gasLimitWithBuffer = estimatedGasLimit.mul(110).div(100);
        const tx = await contractWithSigner.create_lock(stgBalance, unlockTime, {
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            gasLimit: gasLimitWithBuffer
        });
        await tx.wait();

        print(walletAddress, `Successfully locked ${stgFormatted} STG\n`)
    } catch (e) {
        print(walletAddress, e);
        throw new StakeError("Staked failed", retries + 1);
    }
}

async function attemptPoolUsd(privateKey, chain, provider, usd, inAddr) {
    try {
        poolUsd(privateKey, chain, provider, usd, inAddr, 0);
    } catch(e) {
        if (e.retries >= MAX_RETRIES) {
            console.log("Exceeded maximum number of attempts");
            return;
        }
        if (e instanceof AddLiqError) {
            await poolUsd(privateKey, chain, provider, usd, inAddr, e.retries);
        } else if (e instanceof StakePooledUsdError) {
            await poolUsd(privateKey, chain, provider, usd, inAddr, e.retries);
        } else {
            console.log(e);
        }
    }
}

async function poolUsd(privateKey, chain, provider, usd, usdAddr, retries) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    // before pooling
    const contractUsd = new ethers.Contract(usdAddr, ERC20_abi, provider);
    const contractUsdSigner = await contractUsd.connect(wallet);
    const usdBalance = await contractUsdSigner.balanceOf(walletAddress);
    const depositAmt = usdBalance.mul(25).div(100);;

    print(walletAddress, `Pooling ${usd} in stargate on ${chain}...`);

    // based on chain you are in connect to the stg router contract
    const contractStgRouter = new ethers.Contract(Stargate["Addr"][chain], stargate_abi, provider);
    const contractStgRouterWithSigner = await contractStgRouter.connect(wallet);

    // after pooling
    const poolId = Stargate["PoolId"][usd]
    const pooledUsdAddr = Stargate["UsdPooled"][usd][chain];
    const contractPooledUsd = new ethers.Contract(pooledUsdAddr, stgPooledUsd_abi, provider);
    const contractPooledUsdSigner = await contractPooledUsd.connect(wallet);
    let pooledUsdBalance = await contractPooledUsdSigner.balanceOf(walletAddress);
    const decimals = await contractPooledUsdSigner.decimals();
    let pooledUsdFormatted = ethers.utils.formatUnits(pooledUsdBalance, decimals);
    // let pooledUsdFormatted = ethers.utils.formatEther(pooledUsdBalance);

    const poolAddr = Stargate["PoolAddr"][chain]
    const contractPool = new ethers.Contract(poolAddr, stgPoolContract_abi, provider);
    const contractPoolSigner = await contractPool.connect(wallet);

    await checkAllowance(usdAddr, provider, Stargate["Addr"][chain], wallet, 0);
    if (pooledUsdBalance.lt(100)) {
        try {
            const gasPrice = await provider.getGasPrice();
            const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
            print(walletAddress, `   Adding ${depositAmt}${usd} liquidity to stargate...`);
            const txAddLiq = await contractStgRouterWithSigner.addLiquidity(poolId, depositAmt, walletAddress, {
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: maxPriorityFeePerGas
            });
            // after add liq will get some lpt tokens
            await txAddLiq.wait();
            print(walletAddress, `   Successfully added liquidity!\n`);
        } catch (e) {
            print(walletAddress, e);
            throw new AddLiqError("Add liquidity error", retries + 1);
        }
    } else {
        print(walletAddress, `   Already has ${pooledUsdFormatted} Pooled usd`);
    }

    pooledUsdBalance = await contractPooledUsdSigner.balanceOf(walletAddress);
    // pooledUsdFormatted = ethers.utils.formatEther(pooledUsdBalance);
    pooledUsdFormatted = ethers.utils.formatUnits(pooledUsdBalance, decimals);

    await checkAllowance(pooledUsdAddr, provider, poolAddr, wallet, 0);

    try {
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        const estimatedGasLimit = await contractPoolSigner.estimateGas.deposit(poolId - 1, pooledUsdBalance, {
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas
        });
        const gasLimitWithBuffer = estimatedGasLimit.mul(110).div(100);
        print(walletAddress, `   Staking pooled usd...`);
        const txStakingPooledUsd = await contractPoolSigner.deposit(poolId - 1, pooledUsdBalance, {
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
            gasLimit: gasLimitWithBuffer
        });
        await txStakingPooledUsd.wait();
        print(walletAddress, `   Successfully staked ${pooledUsdFormatted} pooled usd!\n`);
    } catch (e) {
        print(walletAddress, e);
        throw new StakePooledUsdError("Error staking pooled usd", retries + 1);
    }
}

function addMonthsToDate(date, months) {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
}

class StakeError extends Error {
    constructor(message, retries) {
      super(message);
      this.name = 'StakeError';
      this.retries = retries;
    }
}

class AddLiqError extends Error {
    constructor(message, retries) {
      super(message);
      this.name = 'AddLiqError';
      this.retries = retries;
    }
}

class StakePooledUsdError extends Error {
    constructor(message, retries) {
      super(message);
      this.name = 'StakePooledUsdError';
      this.retries = retries;
    }
}

module.exports = {
    attemptStakeStg,
    attemptPoolUsd,
};