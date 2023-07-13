var swap_fee = 0;
exchange_contract.connect(provider.getSigner(defaultAccount)).getSwapFee().then(
    (result) => {
        swap_fee = result[0] / result[1];
        console.log("SWAP FEE: ", swap_fee);
    }
);
function log(description) {
    $("#log").html($("#log").html() + description + "<br>");
}

async function approveUsingToken(amount) {
    await token_contract.connect(provider.getSigner(defaultAccount)).approve(exchange_address, amount);
}

async function getTokenAmount(account) {
    return await token_contract.connect(provider.getSigner(account)).balanceOf(account);
}

async function getEthAmount(account) {
    return await provider.getBalance(account);
}

async function getContribution() {
    return Number(await exchange_contract.connect(provider.getSigner(defaultAccount)).getContribution()) / (10 ** 16);
}

async function testSwapETHForToken(amount = 100, slippage = 1) {
    let begin_state = await getPoolState();
    let begin_price = begin_state.eth_token_rate;

    let expected_tokens_received = amount * (1 - swap_fee) * begin_state.token_eth_rate;
    await swapETHForTokens(amount, slippage);

    let end_state = await getPoolState();
    let retrieve_price = Number(end_state.eth_liquidity - begin_state.eth_liquidity) * (1 - swap_fee) / Number(begin_state.token_liquidity - end_state.token_liquidity);

    console.log("================== Test Swap ETH -> Token ==================");
    console.log("Account: ", defaultAccount);
    console.log("Begin State: ", begin_state);
    console.log("Expected Token: ", expected_tokens_received);
    console.log(`# CHECK # Increase ETH   in Pool   : ${Number(end_state.eth_liquidity - begin_state.eth_liquidity)} \t\t[Diff? ${Number(end_state.eth_liquidity - begin_state.eth_liquidity) - amount}]`);
    console.log(`# CHECK # Decrease Token in Pool   : ${Number(begin_state.token_liquidity - end_state.token_liquidity)} \t\t[Diff? ${Number(begin_state.token_liquidity - end_state.token_liquidity - expected_tokens_received)}]`);
    console.log(`# CHECK # Token Retrieve Price     : ${retrieve_price} \t\t[Diff? ${retrieve_price - begin_price}]`);
    initUI();
}

async function testSwapTokenForETH(amount = 100, slippage = 1) {
    let begin_state = await getPoolState();
    let begin_price = begin_state.token_eth_rate;
    let expected_eths_receive = amount * (1 - swap_fee) * begin_state.eth_token_rate;
    await swapTokensForETH(amount, slippage);

    let end_state = await getPoolState();
    let retrieve_price = Number(begin_state.token_liquidity - end_state.token_liquidity) * (1 - swap_fee) / Number(end_state.eth_liquidity - begin_state.eth_liquidity);

    console.log("================== Test Swap Token -> ETH ==================");
    console.log("Account: ", defaultAccount);
    console.log("Begin State: ", begin_state);
    console.log("Expected ETH: ", expected_eths_receive);
    console.log(`# CHECK # Increase Token in Pool   : ${Number(end_state.token_liquidity - begin_state.token_liquidity)} \t\t[Diff? ${Number(end_state.token_liquidity - begin_state.token_liquidity) - amount}]`);
    console.log(`# CHECK # Decrease ETH   in Pool   : ${Number(begin_state.eth_liquidity - end_state.eth_liquidity)} \t\t[Diff? ${Number(begin_state.eth_liquidity - end_state.eth_liquidity - expected_eths_receive)}]`);
    console.log(`# CHECK # ETH Retrieve Price       : ${retrieve_price} \t\t[Diff? ${retrieve_price - begin_price}]`);
    initUI();
}

async function testAddLiquidity(amount = 100, slippage = 1) {
    let begin_state = await getPoolState();
    let expected_tokens_added = amount * begin_state.token_eth_rate;
    let begin_price = begin_state.eth_token_rate;
    await addLiquidity(amount, slippage);

    let end_state = await getPoolState();
    let retrieve_price = Number(begin_state.eth_liquidity - end_state.eth_liquidity) / Number(begin_state.token_liquidity - end_state.token_liquidity);
    let contribution = await getContribution();

    console.log("================== Test Add Liquidity ==================");
    console.log("Account: ", defaultAccount);
    console.log("Begin State: ", begin_state);
    console.log("Expected Token Added: ", expected_tokens_added);
    console.log("Contribution: ", contribution);
    console.log(`# CHECK # Increase ETH   in Pool   : ${Number(end_state.eth_liquidity - begin_state.eth_liquidity)} \t\t[Diff? ${Number(end_state.eth_liquidity - begin_state.eth_liquidity) - amount}]`);
    console.log(`# CHECK # Increase Token in Pool   : ${Number(end_state.token_liquidity - begin_state.token_liquidity)} \t\t[Diff? ${Number(end_state.token_liquidity - begin_state.token_liquidity) - expected_tokens_added}]`);
    console.log(`# CHECK # Token Retrieve Price     : ${retrieve_price} \t\t[Diff? ${retrieve_price - begin_price}]`);
    initUI();
}

