
// const HDWalletProvider = require('truffle-hdwallet-provider');
// const infuraKey = "fj4jll3k.....";
//
// const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim();


const PrivateKeyProvider = require("truffle-privatekey-provider");
const privateKey = "cd2cd801889c5c44701f938dc95a54a92d8f91e1f223c1bff5508c0ef65be198";
const gasPrice = 10000000000; // (10 gwei)

const network = {
  DEV: 'http://127.0.0.1:7545',
  ROPSTEN: 'https://ropsten.infura.io/v3/af1b1e69f5bf435db4f4199557f1d8f8',
  KOVAN: 'https://kovan.infura.io/v3/af1b1e69f5bf435db4f4199557f1d8f8',
  RINKEBY: 'https://rinkeby.infura.io/v3/af1b1e69f5bf435db4f4199557f1d8f8',
  MAINNET: 'https://mainnet.infura.io/v3/af1b1e69f5bf435db4f4199557f1d8f8'
}

module.exports = {
  solc: {
    optimizer: {
        enabled: true,
        runs: 200,
    },
  },

  networks: {
    development: {
      provider: () => new PrivateKeyProvider(privateKey, network.DEV),
      gas: 2500000,
      gasPrice: gasPrice,
      // host: "127.0.0.1",     // Localhost (ganache) (default: none)
      // port: 8545,            // Standard Ethereum port (default: none)
      network_id: '*',          // Any network (default: none)
      skipDryRun: true      
    },
    ropsten: {
      provider: () => new PrivateKeyProvider(privateKey, network.ROPSTEN),
      network_id: 3,       // Ropsten's id
      gas: 2500000,        // Ropsten has a lower block limit than mainnet
      gasPrice:  gasPrice,
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
    kovan: {
      provider: () => new PrivateKeyProvider(privateKey, network.KOVAN),
      network_id: 42,       // kovan's id
      gas: 2500000,        // kovan has a lower block limit than mainnet
      gasPrice:  gasPrice,
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
    rinkeby: {
      provider: () => new PrivateKeyProvider(privateKey, network.RINKEBY),
      network_id: 4,       // Rinkeby's id
      gas: 2500000,        // Rinkeby has a lower block limit than mainnet
      gasPrice:  gasPrice,
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
    mainnet: {
      provider: () => new PrivateKeyProvider(privateKey, network.MAINNET),
      network_id: 1,       // mainnet's id
      gas: 2500000,        // Ropsten has a lower block limit than mainnet
      gasPrice:  gasPrice,
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    }
  }
}
