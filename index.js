const fs = require('fs');
const { runL2Marathon, runMerkley, runGnosis } = require("./actionables");
const { sleep, getRandomNumber } = require('./utils');

// Function to shuffle an array using Fisher-Yates algorithm
async function shuffleArray(array, seed) {
    console.log("Shuffling tasks array...\n");
    const random = (seed) => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(random(seed) * (i + 1));
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
    const seed = new Date().getTime(); // Get current time as the seed
    const shuffledFunctions = await shuffleArray(tasks, seed);
    // const shuffledFunctions = await shuffleArray(tasks);

    // Generate a random number of functions to run (between 1 and 3)
    const numFunctionsToRun = await getRandomNumber(1,3);
    console.log(`Number of tasks: ${numFunctionsToRun}\n`);
    await sleep(1,3);
    const functionsToRun = Object.keys(shuffledFunctions).slice(0, numFunctionsToRun);

    // Run tasks sequentially for this wallet
    for (const fnKey of functionsToRun) {
        const fn = shuffledFunctions[fnKey];
        await fn(privateKey);
        await sleep(10, 20); // Sleep for 1 second (adjust the duration as needed)
    }
}

(async () => {
    const privateKeys = await readPrivateKeysFromJsonFile();
    const tasks = {
        runL2Marathon,
        runMerkley,
        runGnosis
    };

    const walletPromises = privateKeys.map(async (privateKey) => {
        await runRandomTasksWithPrivateKey(privateKey, tasks).catch(error => {
            console.error(`Error running tasks for private key ${privateKey}:`, error);
        });
    });

    await Promise.all(walletPromises);

    console.log("All tasks completed.");
})();


// async function runRandomTasksWithPrivateKey(privateKey, tasks) {
//     const shuffledFunctions = await shuffleArray(tasks);

//     // Generate a random number of functions to run (between 1 and 3)
//     const numFunctionsToRun = Math.floor(Math.random() * 3) + 1;
//     const functionsToRun = Object.keys(shuffledFunctions).slice(0, numFunctionsToRun);

//     const promises = functionsToRun.map(async (fnKey) => {
//         const fn = shuffledFunctions[fnKey];
//         await fn(privateKey);
//         await sleep(300, 1200); // Sleep for 1 second (adjust the duration as needed)
//     });

//     await Promise.all(promises);
// }


// (async () => {
//     const privateKeys = await readPrivateKeysFromJsonFile();

//     for (const privateKey of privateKeys) {
//         await runRandomTasksWithPrivateKey(privateKey, {
//             runL2Marathon,
//             runMerkley,
//             runGnosis
//         }).catch(error => {
//             console.error(`Error running tasks for private key ${privateKey}:`, error);
//         });
//     }
// })();
// main();