async function testRemoveLiquidity(amount = 100, slippage = 1) {
    let begin_state = await getPoolState();
    let begin_price = begin_state.eth_token_rate;
    await removeLiquidity(amount, slippage);

    let end_state = await getPoolState();
    let contribution = await getContribution();
    let retrieve_price = Number(end_state.eth_liquidity - begin_state.eth_liquidity) / Number(end_state.token_liquidity - begin_state.token_liquidity);

    console.log("================== Test Remove Liquidity ==================");
    console.log("Account: ", defaultAccount);
    console.log("Begin State: ", begin_state);
    console.log("Contribution: ", contribution);
    console.log(`# CHECK # Decrease ETH   in Pool   : ${Number(begin_state.eth_liquidity - end_state.eth_liquidity)} \t\t[Diff? ${Number(begin_state.eth_liquidity - end_state.eth_liquidity) - amount}]`);
    console.log(`# CHECK # Decrease Token in Pool   : ${Number(begin_state.token_liquidity - end_state.token_liquidity)}`);
    console.log(`# CHECK # Token Retrieve Price     : ${retrieve_price} \t\t[Diff? ${retrieve_price - begin_price}]`);
    initUI();
}

async function testRemoveAllLiquidity(slippage = 1) {
    let begin_state = await getPoolState();
    let begin_price = begin_state.eth_token_rate;
    await removeAllLiquidity(slippage);

    let end_state = await getPoolState();
    let contribution = await getContribution();
    let retrieve_price = Number(end_state.eth_liquidity - begin_state.eth_liquidity) / Number(end_state.token_liquidity - begin_state.token_liquidity);

    console.log("================== Test Remove Liquidity ==================");
    console.log("Account: ", defaultAccount);
    console.log("Begin State: ", begin_state);
    console.log("Contribution: ", contribution);
    console.log(`# CHECK # Decrease ETH   in Pool   : ${Number(begin_state.eth_liquidity - end_state.eth_liquidity)}`);
    console.log(`# CHECK # Decrease Token in Pool   : ${Number(begin_state.token_liquidity - end_state.token_liquidity)}`);
    console.log(`# CHECK # Token Retrieve Price     : ${retrieve_price} \t\t[Diff? ${retrieve_price - begin_price}]`);
    initUI();
}

// =============================================================================
//                                SANITY CHECK
// =============================================================================
function check(name, swap_rate, condition) {
    if (condition) {
        console.log(name + ": SUCCESS");
        return (swap_rate == 0 ? 6 : 10);
    } else {
        console.log(name + ": FAILED");
        return 0;
    }
}


