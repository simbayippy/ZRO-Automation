const { ethers } = require("ethers");
const { AngleProtocol, Stargate } = require('./configs.json');
const { getRandomNumber, sleep, print, checkAllowance } = require('./utils');
const {waitForMessageReceived} = require('@layerzerolabs/scan-client');
const { attemptSwap } = require('./swap');
const { BigNumber } = require('@ethersproject/bignumber');

const angleProtocol_abi = require("./abis/angleProtocol_abi.json");
const angleProtocolL0Bridge = require("./abis/angleProtocolL0Bridge_abi.json");
const MAX_RETRIES = 2;

async function attemptAngleProtocol(privateKey, chain, provider, from) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;
    try {
        print(walletAddress, "Swapping usd to Ageur...");
        // await attemptSwap(privateKey, "Normal", provider, from, AngleProtocol["AgEur"][chain], false, angleProtocol_abi);

        await angleProtocol(privateKey, chain, provider, 0);
        
    } catch(e) {
        if (e.retries >= MAX_RETRIES) {
            print(walletAddress, "Exceeded maximum number of attempts");
            return;
        }
        if (e instanceof BridgingAgeurError) {
            await angleProtocol(privateKey, chain, provider, e.retries)
        } else {
            print(walletAddress, e);
        }
    }
}

async function angleProtocol(privateKey, chain, provider, retries) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    const agEurAddr = AngleProtocol["AgEur"][chain];
    const agEurContract = new ethers.Contract(AngleProtocol["AgEur"][chain], angleProtocol_abi, provider);
    const agEurContractWithSigner = await agEurContract.connect(wallet);
    const amt = BigNumber.from(await agEurContractWithSigner.balanceOf(walletAddress));

    await checkAllowance(agEurAddr, provider, AngleProtocol["L0Bridge"][chain], wallet, 0);

    const agEurL0Contract = new ethers.Contract(AngleProtocol["L0Bridge"][chain], angleProtocolL0Bridge, provider);
    const agEurL0ContractWithSigner = await agEurL0Contract.connect(wallet);

    print(walletAddress, `Connected to AgEur L0 bridging contract...\n`)
    const validChains = ["Arb", "Optimism", "Polygon", "BSC", "Avax"];
    const index = await getRandomNumber(0,4);
    const destChain = validChains[index];
    print(walletAddress, `   ${destChain} selected. Bridging...\n`);
    const destChainId = Stargate["ChainId"][destChain];
    const srcChainId = Stargate["ChainId"][chain];

    // const adapterParams = ethers.utils.solidityPack(
    //     ['uint16','uint256'],
    //     [1, 300000]
    // )

    const adapterParams = "0x00010000000000000000000000000000000000000000000000000000000000030d40";

    // const adapterParams = "0x00010000000000000000000000000000000000000000000000000000000000030d40"

    const fees = await agEurL0ContractWithSigner.estimateSendFee(
        destChainId,            // the destination LayerZero chainId
        walletAddress,
        amt,
        false,                         // _payInZRO
        adapterParams                  // default '0x' adapterParams, see: Relayer Adapter Param docs
    )

    try {
        const gasPrice = await provider.getGasPrice();
        const maxPriorityFeePerGas = gasPrice.mul(10).div(12);
        const tx = await agEurL0ContractWithSigner.send(destChainId, walletAddress, amt, walletAddress, ethers.constants.AddressZero, adapterParams, {
            value: fees[0],
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: maxPriorityFeePerGas,
        })
        
        await tx.wait();
        print(walletAddress, `Bridged Ageur tokens to ${destChain}, waiting for it to reach dest chain...`);
        const done  = await waitForMessageReceived(srcChainId, tx.hash);
        print(walletAddress, `AgEur bridge: ${done.status}. Moving on to staking...\n`);
    } catch (e) {
        print(walletAddress, e);
        throw new BridgingAgeurError("BridgingAgeurError", retries + 1);
    }

}

class BridgingAgeurError extends Error {
    constructor(message, retries) {
        super(message);
        this.name = 'BridgingAgeurError';
        this.retries = retries;
    }
}

module.exports = {
    attemptAngleProtocol
};