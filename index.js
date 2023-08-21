const fs = require('fs');
const { ethers } = require("ethers");
const { runL2Marathon, runMerkley, runAngleProtocol, runGnosis, runStakeStg, runPoolUsd } = require("./actionables");
const { sleep, getRandomNumber, print } = require('./utils');
const { NumActions, RPC, Chain } = require('./configs.json');
const crypto = require('crypto');

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(crypto.randomInt(0, i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function readPrivateKeysFromJsonFile() {
    try {
        const data = fs.readFileSync('privateKeys.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading private keys:', error);
        return [];
    }
}

async function runRandomTasksWithPrivateKey(privateKey, tasks) {
    const provider = new ethers.providers.JsonRpcProvider(RPC["Arb"], Chain["Arb"]);
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = wallet.address;

    print(walletAddress, "Shuffling tasks array...");
    const shuffledFunctions = await shuffleArray(Object.keys(tasks));
    await sleep(0,2);
    print(walletAddress, `Shuffled tasks: ${shuffledFunctions.join(", ")}`);
    await sleep(0,2);
    // Generate a random number of functions to run (between 1 and 3)
    const numFunctionsToRun = await getRandomNumber(NumActions["Min"], NumActions["Max"]);
    print(walletAddress, `Number of tasks to do from list: ${numFunctionsToRun}\n`);

    const functionsToRun = shuffledFunctions.slice(0, numFunctionsToRun); // Use the shuffled function names directly

    // Run tasks sequentially for this wallet
    for (const fnKey of functionsToRun) {
        const fn = tasks[fnKey]; // Get the function using its name from the tasks object
        await fn(privateKey);
        await sleep(300, 1200, walletAddress); // Sleep for 1 second (adjust the duration as needed)
    }
}

(async () => {
    const privateKeys = await readPrivateKeysFromJsonFile();
    const tasks = {
        // runL2Marathon,
        // runMerkley,
        // runAngleProtocol,
        // runGnosis,
        runStakeStg,
        // runPoolUsd
    };

    const walletPromises = privateKeys.map(async (privateKey, index) => {
        if (index > 0) 
            await sleep(400,3000); // Sleep between wallets
        
        await runRandomTasksWithPrivateKey(privateKey, tasks).catch(error => {
            console.error(`Error running tasks for private key}:`, error);
        });
    });

    await Promise.all(walletPromises);

    console.log("All tasks completed.");
})();