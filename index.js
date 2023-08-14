// const { ethers } = require("ethers");
// const { BigNumber } = require('@ethersproject/bignumber');
// const { RPC, Chain, Bungee, StableCoins, WNative } = require('./configs.json');
// // ... (other imports)

// // Array of wallet private keys
// const privateKeys = [
//   'privateKey1',
//   'privateKey2',
//   // Add more private keys here
// ];

// // Modify the gnosis function to accept a private key parameter
// async function gnosis(privateKey) {
//   // ... (rest of your gnosis function)
// }

// // Wrap gnosis function in a Promise
// function runGnosisForWallet(privateKey) {
//   return new Promise(async (resolve, reject) => {
//     try {
//       await gnosis(privateKey);
//       resolve();
//     } catch (error) {
//       reject(error);
//     }
//   });
// }

// // Use Promise.all to run gnosis for each wallet in parallel
// async function runParallelGnosis() {
//   const gnosisPromises = privateKeys.map(privateKey => runGnosisForWallet(privateKey));
  
//   try {
//     await Promise.all(gnosisPromises);
//     console.log('All wallets processed successfully.');
//   } catch (error) {
//     console.error('Error in processing wallets:', error);
//   }
// }

// // Call the function to run gnosis for multiple wallets in parallel
// runParallelGnosis();

const { runL2Marathon, runMerkley, runGnosis } = require("./actionables");
const { sleep, getRandomNumber } = require('./utils');

async function main() {
    // Define the list of functions
    const functionsToRun = [runL2Marathon, runMerkley, runGnosis];

    // Generate a random number between 1 and the number of functions
    const numberOfFunctionsToRun = getRandomNumber(1, functionsToRun.length);
    console.log(`Running ${numberOfFunctionsToRun} tasks...\n`);
    // Shuffle the array of functions
    const shuffledFunctions = shuffleArray(functionsToRun);

    // Run the selected number of functions
    for (let i = 0; i < numberOfFunctionsToRun; i++) {
        await shuffledFunctions[i]();
        await sleep(300, 1200);
    }

    console.log("All tasks run finish!");
}

// Function to shuffle an array using Fisher-Yates algorithm
async function shuffleArray(array) {
    console.log("Shuffling tasks array...\n")
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

main();