const sanityCheck = async function () {
    var swap_fee = await exchange_contract.connect(provider.getSigner(defaultAccount)).getSwapFee();
    console.log("Beginning Sanity Check.");

    var accounts = await provider.listAccounts();
    defaultAccount = accounts[0];
    var score = 0;
    var start_state = await getPoolState();
    var start_tokens = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);

    // No liquidity provider rewards implemented yet
    if (Number(swap_fee[0]) == 0) {
        await swapETHForTokens(100, 1);
        var state1 = await getPoolState();
        var expected_tokens_received = 100 * start_state.token_eth_rate;
        var user_tokens1 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Testing simple exchange of ETH to token", swap_fee[0],
            Math.abs((start_state.token_liquidity - expected_tokens_received) - state1.token_liquidity) < 5 &&
            (state1.eth_liquidity - start_state.eth_liquidity) === 100 &&
            Math.abs(Number(start_tokens) + expected_tokens_received - Number(user_tokens1)) < 5);

        await swapTokensForETH(100, 1);
        var state2 = await getPoolState();
        var expected_eth_received = 100 * state1.eth_token_rate;
        var user_tokens2 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test simple exchange of token to ETH", swap_fee[0],
            state2.token_liquidity === (state1.token_liquidity + 100) &&
            Math.abs((state1.eth_liquidity - expected_eth_received) - state2.eth_liquidity) < 5 &&
            Number(user_tokens2) === (Number(user_tokens1) - 100));

        await addLiquidity(100, 1);
        var expected_tokens_added = 100 * state2.token_eth_rate;
        var state3 = await getPoolState();
        var user_tokens3 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test adding liquidity", swap_fee[0],
            state3.eth_liquidity === (state2.eth_liquidity + 100) &&
            Math.abs(state3.token_liquidity - (state2.token_liquidity + expected_tokens_added)) < 5 &&
            Math.abs(Number(user_tokens3) - (Number(user_tokens2) - expected_tokens_added)) < 5);

        await removeLiquidity(10, 1);
        var expected_tokens_removed = 10 * state3.token_eth_rate;
        var state4 = await getPoolState();
        var user_tokens4 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test removing liquidity", swap_fee[0],
            state4.eth_liquidity === (state3.eth_liquidity - 10) &&
            Math.abs(state4.token_liquidity - (state3.token_liquidity - expected_tokens_removed)) < 5 &&
            Math.abs(Number(user_tokens4) - (Number(user_tokens3) + expected_tokens_removed)) < 5);

        await removeAllLiquidity(1);
        expected_tokens_removed = 90 * state4.token_eth_rate;
        var state5 = await getPoolState();
        var user_tokens5 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test removing all liquidity", swap_fee[0],
            state5.eth_liquidity - (state4.eth_liquidity - 90) < 5 &&
            Math.abs(state5.token_liquidity - (state4.token_liquidity - expected_tokens_removed)) < 5 &&
            Math.abs(Number(user_tokens5) - (Number(user_tokens4) + expected_tokens_removed)) < 5);
    }

    // LP provider rewards implemented
    else {
        var swap_fee = swap_fee[0] / swap_fee[1];
        console.log("swap fee: ", swap_fee);

        await swapETHForTokens(100, 1);
        var state1 = await getPoolState();
        var expected_tokens_received = 100 * (1 - swap_fee) * start_state.token_eth_rate;
        var user_tokens1 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Testing simple exchange of ETH to token", swap_fee[0],
            Math.abs((start_state.token_liquidity - expected_tokens_received) - state1.token_liquidity) < 5 &&
            (state1.eth_liquidity - start_state.eth_liquidity) === 100 &&
            Math.abs(Number(start_tokens) + expected_tokens_received - Number(user_tokens1)) < 5);

        await swapTokensForETH(100, 1);
        var state2 = await getPoolState();
        var expected_eth_received = 100 * (1 - swap_fee) * state1.eth_token_rate;
        var user_tokens2 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test simple exchange of token to ETH", swap_fee[0],
            state2.token_liquidity === (state1.token_liquidity + 100) &&
            Math.abs((state1.eth_liquidity - expected_eth_received) - state2.eth_liquidity) < 5 &&
            Number(user_tokens2) === (Number(user_tokens1) - 100));

        await addLiquidity(100, 1);
        var expected_tokens_added = 100 * state2.token_eth_rate;
        var state3 = await getPoolState();
        var user_tokens3 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test adding liquidity", swap_fee[0],
            state3.eth_liquidity === (state2.eth_liquidity + 100) &&
            Math.abs(state3.token_liquidity - (state2.token_liquidity + expected_tokens_added)) < 5 &&
            Math.abs(Number(user_tokens3) - (Number(user_tokens2) - expected_tokens_added)) < 5);


        // accumulate some lp rewards
        for (var i = 0; i < 20; i++) {
            await swapETHForTokens(100, 1);
            await swapTokensForETH(100, 1);
        }

        var state4 = await getPoolState();
        var user_tokens4 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        await removeLiquidity(10, 1);
        // set to 22 for a bit of leeway, could potentially reduce to 20 
        var expected_tokens_removed = (10 + 22 * 100 * swap_fee) * state3.token_eth_rate;
        var state5 = await getPoolState();
        var user_tokens5 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test removing liquidity", swap_fee[0],
            state5.eth_liquidity === (state4.eth_liquidity - 10) &&
            Math.abs(state5.token_liquidity - (state4.token_liquidity - expected_tokens_removed)) < expected_tokens_removed * 1.2 &&
            Math.abs(Number(user_tokens5) - (Number(user_tokens4) + expected_tokens_removed)) < expected_tokens_removed * 1.2);

        await removeAllLiquidity(1);
        expected_tokens_removed = (90 + 22 * 100 * swap_fee) * state5.token_eth_rate;
        var state6 = await getPoolState();
        var user_tokens6 = await token_contract.connect(provider.getSigner(defaultAccount)).balanceOf(defaultAccount);
        score += check("Test removing all liquidity", swap_fee[0],
            Math.abs(state6.eth_liquidity - (state5.eth_liquidity - 90)) < 5 &&
            Math.abs(state6.token_liquidity - (state5.token_liquidity - expected_tokens_removed)) < expected_tokens_removed * 1.2 &&
            Number(user_tokens6) > Number(user_tokens5));
    }
    console.log("Final score: " + score + "/50");

}

// Sleep 3s to ensure init() finishes before sanityCheck() runs on first load.
// If you run into sanityCheck() errors due to init() not finishing, please extend the sleep time.

// setTimeout(function () {
//   sanityCheck();
// }, 3000);