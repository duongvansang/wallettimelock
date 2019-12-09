pragma solidity >= 0.4.18 < 0.6.0;

import "./TimeLockedWallet.sol";

contract TimeLockedWalletFactory {

    mapping(address => address[]) wallets;

    function getWallets(address _user) public view returns(address[] memory) {
        return wallets[_user];
    }

    function newTimeLockedWallet(address _owner, uint256 _unlockDate) public payable returns(address) {
        // Create new wallet.
        address payable wallet = address(new TimeLockedWallet(msg.sender, _owner, _unlockDate));

        // Add wallet to sender's wallets.
        wallets[msg.sender].push(wallet);

        // If owner is the same as sender then add wallet to sender's wallets too.
        if(msg.sender != _owner){
            wallets[_owner].push(wallet);
        }

        // Send ether from this transaction to the created contract.
        wallet.transfer(msg.value);

        // Emit event.
        emit Created(wallet, msg.sender, _owner, now, _unlockDate, msg.value);
    }

    // Prevents accidental sending of ether to the factory
    function () external {
        revert("Could not send eth to contract");
    }

    event Created(address wallet, address from, address to, uint256 createdAt, uint256 unlockDate, uint256 amount);
}
