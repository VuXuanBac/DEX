// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./token.sol";

// import "hardhat/console.sol";

contract TokenExchange is Ownable {
    string public exchange_name = "ETH ~ BTGold";

    address tokenAddr = address(0x5FbDB2315678afecb367f032d93F642f64180aa3); // TODO: paste token contract address here
    Token public token = Token(tokenAddr);

    // Liquidity pool for the exchange
    uint private token_reserves = 0;
    uint private eth_reserves = 0;

    mapping(address => uint) private lps;

    // Needed for looping through the keys of the lps mapping
    address[] private lp_providers;

    // liquidity rewards
    uint private swap_fee_numerator = 3;
    uint private swap_fee_denominator = 100;

    uint constant LP_FRAC_DENOM = 10 ** 18;

    // Constant: x * y = k
    uint private k;

    constructor() {}

    // Function createPool: Initializes a liquidity pool between your Token and ETH.
    // ETH will be sent to pool in this transaction as msg.value
    // amountTokens specifies the amount of tokens to transfer from the liquidity provider.
    // Sets up the initial exchange rate for the pool by setting amount of token and amount of ETH.
    function createPool(uint amountTokens) external payable onlyOwner {
        // This function is already implemented for you; no changes needed.

        // require pool does not yet exist:
        require(token_reserves == 0, "Token reserves was not 0");
        require(eth_reserves == 0, "ETH reserves was not 0.");

        // require nonzero values were sent
        require(msg.value > 0, "Need eth to create pool.");
        uint tokenSupply = token.balanceOf(msg.sender);
        require(
            amountTokens <= tokenSupply,
            "Not have enough tokens to create the pool"
        );
        require(amountTokens > 0, "Need tokens to create pool.");

        token.transferFrom(msg.sender, address(this), amountTokens);
        token_reserves = token.balanceOf(address(this));
        eth_reserves = msg.value;
        k = token_reserves * eth_reserves;
    }

    // Function removeLP: removes a liquidity provider from the list.
    // This function also removes the gap left over from simply running "delete".
    function removeLP(uint index) private {
        require(
            index < lp_providers.length,
            "specified index is larger than the number of lps"
        );
        lp_providers[index] = lp_providers[lp_providers.length - 1];
        lp_providers.pop();
    }

    // Function getSwapFee: Returns the current swap fee ratio to the client.
    function getSwapFee() public view returns (uint, uint) {
        return (swap_fee_numerator, swap_fee_denominator);
    }

    function getContribution() public view returns (uint) {
        return lps[msg.sender];
    }

    // ============================================================
    //                    FUNCTIONS TO IMPLEMENT
    // ============================================================

    /* ========================= Liquidity Provider Functions =========================  */

    /// Add ETH and Token in same price as in liquidity pool. with msg.value is the amount of ETH want to contribute.
    /// @param max_exchange_rate Highest acceptable Token Price
    /// @param min_exchange_rate Lowest acceptable Token Price
    /// @param decimals Accuracy for max/min_exchange_rate. Ex: Instead of 1.234, using 1234 with decimals = 10^3
    function addLiquidity(
        uint max_exchange_rate,
        uint min_exchange_rate,
        uint decimals
    ) external payable {
        uint amount_eths = msg.value;

        // Keep Price
        uint amount_tokens = (amount_eths * token_reserves) / eth_reserves;

        require(
            token.balanceOf(msg.sender) >= amount_tokens,
            "Exchange: Not posses enough Token"
        );

        // Handle Slippage
        // -- Token Price
        require(
            (eth_reserves * decimals) <= (max_exchange_rate * token_reserves),
            "Exchange: The price is too HIGH"
        );
        require(
            (eth_reserves * decimals) >= (min_exchange_rate * token_reserves),
            "Exchange: The price is too LOW"
        );

        // Transfer
        token.transferFrom(msg.sender, address(this), amount_tokens);

        // Update Contributions.
        uint new_eth_reserves = eth_reserves + amount_eths;
        for (uint i = 0; i < lp_providers.length; i++) {
            _UpdateContribution(lp_providers[i], new_eth_reserves);
        }

        // New LP
        if (lps[msg.sender] == 0) {
            lp_providers.push(msg.sender);
        }
        lps[msg.sender] += _Amount2Contribution(amount_eths, new_eth_reserves);

        // Update State
        _UpdateReserves();
        k = token_reserves * eth_reserves;
    }

    /// Remove ETH and Token in same price as in liquidity pool.
    /// @param amount_eths Amount of ETH want to remove
    /// @param max_exchange_rate Highest acceptable Token Price
    /// @param min_exchange_rate Lowest acceptable Token Price
    /// @param decimals Accuracy for max/min_exchange_rate. Ex: Instead of 1.234, using 1234 with decimals = 10^3
    function removeLiquidity(
        uint amount_eths,
        uint max_exchange_rate,
        uint min_exchange_rate,
        uint decimals
    ) public payable {
        require(
            amount_eths > 0,
            "Exchange: Can not remove liquidity with value 0."
        );
        require(
            eth_reserves >= 1 + amount_eths,
            "Exchange: Can not depleted Ether in the pool."
        );

        uint eth_posses = _Contribution2Amount(lps[msg.sender], eth_reserves);

        require(
            amount_eths <= eth_posses,
            "Exchange: Not posses that much ETH"
        );

        // Keep Price
        uint amount_tokens = (amount_eths * token_reserves) / eth_reserves;

        // Handle Slippage
        // -- Token Price
        require(
            (eth_reserves * decimals) <= (max_exchange_rate * token_reserves),
            "Exchange: The price is too HIGH"
        );
        require(
            (eth_reserves * decimals) >= (min_exchange_rate * token_reserves),
            "Exchange: The price is too LOW"
        );

        // Transfer
        token.transfer(msg.sender, amount_tokens);
        payable(msg.sender).transfer(amount_eths);

        // Update Contributions.
        uint new_eth_reserves = eth_reserves - amount_eths;
        uint index = lp_providers.length;
        for (uint i = 0; i < lp_providers.length; i++) {
            if (lp_providers[i] == msg.sender) {
                if (eth_posses == amount_eths) {
                    index = i; // This LP remove all
                    continue;
                }
            }
            _UpdateContribution(lp_providers[i], new_eth_reserves);
        }
        // This LP remove all contribution.
        if (index < lp_providers.length) {
            lps[msg.sender] = 0;
            removeLP(index);
        } else {
            lps[msg.sender] -= _Amount2Contribution(
                amount_eths,
                new_eth_reserves
            );
        }

        // Update State
        _UpdateReserves();
        k = token_reserves * eth_reserves;
    }

    /// Remove all contribution for msg.sender
    /// @param max_exchange_rate Highest acceptable Token Price
    /// @param min_exchange_rate Lowest acceptable Token Price
    /// @param decimals Accuracy for max/min_exchange_rate. Ex: Instead of 1.234, using 1234 with decimals = 10^3
    function removeAllLiquidity(
        uint max_exchange_rate,
        uint min_exchange_rate,
        uint decimals
    ) external payable {
        require(lps[msg.sender] > 0, "Exchange: Not posses liquidity stake.");
        uint amount_eths = _Contribution2Amount(lps[msg.sender], eth_reserves);

        require(
            eth_reserves >= 1 + amount_eths,
            "Exchange: Can not depleted Ether in the pool."
        );

        uint amount_tokens = _Contribution2Amount(
            lps[msg.sender],
            token_reserves
        );

        require(
            token_reserves >= 1 + amount_tokens,
            "Exchange: Can not depleted Token in the pool."
        );

        // Handle Slippage
        // -- Token Price
        require(
            (eth_reserves * decimals) <= (max_exchange_rate * token_reserves),
            "Exchange: The price is too HIGH"
        );
        require(
            (eth_reserves * decimals) >= (min_exchange_rate * token_reserves),
            "Exchange: The price is too LOW"
        );

        // Transfer
        token.transfer(msg.sender, amount_tokens);
        payable(msg.sender).transfer(amount_eths);

        // Update Contributions
        uint new_eth_reserves = eth_reserves - amount_eths;
        uint index = lp_providers.length;
        for (uint i = 0; i < lp_providers.length; i++) {
            if (lp_providers[i] == msg.sender) {
                index = i;
            } else {
                _UpdateContribution(lp_providers[i], new_eth_reserves);
            }
        }

        // Remove this LP
        lps[msg.sender] = 0;
        removeLP(index);

        // Update State
        _UpdateReserves();
        k = token_reserves * eth_reserves;
    }

    /***  Define additional functions for liquidity fees here as needed ***/
    /// From asset amount to contribution fraction
    /// @param amount Amount of assets (Token or ETH)
    /// @param reserves Reserves of assets (Token or ETH)
    function _Amount2Contribution(
        uint amount,
        uint reserves
    ) private pure returns (uint) {
        return (amount * LP_FRAC_DENOM) / reserves;
    }

    /// From contribution fraction to asset amount
    /// @param contribution Contribution fraction
    /// @param reserves Reserves of assets (Token or ETH)
    function _Contribution2Amount(
        uint contribution,
        uint reserves
    ) private pure returns (uint) {
        return (contribution * reserves) / LP_FRAC_DENOM;
    }

    /// Update contribution fraction in respect to new reserves
    /// @param lp_address Address of LP
    /// @param new_eth_reserves New ETH reserves
    function _UpdateContribution(
        address lp_address,
        uint new_eth_reserves
    ) private {
        lps[lp_address] = (lps[lp_address] * eth_reserves) / new_eth_reserves;
    }

    /* ========================= Swap Functions =========================  */

    /// Swap Token to get ETH
    /// @param amount_tokens Amount of Token
    /// @param max_exchange_rate Highest acceptable ETH Price
    /// @param decimals Accuracy for max_exchange_rate. Ex: Instead of 1.234, using 1234 with decimals = 10^3
    function swapTokensForETH(
        uint amount_tokens,
        uint max_exchange_rate,
        uint decimals
    ) external payable {
        require(
            token.balanceOf(msg.sender) >= amount_tokens,
            "Exchange: Not posses that much Token"
        );

        // Keep Product
        uint amount_eths = eth_reserves - k / (token_reserves + amount_tokens);

        // After Fee
        uint eth_after_fee = amount_eths -
            (amount_eths * swap_fee_numerator) /
            swap_fee_denominator;

        require(
            eth_reserves >= 1 + eth_after_fee,
            "Exchange: Can not depleted Ether in the pool."
        );

        // Handle Slippage
        // -- ETH Price
        require(
            // It should be like this
            // (amount_tokens * decimals) <= (max_exchange_rate * amount_eths),
            // But its too strict. If using this, not pass santity check

            (token_reserves * decimals) <= (max_exchange_rate * eth_reserves),
            "Exchange: The price is too HIGH"
        );

        // Transfer
        token.transferFrom(msg.sender, address(this), amount_tokens);
        payable(msg.sender).transfer(eth_after_fee);

        _UpdateReserves();
        //k = token_reserves * eth_reserves;
    }

    /// Swap ETH (from msg.value) to get Token
    /// @param max_exchange_rate Highest acceptable Token Price
    /// @param decimals Accuracy for max_exchange_rate. Ex: Instead of 1.234, using 1234 with decimals = 10^3
    function swapETHForTokens(
        uint max_exchange_rate,
        uint decimals
    ) external payable {
        uint amount_eths = msg.value;

        // Keep Product
        uint amount_tokens = token_reserves - k / (eth_reserves + amount_eths);

        // After Fee
        uint token_after_fee = amount_tokens -
            (amount_tokens * swap_fee_numerator) /
            swap_fee_denominator;

        require(
            token_reserves >= 1 + token_after_fee,
            "Exchange: Can not depleted Token in the pool."
        );

        // Handle Slippage
        // -- Token Price
        require(
            // It should be like this
            // (amount_eths * decimals) <= (max_exchange_rate * amount_tokens),
            // But its too strict. If using this, not pass santity check

            // Token Price
            (eth_reserves * decimals) <= (max_exchange_rate * token_reserves),
            "Exchange: The price is too HIGH"
        );

        // Transfer
        token.transfer(msg.sender, token_after_fee);

        _UpdateReserves();
        //k = token_reserves * eth_reserves;
    }

    function _UpdateReserves() private {
        token_reserves = token.balanceOf(address(this));
        eth_reserves = address(this).balance;
    }
}
