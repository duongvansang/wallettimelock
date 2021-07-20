window.addEventListener('load', async () => {
    // Modern dapp browsers...
    if (window.ethereum) {
        window.web3 = new Web3(window.ethereum);
        try {
            // Request account access if needed
            console.log("Request account");
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts',
            });

            console.log(accounts);

            // refresh page when account change
            ethereum.on('accountsChanged', function (accounts) {
                // Time to reload your interface with accounts[0]!
                window.location.reload();
            });
        } catch (error) {
            console.log(error)
        }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
        window.web3 = new Web3(web3.currentProvider);
    }
    // Non-dapp browsers...
    else {
        console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    }

});

