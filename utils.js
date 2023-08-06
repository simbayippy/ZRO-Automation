async function sleep(minSeconds, maxSeconds) {
    const randomSeconds = Math.random() * (maxSeconds - minSeconds) + minSeconds;

    if (randomSeconds > 5) {
        console.log(`Sleeping for ${randomSeconds}s...\n`)
    }
    return new Promise((resolve) => {
      setTimeout(resolve, randomSeconds * 1000);
    });
}
module.exports = {
    sleep,
};