# Who can mint ZCHF?

### XCHF Stablecoin Bridge

0x7bbe8F18040aF0032f4C2435E7a76db6F1E346DF

### Minting Hub

0x7546762fdb1a6d9146b33960545C3f6394265219

# Frankencoin is an ERC20 Token

> Is there an event to track mints and burns?

### For minting

```
    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a `Transfer` event with `from` set to the zero address.
     *
     * Requirements
     *
     * - `to` cannot be the zero address.
     */
    function _mint(address recipient, uint256 amount) internal virtual {
        require(recipient != address(0));

        _beforeTokenTransfer(address(0), recipient, amount);

        _totalSupply += amount;
        _balances[recipient] += amount;
---->   emit Transfer(address(0), recipient, amount);
    }
```

### For burning

```
    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a `Transfer` event with `to` set to the zero address.
     */
    function _burn(address account, uint256 amount) internal virtual {
        _beforeTokenTransfer(account, address(0), amount);

        _totalSupply -= amount;
        _balances[account] -= amount;
---->   emit Transfer(account, address(0), amount);
    }
```
